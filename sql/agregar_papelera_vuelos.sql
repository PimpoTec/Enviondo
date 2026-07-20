-- ============================================================================
-- Papelera para vuelos: en vez de borrar la fila directo, "Borrar" marca
-- deleted_at y el vuelo deja de aparecer en la bitácora/totales/progreso.
-- Se puede restaurar desde Perfil → Papelera hasta que se vacíe manualmente
-- (no hay borrado automático por tiempo — lo decide el piloto).
-- Correr en el SQL Editor de Supabase; seguro de correr una sola vez.
-- ============================================================================
alter table vuelos add column if not exists deleted_at timestamptz;
create index if not exists idx_vuelos_deleted_at on vuelos(user_id, deleted_at);
