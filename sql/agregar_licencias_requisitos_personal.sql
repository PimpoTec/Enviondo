-- ============================================================================
-- MÍNIMOS DE LICENCIA PERSONALIZADOS (opcional) — los mínimos de referencia
-- (licencias_requisitos) siguen siendo una tabla GLOBAL con la RAAC
-- vigente, la misma para todos los pilotos, editable solo por la cuenta
-- admin. Esta tabla nueva deja que CUALQUIER piloto guarde su PROPIO valor
-- para un requisito puntual (ej. su escuela/CIAC le exige 250 hs totales
-- en vez de las 200 de referencia para PCA) sin tocar el valor de nadie
-- más — donde no personalizó nada, sigue viendo el de referencia.
-- Correr en el SQL Editor de Supabase. Es seguro correrlo una sola vez (y
-- no rompe nada si lo repetís).
-- ============================================================================

create table if not exists licencias_requisitos_personal (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  curso_id         text not null,
  nombre_requisito text not null,
  minimo_horas     numeric(8,2) not null default 0,
  updated_at       timestamptz not null default now(),
  unique (user_id, curso_id, nombre_requisito)
);

alter table licencias_requisitos_personal enable row level security;
drop policy if exists "licencias_requisitos_personal_select_own" on licencias_requisitos_personal;
drop policy if exists "licencias_requisitos_personal_insert_own" on licencias_requisitos_personal;
drop policy if exists "licencias_requisitos_personal_update_own" on licencias_requisitos_personal;
drop policy if exists "licencias_requisitos_personal_delete_own" on licencias_requisitos_personal;
-- Personal de verdad: cada quien solo ve/edita/borra lo suyo (mismo
-- criterio que aeronaves, vuelos, vencimientos, etc.) — a diferencia de
-- licencias_requisitos (la de referencia), acá no hace falta ser admin.
create policy "licencias_requisitos_personal_select_own" on licencias_requisitos_personal
  for select using (auth.uid() = user_id);
create policy "licencias_requisitos_personal_insert_own" on licencias_requisitos_personal
  for insert with check (auth.uid() = user_id);
create policy "licencias_requisitos_personal_update_own" on licencias_requisitos_personal
  for update using (auth.uid() = user_id);
create policy "licencias_requisitos_personal_delete_own" on licencias_requisitos_personal
  for delete using (auth.uid() = user_id);
