// ============================================================================
// CONFIGURACIÓN DE SUPABASE
// ============================================================================
// Completá estos dos valores con los de TU proyecto Supabase:
// Dashboard > Project Settings > API > "Project URL" y "anon public" key.
//
// La "anon key" es pública a propósito (viaja al navegador del usuario):
// la seguridad real la da Row Level Security (RLS), que ya está activada
// en sql/schema.sql — cada usuario solo puede leer/escribir sus propias filas.
// ============================================================================

window.SUPABASE_CONFIG = {
  url: 'https://ejuryuiklgauxongecrh.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqdXJ5dWlrbGdhdXhvbmdlY3JoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0MDAxMDQsImV4cCI6MjA5OTk3NjEwNH0._mrI6N7G-Fqfxkw48SUTOeWQDkvZ-6MhB-dxwZvGiRY',
};

// Slugs de las Edge Functions de Supabase. Ojo: el slug es el que Supabase le
// puso al CREAR la función (no el "Name" que se ve después en el dashboard).
// Si recreás la función con otro slug, cambialo acá y listo — no hace falta
// tocar el código de las vistas.
//   - metar: proxy a aviationweather.gov (METAR/TAF). Quedó "smooth-processor".
//   - cotizacion: proxy al dólar blue (respaldo si el navegador bloquea por
//     CORS el pedido directo). Deployá supabase/functions/cotizacion con este
//     slug para que funcione; si no está, la app usa las APIs públicas directo.
window.METAR_FN_SLUG = 'smooth-processor';
window.COTIZACION_FN_SLUG = 'cotizacion';

// Único email con permiso para editar los mínimos de licencia (tabla
// compartida por todos los usuarios). Es solo un gate de interfaz: el
// permiso real lo hace cumplir Supabase con RLS del lado del servidor
// (ver función is_licencias_admin() en sql/schema.sql), así que aunque
// alguien fuerce el botón desde la consola del navegador, la base de
// datos igual va a rechazar el guardado si no es este email.
window.ADMIN_EMAIL = 'fileretocambrafrancisco@gmail.com';
