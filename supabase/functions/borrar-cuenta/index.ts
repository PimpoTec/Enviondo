// ============================================================================
// EDGE FUNCTION: borrar-cuenta — borra la cuenta del usuario logueado y TODOS
// sus datos, sin dejar rastro (Perfil → Datos Personales → "Borrar mi
// cuenta").
//
// Por qué hace falta una función server-side y no alcanza con borrar filas
// desde el cliente: borrar la cuenta de auth.users requiere la
// service_role key (nunca puede vivir en el navegador), y las 10 tablas de
// la app tienen `references auth.users(id) on delete cascade` — o sea que
// UNA sola llamada a `admin.auth.admin.deleteUser(user.id)` ya borra en
// cascada aeronaves, vuelos, vencimientos, perfil, config de licencia,
// notificaciones, recordatorios y config personalizada. `error_logs` es la
// única excepción a propósito (`on delete set null`, ver
// sql/agregar_registro_errores.sql): el registro de errores queda pero sin
// vincular al usuario borrado, útil para diagnóstico, inútil para
// identificar a nadie.
//
// Lo único que el cascade de la base NO cubre es Supabase Storage (no es
// una tabla con foreign key) — por eso esta función borra a mano los
// archivos del usuario en el bucket `aeronaves-fotos` ANTES de borrar la
// cuenta (si se borrara la cuenta primero, `auth.uid()` ya no existiría
// para filtrar qué carpeta es la suya).
//
// Identificamos al usuario con el JWT del header Authorization (nunca con
// un id que mande el cliente) — así nadie puede pedir borrar la cuenta de
// otra persona.
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

    const cliente = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { data: { user }, error: errorUser } = await cliente.auth.getUser();
    if (errorUser || !user) throw new Error('No se pudo identificar al usuario (sesión inválida).');

    // Borra las fotos del usuario en Storage (el cascade de la base no
    // llega hasta acá). Si no tiene ninguna, `list` devuelve un array vacío
    // y no hay nada que borrar — no es un error.
    const { data: archivos } = await admin.storage.from('aeronaves-fotos').list(user.id);
    if (archivos && archivos.length > 0) {
      await admin.storage.from('aeronaves-fotos').remove(archivos.map((f) => `${user.id}/${f.name}`));
    }

    // Borra la cuenta — el cascade de sql/schema.sql se encarga del resto
    // de los datos (aeronaves, vuelos, vencimientos, perfil, etc.).
    const { error: errorDelete } = await admin.auth.admin.deleteUser(user.id);
    if (errorDelete) throw errorDelete;

    return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
