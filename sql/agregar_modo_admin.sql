-- ============================================================================
-- Agrega el modo administrador en Perfil (para poder agregar/sacar
-- requisitos de licencia sin que sea tan fácil tocarlo por accidente).
-- Correr en el SQL Editor de Supabase; seguro de correr una sola vez.
-- ============================================================================
alter table perfil_piloto add column if not exists es_admin boolean not null default false;
