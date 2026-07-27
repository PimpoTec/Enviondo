-- ============================================================================
-- REGISTRO DE ERRORES (opcional) — monitoreo básico, propio, sin depender de
-- ningún servicio de terceros (Sentry y similares necesitan cuenta/API key
-- que no está configurada). La app misma agarra sus errores no manejados
-- (window.onerror, promesas rechazadas sin catch, y las pantallas que
-- fallan al renderizar — ver js/errorLog.js y js/router.js) y guarda un
-- registro corto acá. Solo vos (la cuenta admin, ver ADMIN_EMAIL en
-- js/config.js) podés LEER esta tabla — cualquier usuario logueado puede
-- insertar (reportar sus propios errores), nadie puede leer los de otro.
-- Correr en el SQL Editor de Supabase. Es seguro correrlo una sola vez.
-- ============================================================================

create table if not exists error_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete set null,
  mensaje    text not null,
  detalle    text,
  url        text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists idx_error_logs_created on error_logs(created_at desc);

alter table error_logs enable row level security;
drop policy if exists "error_logs_insert_own" on error_logs;
drop policy if exists "error_logs_select_admin" on error_logs;
drop policy if exists "error_logs_delete_admin" on error_logs;
-- Cualquier usuario logueado puede reportar SUS PROPIOS errores (con su
-- propio user_id, no el de otro) — es lo único que necesita la app para
-- funcionar. Reutiliza is_licencias_admin() (ya existe, mismo email admin
-- hardcodeado) para la lectura/borrado: no hace falta una segunda función
-- idéntica solo por el nombre.
create policy "error_logs_insert_own" on error_logs
  for insert with check (auth.uid() = user_id);
create policy "error_logs_select_admin" on error_logs
  for select using (is_licencias_admin());
create policy "error_logs_delete_admin" on error_logs
  for delete using (is_licencias_admin());
