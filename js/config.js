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
  url: 'https://TU-PROYECTO.supabase.co',
  anonKey: 'TU-ANON-KEY-PUBLICA',
};
