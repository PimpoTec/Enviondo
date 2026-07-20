// ============================================================================
// EDGE FUNCTION: notificaciones-push — manda los avisos de Vencimientos y
// Vuelos programados por Web Push (VAPID), sin ningún servicio de terceros.
//
// Dos modos, en el mismo body JSON ({ "modo": "test" | "cron" }):
//
//   - "test": la llama el botón "Enviar notificación de prueba" de Perfil
//     desde el navegador (window.db.functions.invoke), que ya manda el JWT
//     del usuario logueado en el header Authorization. Identificamos al
//     usuario CON ESE TOKEN (nunca confiamos en un user_id que mande el
//     cliente) y le mandamos un aviso de prueba a sus propios dispositivos,
//     ignorando sus preferencias (es una prueba, tiene que llegar sí o sí).
//
//   - "cron": la dispara pg_cron (ver sql/agregar_notificaciones_push.sql),
//     autenticada con un secreto propio (Authorization: Bearer <CRON_SECRET>,
//     NO la service_role key — esa solo vive acá adentro, como variable de
//     entorno que Supabase inyecta sola). Barre TODOS los usuarios con
//     notif_config activo y manda lo que corresponda.
//
// Requiere estos secretos (supabase secrets set NOMBRE=valor):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY  (generados con `npx web-push
//   generate-vapid-keys` — la pública además va en js/config.js)
//   VAPID_SUBJECT   (ej. "mailto:tu-email@ejemplo.com")
//   CRON_SECRET     (cualquier string largo random, lo elegís vos)
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ya vienen solos, no hace falta
// fijarlos.
// ============================================================================

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:notificaciones@example.com';
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';

// Si todavía no se configuraron los secretos VAPID (recién desplegada,
// antes del `supabase secrets set`), no dejamos que la función se rompa
// para TODOS los pedidos — solo va a fallar, con un mensaje claro, cuando
// alguien de verdad intente mandar un push.
let vapidListo = false;
try {
  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    vapidListo = true;
  }
} catch (err) {
  console.error('VAPID mal configurado:', err);
}

// GMT-3 fijo (Argentina no usa horario de verano) — suficiente para esta
// app; evita traer una librería de zonas horarias a un Edge Function.
const OFFSET_ARG_MS = 3 * 60 * 60 * 1000;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Devuelve un resumen (no solo tira o no tira excepción) porque un
// webpush.sendNotification fallido con, por ejemplo, 400/401 del servicio
// de push NO es un error de nuestra función — para el cliente eso se veía
// como "éxito" (cartel verde) aunque no llegara nada. El modo test usa este
// resumen para avisar de verdad cuando no se pudo entregar nada.
async function mandarATodos(userId: string, payload: { title: string; body: string; tag: string; url?: string }) {
  if (!vapidListo) throw new Error('Faltan configurar los secretos VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY en la Edge Function.');
  const { data: subs } = await admin.from('push_subscriptions').select('*').eq('user_id', userId);
  let enviados = 0;
  let ultimoError = '';
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(s.subscription, JSON.stringify(payload));
      enviados++;
    } catch (err: any) {
      // 404/410 = el navegador descartó esa suscripción (desinstaló la PWA,
      // borró datos, etc.) — la sacamos para no seguir intentando en vano.
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await admin.from('push_subscriptions').delete().eq('id', s.id);
        ultimoError = 'La suscripción había expirado (se borró; volvé a activar las notificaciones).';
      } else {
        ultimoError = `${err?.statusCode ? 'HTTP ' + err.statusCode + ': ' : ''}${err?.body || err?.message || err}`;
        console.error('Error enviando push:', ultimoError);
      }
    }
  }
  return { total: (subs ?? []).length, enviados, ultimoError };
}

function estadoVencimiento(fechaVencimiento: string, umbralDias: number) {
  const hoy = new Date();
  const hoyUTC = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate());
  const [y, m, d] = fechaVencimiento.split('-').map(Number);
  const fv = Date.UTC(y, m - 1, d);
  const dias = Math.round((fv - hoyUTC) / 86400000);
  if (dias < 0) return { estado: 'danger', dias };
  if (dias <= umbralDias) return { estado: 'warn', dias };
  return { estado: 'ok', dias };
}

