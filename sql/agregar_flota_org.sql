-- ============================================================================
-- FASE 2 B2B — FLOTA DE ORGANIZACIÓN
-- ============================================================================
-- Depende de sql/agregar_organizaciones.sql (organizaciones,
-- organizacion_miembros, is_member_of()) — correr ese primero.
--
-- Propiedad dual: una aeronave sigue perteneciendo a un piloto (como hoy,
-- vía user_id) O pasa a pertenecer a una organización (vía org_id nuevo),
-- nunca las dos cosas. Las aeronaves personales existentes no cambian en
-- nada — user_id se vuelve nullable pero ninguna fila existente lo tiene
-- en null, así que su comportamiento actual queda intacto.
--
-- Seguro de correr una sola vez, y seguro de volver a correr entero.
-- ============================================================================

alter table aeronaves alter column user_id drop not null;
alter table aeronaves add column if not exists org_id uuid references organizaciones(id) on delete cascade;
create index if not exists idx_aeronaves_org on aeronaves(org_id);

alter table aeronaves drop constraint if exists aeronaves_dueno_check;
alter table aeronaves add constraint aeronaves_dueno_check
  check ((user_id is not null and org_id is null) or (user_id is null and org_id is not null));

-- ----------------------------------------------------------------------------
-- Ficha técnica extendida — solo tiene sentido completarla en la flota de
-- una organización (mantenimiento propio, no el "es mi avión" del piloto
-- individual), pero se agrega nullable a la misma tabla en vez de una
-- tabla aparte: mismo criterio que ya usa la ficha de aeronave existente
-- (foto, base, posición de foto) para no duplicar el modelo.
-- ----------------------------------------------------------------------------
alter table aeronaves add column if not exists horas_celula numeric(10,1);
alter table aeronaves add column if not exists horas_motor numeric(10,1);
alter table aeronaves add column if not exists proxima_inspeccion_anual date;

-- ----------------------------------------------------------------------------
-- RLS — políticas NUEVAS y ADITIVAS (Postgres las combina con OR dentro
-- del mismo comando): las 4 políticas "_own" que ya existen para aeronaves
-- de piloto individual quedan intactas y siguen siendo las únicas que
-- aplican mientras org_id sea null.
-- ----------------------------------------------------------------------------
drop policy if exists "aeronaves_select_org" on aeronaves;
drop policy if exists "aeronaves_insert_org" on aeronaves;
drop policy if exists "aeronaves_update_org" on aeronaves;
drop policy if exists "aeronaves_delete_org" on aeronaves;

create policy "aeronaves_select_org" on aeronaves for select
  using (org_id is not null and is_member_of(org_id));

-- Solo owner/admin arman y mantienen la flota; instructor/piloto_vinculado
-- la ven (política de select de arriba) pero no la editan.
create policy "aeronaves_insert_org" on aeronaves for insert
  with check (org_id is not null and user_id is null and is_member_of(org_id, array['owner', 'admin']));
create policy "aeronaves_update_org" on aeronaves for update
  using (org_id is not null and is_member_of(org_id, array['owner', 'admin']));
create policy "aeronaves_delete_org" on aeronaves for delete
  using (org_id is not null and is_member_of(org_id, array['owner', 'admin']));

-- Fin de Fase 2 — flota de organización.
