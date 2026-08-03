-- ============================================================================
-- FASE 1 B2B — DESPACHO (empresa de vuelos privados)
-- ============================================================================
-- Depende de sql/agregar_organizaciones.sql, agregar_flota_org.sql y
-- agregar_aprobacion_organizaciones.sql (organizacion_activa()).
--
-- A diferencia de los turnos de escuela (autogestión del piloto), acá NO
-- hay autoservicio: el owner/admin asigna directamente aeronave + piloto +
-- tramo. El piloto solo ve su propia agenda, de solo lectura — así lo pide
-- PROPUESTA_B2B.md ("no hay 'solicitar turno' del lado del piloto").
--
-- Mismo mecanismo anti doble-booking que turnos: EXCLUDE USING gist sobre
-- (aeronave_id, rango de tiempo), impuesto por Postgres.
--
-- Seguro de correr una sola vez, y seguro de volver a correr entero.
-- ============================================================================

create table if not exists vuelos_asignados (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizaciones(id) on delete cascade,
  aeronave_id    uuid not null references aeronaves(id) on delete cascade,
  piloto_user_id uuid not null references auth.users(id) on delete cascade,
  tramo          text not null,
  estado         text not null default 'programado'
                   check (estado in ('programado', 'en_curso', 'completado', 'cancelado')),
  inicio         timestamptz not null,
  fin            timestamptz not null,
  asignado_por   uuid not null references auth.users(id),
  created_at     timestamptz not null default now(),
  check (fin > inicio)
);

create index if not exists idx_vuelos_asignados_org on vuelos_asignados(org_id, inicio);
create index if not exists idx_vuelos_asignados_piloto on vuelos_asignados(piloto_user_id);

alter table vuelos_asignados drop constraint if exists vuelos_asignados_sin_solape;
alter table vuelos_asignados add constraint vuelos_asignados_sin_solape
  exclude using gist (aeronave_id with =, tstzrange(inicio, fin) with &&)
  where (estado <> 'cancelado');

alter table vuelos_asignados enable row level security;

-- SELECT: cualquier miembro ve la agenda de despacho de su organización
-- (el piloto asignado ve su propio vuelo dentro de esa misma agenda).
drop policy if exists "vuelos_asignados_select" on vuelos_asignados;
create policy "vuelos_asignados_select" on vuelos_asignados for select
  using (is_member_of(org_id) and organizacion_activa(org_id));

-- Sin políticas de INSERT/UPDATE directas: todo pasa por las funciones de
-- abajo (owner/admin únicamente — acá no hay autogestión del piloto).

create or replace function asignar_vuelo(
  p_org_id uuid, p_aeronave_id uuid, p_piloto_user_id uuid, p_tramo text,
  p_inicio timestamptz, p_fin timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vuelo_id uuid;
begin
  if not is_member_of(p_org_id, array['owner', 'admin']) then
    raise exception 'No tenés permiso para asignar vuelos en esta organización';
  end if;
  if not organizacion_activa(p_org_id) then
    raise exception 'Esta organización todavía no fue aprobada por el admin de la app';
  end if;
  if p_fin <= p_inicio then
    raise exception 'El horario de fin tiene que ser posterior al de inicio';
  end if;
  if trim(coalesce(p_tramo, '')) = '' then
    raise exception 'El tramo es obligatorio';
  end if;
  if not exists (select 1 from aeronaves where id = p_aeronave_id and org_id = p_org_id) then
    raise exception 'Esa aeronave no pertenece a esta organización';
  end if;
  if not exists (
    select 1 from organizacion_miembros m
    where m.org_id = p_org_id and m.user_id = p_piloto_user_id and m.estado = 'activo'
  ) then
    raise exception 'Ese piloto no es miembro activo de esta organización';
  end if;

  begin
    insert into vuelos_asignados (org_id, aeronave_id, piloto_user_id, tramo, inicio, fin, asignado_por)
    values (p_org_id, p_aeronave_id, p_piloto_user_id, trim(p_tramo), p_inicio, p_fin, auth.uid())
    returning id into v_vuelo_id;
  exception when exclusion_violation then
    raise exception 'Ese horario ya está ocupado para esa aeronave';
  end;

  return v_vuelo_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- actualizar_estado_vuelo_asignado: owner/admin mueve el vuelo por su
-- ciclo de vida (programado → en_curso → completado), o lo cancela.
-- ----------------------------------------------------------------------------
create or replace function actualizar_estado_vuelo_asignado(p_vuelo_id uuid, p_estado text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if p_estado not in ('programado', 'en_curso', 'completado', 'cancelado') then
    raise exception 'Estado inválido: %', p_estado;
  end if;
  select org_id into v_org_id from vuelos_asignados where id = p_vuelo_id;
  if v_org_id is null then
    raise exception 'Ese vuelo asignado no existe';
  end if;
  if not is_member_of(v_org_id, array['owner', 'admin']) then
    raise exception 'No tenés permiso para modificar vuelos de esta organización';
  end if;
  update vuelos_asignados set estado = p_estado where id = p_vuelo_id;
end;
$$;

-- Fin de Fase 1 — despacho.
