-- ============================================================================
-- Mínimos de licencia como tabla GLOBAL compartida por todos los usuarios
-- (antes cada uno tenía su propia copia). Cualquier usuario logueado puede
-- leerla; solo la cuenta admin (email hardcodeado en is_licencias_admin())
-- puede editarla, agregarle o sacarle requisitos.
-- Correr en el SQL Editor de Supabase. Es seguro correrlo una sola vez.
-- ============================================================================

create or replace function is_licencias_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((auth.jwt() ->> 'email') = 'fileretocambrafrancisco@gmail.com', false);
$$;

create table if not exists licencias_requisitos (
  id               uuid primary key default gen_random_uuid(),
  curso_id         text not null check (curso_id in ('APPL', 'PPA', 'PCA', 'TLA')),
  nombre_requisito text not null,
  minimo_horas     numeric(8,2) not null default 0,
  orden            integer not null default 0,
  updated_at       timestamptz not null default now(),
  unique (curso_id, nombre_requisito)
);

alter table licencias_requisitos enable row level security;
drop policy if exists "licencias_requisitos_select_all" on licencias_requisitos;
drop policy if exists "licencias_requisitos_admin_insert" on licencias_requisitos;
drop policy if exists "licencias_requisitos_admin_update" on licencias_requisitos;
drop policy if exists "licencias_requisitos_admin_delete" on licencias_requisitos;
create policy "licencias_requisitos_select_all" on licencias_requisitos
  for select using (auth.role() = 'authenticated');
create policy "licencias_requisitos_admin_insert" on licencias_requisitos
  for insert with check (is_licencias_admin());
create policy "licencias_requisitos_admin_update" on licencias_requisitos
  for update using (is_licencias_admin());
create policy "licencias_requisitos_admin_delete" on licencias_requisitos
  for delete using (is_licencias_admin());

insert into licencias_requisitos (curso_id, nombre_requisito, minimo_horas, orden) values
  ('APPL', 'remolques', 40, 1),
  ('PPA', 'total', 40, 1),
  ('PPA', 'travesia_pic', 5, 2),
  ('PPA', 'nocturnas', 3, 3),
  ('PPA', 'aterrizajes_noche', 10, 4),
  ('PCA', 'total', 200, 1),
  ('PCA', 'pic', 100, 2),
  ('PCA', 'travesia_pic', 20, 3),
  ('PCA', 'instrumentos', 10, 4),
  ('PCA', 'nocturnas', 5, 5),
  ('PCA', 'aterrizajes_noche', 5, 6),
  ('TLA', 'total', 1500, 1),
  ('TLA', 'pic', 250, 2),
  ('TLA', 'travesia_pic', 100, 3),
  ('TLA', 'nocturnas', 100, 4),
  ('TLA', 'instrumentos', 75, 5)
on conflict (curso_id, nombre_requisito) do nothing;
