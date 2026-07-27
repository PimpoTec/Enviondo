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
// app; evita traer una librería de zonas horarias a un Edge Function. Se usa
// solo para el "día" de un vencimiento (fecha_vencimiento no tiene hora —
// elegir la medianoche de Argentina como límite del día, no la de UTC, es
// la elección correcta ahí y no tiene relación con la ambigüedad de
// hora_prevista de más abajo, ver referenciaVueloProgramadoMs).
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
      // urgency:'high' — sin esto Android puede demorar la entrega (a veces
      // varios minutos, a veces nada hasta que el sistema "despierte" solo)
      // si el celu está en modo Doze/ahorro de batería, porque por default
      // el push se manda con prioridad normal. Alta prioridad le pide al
      // servicio de push (FCM) que salte esa espera.
      await webpush.sendNotification(s.subscription, JSON.stringify(payload), { urgency: 'high' });
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

// Momento real (ms desde época) de un vuelo programado. `hora_prevista` se
// carga en la preferencia de huso horario vigente en el DISPOSITIVO al
// cargarlo (obtenerPrefHorario() en js/app.js) — un ajuste local al
// navegador, ni siquiera guardado en la fila, así que no hay forma de saber
// con certeza qué preferencia se usó para una fila puntual. Se asume UTC:
// es el default del cliente (obtenerPrefHorario() devuelve 'utc' si nunca
// se tocó "Hora local" en Preferencias) y la convención del resto del
// formato ANAC en esta app (hora_salida_utc/hora_llegada_utc). Si cargás
// tus vuelos programados en hora de Argentina en vez de UTC, activá "Hora
// local" en Preferencias antes de agendarlos.
function referenciaVueloProgramadoMs(fecha: string, hora: string): number {
  return new Date(`${fecha}T${hora}Z`).getTime();
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

// Procesa UN recordatorio personalizado: busca su evento, decide si ya toca
// avisar, y si toca, manda el push y marca `ultimo_aviso_clave` con la
// "instancia" del evento a la que correspondió ese aviso (la fecha del
// vuelo, o la fecha_vencimiento vigente). Si el evento se corre — vuelo
// reprogramado, o un vencimiento rodante que se resetea porque volaste —
// la clave deja de coincidir y el recordatorio queda habilitado de nuevo
// para la fecha nueva, sin ninguna limpieza manual.
async function procesarRecordatorio(r: any) {
  let evento: any;
  let referenciaMs: number;
  let claveActual: string;
  let cuerpoDefault: string;
  let titulo: string;
  let url: string;

  if (r.evento_tipo === 'vuelo_programado') {
    const { data: p } = await admin.from('vuelos_programados').select('*, aeronaves(matricula)').eq('id', r.evento_id).maybeSingle();
    if (!p) { await admin.from('recordatorios').delete().eq('id', r.id); return; } // el evento ya no existe: limpiamos el recordatorio huérfano
    evento = p;
    const hora = p.hora_prevista || '12:00:00';
    referenciaMs = referenciaVueloProgramadoMs(p.fecha, hora);
    claveActual = `${p.fecha}T${hora}`;
    const matricula = p.aeronaves?.matricula || 'tu aeronave';
    const ruta = p.desde && p.hasta ? ` (${p.desde} → ${p.hasta})` : '';
    titulo = 'Vuelo programado';
    cuerpoDefault = `${matricula}${ruta} — ${p.fecha} ${hora.slice(0, 5)}`;
    url = './#dashboard';
  } else {
    const { data: v } = await admin.from('vencimientos').select('*').eq('id', r.evento_id).maybeSingle();
    if (!v) { await admin.from('recordatorios').delete().eq('id', r.id); return; }
    evento = v;
    referenciaMs = new Date(`${v.fecha_vencimiento}T00:00:00Z`).getTime() + OFFSET_ARG_MS;
    claveActual = v.fecha_vencimiento;
    titulo = 'Vencimiento';
    cuerpoDefault = `${v.tipo} — vence ${v.fecha_vencimiento}`;
    url = './#perfil?seccion=alertas';
  }

  const ahora = Date.now();

  if (r.tipo_disparo === 'fecha_hora') {
    if (r.ultimo_aviso_clave === 'enviado') return;
    if (!r.fecha_hora || ahora < new Date(r.fecha_hora).getTime()) return;
  } else {
    // "Días/horas antes" es un aviso previo al evento — una vez que ya
    // pasó, no tiene sentido seguir avisando "antes" (el fallback legacy de
    // abajo es el que se encarga de insistir mientras algo esté vencido).
    if (r.ultimo_aviso_clave === claveActual) return;
    const faltanMs = referenciaMs - ahora;
    if (faltanMs < 0) return;
    const unidadMs = r.tipo_disparo === 'dias_antes' ? 86400000 : 3600000;
    if (faltanMs / unidadMs > Number(r.valor)) return;
  }

  await mandarATodos(r.user_id, { title: titulo, body: r.mensaje || cuerpoDefault, tag: 'recordatorio-' + r.id, url });
  await admin.from('recordatorios').update({ ultimo_aviso_clave: r.tipo_disparo === 'fecha_hora' ? 'enviado' : claveActual }).eq('id', r.id);
}

async function correrCron() {
  const hoyISO = new Date().toISOString().slice(0, 10);
  const ahora = Date.now();

  // Eventos que ya tienen recordatorios propios activos: para esos, el
  // aviso automático "de fábrica" de abajo no manda nada — el usuario ya
  // decidió exactamente cuándo quiere que le avisen.
  const { data: eventosConRecordatorio } = await admin.from('recordatorios').select('evento_tipo, evento_id').eq('activo', true);
  const vencimientosConRecordatorio = new Set((eventosConRecordatorio ?? []).filter((r) => r.evento_tipo === 'vencimiento').map((r) => r.evento_id));
  const programadosConRecordatorio = new Set((eventosConRecordatorio ?? []).filter((r) => r.evento_tipo === 'vuelo_programado').map((r) => r.evento_id));

  // ---- Aviso "de fábrica" (fallback): vencimientos sin recordatorios propios ----
  const { data: configsVenc } = await admin.from('notif_config').select('user_id').eq('vencimientos', true);
  for (const { user_id } of configsVenc ?? []) {
    const { data: vencimientos } = await admin.from('vencimientos').select('*').eq('user_id', user_id);
    for (const v of vencimientos ?? []) {
      if (vencimientosConRecordatorio.has(v.id)) continue;
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

  // ---- Aviso "de fábrica" (fallback): vuelos programados sin recordatorios propios ----
  const { data: configsVuelo } = await admin.from('notif_config').select('user_id, horas_antes_vuelo').eq('vuelos_programados', true);
  for (const { user_id, horas_antes_vuelo } of configsVuelo ?? []) {
    const { data: programados } = await admin.from('vuelos_programados')
      .select('*, aeronaves(matricula)').eq('user_id', user_id).eq('aviso_enviado', false)
      .gte('fecha', hoyISO);
    for (const p of programados ?? []) {
      if (programadosConRecordatorio.has(p.id)) continue;
      const hora = p.hora_prevista || '12:00:00';
      const fechaHoraMs = referenciaVueloProgramadoMs(p.fecha, hora);
      const horasFaltan = (fechaHoraMs - ahora) / 3600000;
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

  // ---- Recordatorios personalizados (uno o varios por evento) ----
  const { data: recordatorios } = await admin.from('recordatorios').select('*').eq('activo', true);
  for (const r of recordatorios ?? []) {
    try {
      await procesarRecordatorio(r);
    } catch (err) {
      console.error('Error procesando recordatorio', r.id, err);
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
