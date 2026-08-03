-- ============================================================================
-- FASE 3 B2B — INSTRUCTORES (escuela de vuelo)
-- ============================================================================
-- Depende de sql/agregar_organizaciones.sql. Un instructor es, primero,
-- un piloto con cuenta propia en la app, invitado a la organización con
-- rol 'instructor' (ver organizacion_miembros) — esta tabla NO duplica esa
-- membresía, solo agrega los datos propios de instructor (nro de licencia,
-- si está activo dando clases ahora) que no tienen sentido en el perfil
-- personal del piloto.
--
-- Los vencimientos del instructor (CMA, habilitación, IFR, repaso de
-- vuelo) NO se duplican tampoco: siguen siendo las mismas filas de
-- `vencimientos` de siempre, del propio piloto. Lo único que se agrega
-- es una política de RLS nueva que le permite al owner/admin de la
-- organización LEERLAS (no editarlas) cuando esa persona es instructor
-- activo suyo — así el owner ve si el CMA de su instructor está por
-- vencer sin que el piloto tenga que cargar el dato dos veces.
--
-- Seguro de correr una sola vez, y seguro de volver a correr entero.
-- ============================================================================

create table if not exists instructores (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizaciones(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  nro_licencia text,
  activo       boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (org_id, user_id)
);

create index if not exists idx_instructores_org on instructores(org_id);

alter table instructores enable row level security;

-- Cualquier miembro de la organización puede ver el plantel de
-- instructores (ej. un piloto vinculado eligiendo con quién volar).
drop policy if exists "instructores_select" on instructores;
create policy "instructores_select" on instructores for select
  using (is_member_of(org_id));

-- Solo owner/admin dan de alta/baja instructores, y solo sobre alguien que
-- YA es miembro con rol 'instructor' de esa organización (no se puede
-- crear una ficha de instructor para cualquier user_id suelto).
drop policy if exists "instructores_insert" on instructores;
drop policy if exists "instructores_update" on instructores;
drop policy if exists "instructores_delete" on instructores;

create policy "instructores_insert" on instructores for insert
  with check (
    is_member_of(org_id, array['owner', 'admin'])
    and exists (
      select 1 from organizacion_miembros m
      where m.org_id = org_id and m.user_id = user_id
        and m.rol = 'instructor' and m.estado = 'activo'
    )
  );
create policy "instructores_update" on instructores for update
  using (is_member_of(org_id, array['owner', 'admin']));
create policy "instructores_delete" on instructores for delete
  using (is_member_of(org_id, array['owner', 'admin']));

-- ----------------------------------------------------------------------------
-- vencimientos: política ADITIVA (se suma a las 4 "_own" que ya existen,
-- no las reemplaza) — el owner/admin de una organización puede LEER (nunca
-- escribir) los vencimientos de sus instructores activos. El resto de la
-- tabla de vencimientos de piloto individual queda exactamente igual.
-- ----------------------------------------------------------------------------
drop policy if exists "vencimientos_select_org_instructor" on vencimientos;
create policy "vencimientos_select_org_instructor" on vencimientos for select
  using (
    exists (
      select 1 from instructores i
      where i.user_id = vencimientos.user_id
        and i.activo
        and is_member_of(i.org_id, array['owner', 'admin'])
    )
  );

-- Fin de Fase 3 — instructores.
