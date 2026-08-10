// ============================================================================
// EDGE FUNCTION: crear-organizacion — única forma de dar de alta una
// escuela/empresa. Solo la cuenta admin de la app puede llamarla (Perfil →
// Preferencias → Admin → Organizaciones → "Crear organización").
//
// Por qué hace falta una función server-side y no alcanza con el rpc
// directo: si el email del owner que puso el admin no tiene cuenta
// registrada todavía, hay que MANDARLE UN MAIL de invitación real
// (admin.auth.admin.inviteUserByEmail), y eso requiere la service_role
// key — que nunca puede vivir en el navegador (mismo motivo que
// borrar-cuenta).
//
// Flujo:
//   1. Intenta crear_organizacion_para_email(nombre, tipo, owner_email)
//      con el propio JWT del admin (respeta is_licencias_admin() del
//      lado del server, no confía en nada que mande el cliente).
//   2. Si esa función tira "NO_EXISTE_CUENTA: <email>" (el owner_email no
//      tiene cuenta todavía), invita a esa persona por mail — Supabase
//      manda su plantilla de "Invitación" (personalizable desde el
//      dashboard: Authentication → Email Templates → Invite user) con un
//      link para que fije contraseña — y reintenta el mismo rpc, que esta
//      vez sí encuentra la cuenta recién creada.
//   3. Cualquier otro error (no sos admin, tipo inválido, nombre vacío) se
//      propaga tal cual — no hay nada que reintentar.
// ============================================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

  try {
    const auth = req.headers.get('Authorization');
    if (!auth) throw new Error('Falta la sesión del usuario.');

    const { nombre, tipo, owner_email: ownerEmail, redirect_to: redirectTo } = await req.json();
    if (!nombre || !tipo || !ownerEmail) throw new Error('Faltan datos: nombre, tipo y owner_email son obligatorios.');

    // Corre CON el JWT de quien llama — así is_licencias_admin() del lado
    // del server evalúa a la cuenta real que está pidiendo esto, no a lo
    // que el cliente diga ser.
    const cliente = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });

    async function intentarCrear() {
      return await cliente.rpc('crear_organizacion_para_email', { p_nombre: nombre, p_tipo: tipo, p_owner_email: ownerEmail });
    }

    let { data: orgId, error } = await intentarCrear();

    if (error && String(error.message || '').startsWith('NO_EXISTE_CUENTA')) {
      const { error: errorInvite } = await admin.auth.admin.inviteUserByEmail(ownerEmail, {
        redirectTo: redirectTo || undefined,
      });
      if (errorInvite) throw errorInvite;

      // Reintenta ahora que la cuenta ya existe (recién creada, sin
      // confirmar todavía — alcanza para asignarle el rol de owner).
      ({ data: orgId, error } = await intentarCrear());
    }

    if (error) throw error;

    return new Response(JSON.stringify({ org_id: orgId }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
