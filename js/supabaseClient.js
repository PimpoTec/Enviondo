// Inicializa el cliente de Supabase (librería cargada por CDN en index.html
// como `window.supabase`, que expone `createClient`).
window.db = window.supabase.createClient(
  window.SUPABASE_CONFIG.url,
  window.SUPABASE_CONFIG.anonKey
);
