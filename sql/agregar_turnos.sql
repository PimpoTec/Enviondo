-- ============================================================================
-- FASE 4 B2B — TURNOS (escuela de vuelo)
-- ============================================================================
-- Depende de sql/agregar_organizaciones.sql, agregar_flota_org.sql e
-- (si la organización tiene instructores) agregar_instructores.sql.
--
-- Alcance de esta primera versión: reserva por un MIEMBRO de la
-- organización (piloto vinculado, instructor o admin/owner reservando para
-- sí) sobre una aeronave de SU flota. El flujo de "piloto externo sin
-- vincular ve disponibilidad pública y pide autorización" que menciona
-- PROPUESTA_B2B.md es una pantalla pública/anónima aparte — no está acá
-- todavía, queda para una fase siguiente (no rompe nada agregarla después,
-- es la misma tabla con un par de policies más).
--
-- Reglas de negocio (decididas acá, no en el cliente — un piloto con la
-- consola del navegador abierta no puede saltárselas):
--  - piloto_vinculado: crear_turno() lo confirma directo (autogestión).
--  - instructor / admin / owner reservando para sí: queda pendiente de
--    autorización de un owner/admin (incluido el propio, si quiere
--    aprobarse a sí mismo — no se lo impedimos, es su organización).
--  - Dos turnos no pueden solaparse en la misma aeronave: constraint de
--    exclusión a nivel Postgres (EXCLUDE USING gist), no una validación
--    de cliente que se puede evadir con dos pestañas abiertas a la vez.
--
-- Seguro de correr una sola vez, y seguro de volver a correr entero.
-- ============================================================================

-- Hace falta para poder usar "=" (aeronave_id) adentro de un EXCLUDE
-- USING gist junto con el operador de solapamiento de rangos "&&".
create extension if not exists btree_gist;

create table if not exists turnos (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizaciones(id) on delete cascade,
  aeronave_id    uuid not null references aeronaves(id) on delete cascade,
  instructor_id  uuid references instructores(id) on delete set null,
  piloto_user_id uuid not null references auth.users(id) on delete cascade,
  estado         text not null default 'pendiente_autorizacion'
                   check (estado in ('pendiente_autorizacion', 'confirmado', 'cancelado')),
  inicio         timestamptz not null,
  fin            timestamptz not null,
  creado_por     uuid not null references auth.users(id),
  autorizado_por uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  check (fin > inicio)
);

create index if not exists idx_turnos_org on turnos(org_id, inicio);
create index if not exists idx_turnos_piloto on turnos(piloto_user_id);

-- Dos turnos ACTIVOS (no cancelados) de la misma aeronave no pueden pisarse
-- en el tiempo — esto es lo que de verdad impide el doble booking, no la
-- UI. Un turno cancelado no cuenta (libera el horario para otra reserva).
alter table turnos drop constraint if exists turnos_sin_solape;
alter table turnos add constraint turnos_sin_solape
  exclude using gist (aeronave_id with =, tstzrange(inicio, fin) with &&)
  where (estado <> 'cancelado');

alter table turnos enable row level security;

-- SELECT: cualquier miembro activo de la organización ve la agenda
-- completa de la flota (no solo la suya) — así un piloto vinculado puede
-- ver qué horarios están libres antes de reservar.
drop policy if exists "turnos_select" on turnos;
create policy "turnos_select" on turnos for select
  using (is_member_of(org_id));

-- Sin políticas de INSERT/UPDATE directas: el estado inicial depende del
-- rol de quien reserva (autogestión vs. autorización) y aprobar/rechazar
-- solo lo puede hacer owner/admin — esa lógica vive en las funciones de
-- abajo, no en una policy (evitaría duplicar la regla en dos lugares).

-- ----------------------------------------------------------------------------
-- crear_turno: el propio piloto pide (o confirma directo, si es
-- piloto_vinculado) un turno para sí mismo sobre una aeronave de la flota
-- de la organización.
-- ----------------------------------------------------------------------------
create or replace function crear_turno(
  p_org_id uuid, p_aeronave_id uuid, p_inicio timestamptz, p_fin timestamptz,
  p_instructor_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado text;
  v_turno_id uuid;
begin
  if not is_member_of(p_org_id) then
    raise exception 'No sos miembro de esta organización';
  end if;
  if p_fin <= p_inicio then
    raise exception 'El horario de fin tiene que ser posterior al de inicio';
  end if;
  if not exists (select 1 from aeronaves where id = p_aeronave_id and org_id = p_org_id) then
    raise exception 'Esa aeronave no pertenece a esta organización';
  end if;

  v_estado := case when is_member_of(p_org_id, array['piloto_vinculado']) then 'confirmado' else 'pendiente_autorizacion' end;

  begin
    insert into turnos (org_id, aeronave_id, instructor_id, piloto_user_id, estado, inicio, fin, creado_por)
    values (p_org_id, p_aeronave_id, p_instructor_id, auth.uid(), v_estado, p_inicio, p_fin, auth.uid())
    returning id into v_turno_id;
  exception when exclusion_violation then
    raise exception 'Ese horario ya está ocupado para esa aeronave';
  end;

  return v_turno_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- confirmar_turno / rechazar_turno: owner/admin resuelven un turno
-- pendiente de autorización.
-- ----------------------------------------------------------------------------
create or replace function confirmar_turno(p_turno_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select org_id into v_org_id from turnos where id = p_turno_id and estado = 'pendiente_autorizacion';
  if v_org_id is null then
    raise exception 'Ese turno no existe o ya fue resuelto';
  end if;
  if not is_member_of(v_org_id, array['owner', 'admin']) then
    raise exception 'No tenés permiso para autorizar turnos de esta organización';
  end if;

  begin
    update turnos set estado = 'confirmado', autorizado_por = auth.uid() where id = p_turno_id;
  exception when exclusion_violation then
    raise exception 'Ese horario ya fue ocupado por otro turno confirmado mientras tanto';
  end;
end;
$$;

create or replace function rechazar_turno(p_turno_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select org_id into v_org_id from turnos where id = p_turno_id and estado = 'pendiente_autorizacion';
  if v_org_id is null then
    raise exception 'Ese turno no existe o ya fue resuelto';
  end if;
  if not is_member_of(v_org_id, array['owner', 'admin']) then
    raise exception 'No tenés permiso para rechazar turnos de esta organización';
  end if;
  update turnos set estado = 'cancelado', autorizado_por = auth.uid() where id = p_turno_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- cancelar_turno: el propio piloto cancela su turno (confirmado o
-- pendiente), o lo cancela owner/admin (ej. la aeronave entró a taller).
-- ----------------------------------------------------------------------------
create or replace function cancelar_turno(p_turno_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_piloto_user_id uuid;
begin
  select org_id, piloto_user_id into v_org_id, v_piloto_user_id from turnos where id = p_turno_id and estado <> 'cancelado';
  if v_org_id is null then
    raise exception 'Ese turno no existe o ya está cancelado';
  end if;
  if v_piloto_user_id <> auth.uid() and not is_member_of(v_org_id, array['owner', 'admin']) then
    raise exception 'No tenés permiso para cancelar este turno';
  end if;
  update turnos set estado = 'cancelado' where id = p_turno_id;
end;
$$;

-- Fin de Fase 4 — turnos.