async function correrCron() {
  const hoyISO = new Date().toISOString().slice(0, 10);

  // ---- Vencimientos: CMA, habilitaciones, IFR, currency... ----
  const { data: configsVenc } = await admin.from('notif_config').select('user_id').eq('vencimientos', true);
  for (const { user_id } of configsVenc ?? []) {
    const { data: vencimientos } = await admin.from('vencimientos').select('*').eq('user_id', user_id);
    for (const v of vencimientos ?? []) {
      if (v.ultimo_aviso === hoyISO) continue; // ya avisado hoy
      const { estado, dias } = estadoVencimiento(v.fecha_vencimiento, v.umbral_alerta_dias || 30);
      if (estado === 'ok') continue;
      const texto = estado === 'danger'
        ? `${v.tipo} vencido hace ${Math.abs(dias)} día(s).`
        : `${v.tipo} vence en ${dias} día(s).`;
      await mandarATodos(user_id, { title: 'Vencimiento próximo', body: texto, tag: 'vencimiento-' + v.id, url: './#perfil?seccion=alertas' });
      await admin.from('vencimientos').update({ ultimo_aviso: hoyISO }).eq('id', v.id);
    }
  }

  // ---- Vuelos programados: recordatorio X horas antes ----
  const { data: configsVuelo } = await admin.from('notif_config').select('user_id, horas_antes_vuelo').eq('vuelos_programados', true);
  const ahora = Date.now();
  for (const { user_id, horas_antes_vuelo } of configsVuelo ?? []) {
    const { data: programados } = await admin.from('vuelos_programados')
      .select('*, aeronaves(matricula)').eq('user_id', user_id).eq('aviso_enviado', false)
      .gte('fecha', hoyISO);
    for (const p of programados ?? []) {
      const hora = p.hora_prevista || '12:00:00';
      const fechaHoraLocal = new Date(`${p.fecha}T${hora}Z`).getTime() + OFFSET_ARG_MS;
      const horasFaltan = (fechaHoraLocal - ahora) / 3600000;
      if (horasFaltan < 0 || horasFaltan > (horas_antes_vuelo || 12)) continue;
      const matricula = p.aeronaves?.matricula || 'tu aeronave';
      const ruta = p.desde && p.hasta ? ` (${p.desde} → ${p.hasta})` : '';
      await mandarATodos(user_id, {
        title: 'Vuelo programado próximo',
        body: `${matricula}${ruta} — ${p.fecha} ${hora.slice(0, 5)}`,
        tag: 'vuelo-programado-' + p.id,
        url: './#dashboard',
      });
      await admin.from('vuelos_programados').update({ aviso_enviado: true }).eq('id', p.id);
    }
  }
}

async function correrTest(authHeader: string) {
  const cliente = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error } = await cliente.auth.getUser();
  if (error || !user) throw new Error('No se pudo identificar al usuario (sesión inválida).');
  const resumen = await mandarATodos(user.id, {
    title: 'Notificación de prueba',
    body: 'Si ves esto, las notificaciones push están funcionando.',
    tag: 'prueba',
    url: './#perfil?seccion=notificaciones',
  });
  if (resumen.total === 0) {
    throw new Error('No hay ninguna suscripción guardada para tu usuario — desactivá y volvé a activar las notificaciones en Perfil.');
  }
  if (resumen.enviados === 0) {
    throw new Error(`Se encontró ${resumen.total} dispositivo(s) suscripto(s) pero ninguno recibió el envío: ${resumen.ultimoError || 'motivo desconocido'}`);
  }
  return resumen;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

  try {
    const body = await req.json().catch(() => ({}));
    const modo = body?.modo === 'cron' ? 'cron' : 'test';

    if (modo === 'cron') {
      const auth = req.headers.get('Authorization') || '';
      if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
        return new Response(JSON.stringify({ error: 'No autorizado.' }), { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
      }
      await correrCron();
      return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }

    const auth = req.headers.get('Authorization');
    if (!auth) throw new Error('Falta la sesión del usuario.');
    const resumen = await correrTest(auth);
    return new Response(JSON.stringify({ ok: true, ...resumen }), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
