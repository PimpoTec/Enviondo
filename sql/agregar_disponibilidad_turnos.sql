-- ============================================================================
-- DISPONIBILIDAD DE TURNOS — el owner/admin de una escuela define qué días,
-- en qué horario y en bloques de cuántos minutos se puede reservar un
-- turno. Antes de esto, un piloto podía elegir cualquier inicio/fin a mano
-- (solo lo frenaba el anti doble-booking); esto acota la grilla que
-- muestra la pantalla de Turnos a los horarios que la escuela realmente
-- opera.
-- ============================================================================
-- Depende de sql/agregar_organizaciones.sql y agregar_turnos.sql.
--
-- Una sola fila por organización (no hace falta más de un horario "por
-- defecto" — si una escuela quisiera horarios distintos por aeronave, es
-- una fase futura, no la de acá). Sin fila todavía = la escuela no
-- configuró nada aún; la pantalla de Turnos se lo hace notar al owner/admin
-- y mientras tanto no deja reservar (evita que alguien reserve "a mano"
-- fuera de cualquier horario pensado).
--
-- Seguro de correr una sola vez, y seguro de volver a correr entero.
-- ============================================================================

create table if not exists disponibilidad_turnos (
  org_id                   uuid primary key references organizaciones(id) on delete cascade,
  dias_semana              smallint[] not null default '{1,2,3,4,5}', -- 0=domingo .. 6=sábado (Date#getDay())
  hora_inicio              time not null default '08:00',
  hora_fin                 time not null default '20:00',
  duracion_bloque_minutos  integer not null default 60,
  updated_at               timestamptz not null default now(),
  check (hora_fin > hora_inicio),
  check (duracion_bloque_minutos > 0)
);

alter table disponibilidad_turnos enable row level security;

-- Cualquier miembro de la organización necesita ver el horario para poder
-- reservar — no es un dato sensible.
drop policy if exists "disponibilidad_turnos_select" on disponibilidad_turnos;
create policy "disponibilidad_turnos_select" on disponibilidad_turnos for select
  using (is_member_of(org_id) and organizacion_activa(org_id));

-- Sin políticas de INSERT/UPDATE directas: solo a través de la función de
-- abajo, que valida el rol de quien llama.
create or replace function guardar_disponibilidad_turnos(
  p_org_id uuid, p_dias_semana smallint[], p_hora_inicio time, p_hora_fin time, p_duracion_bloque_minutos integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_member_of(p_org_id, array['owner', 'admin']) then
    raise exception 'No tenés permiso para configurar la disponibilidad de esta organización';
  end if;
  if p_hora_fin <= p_hora_inicio then
    raise exception 'El horario de cierre tiene que ser posterior al de apertura';
  end if;
  if p_duracion_bloque_minutos <= 0 then
    raise exception 'La duración del bloque tiene que ser mayor a cero';
  end if;
  if array_length(p_dias_semana, 1) is null then
    raise exception 'Elegí al menos un día de la semana';
  end if;

  insert into disponibilidad_turnos (org_id, dias_semana, hora_inicio, hora_fin, duracion_bloque_minutos, updated_at)
  values (p_org_id, p_dias_semana, p_hora_inicio, p_hora_fin, p_duracion_bloque_minutos, now())
  on conflict (org_id) do update set
    dias_semana = excluded.dias_semana,
    hora_inicio = excluded.hora_inicio,
    hora_fin = excluded.hora_fin,
    duracion_bloque_minutos = excluded.duracion_bloque_minutos,
    updated_at = now();
end;
$$;

-- ----------------------------------------------------------------------------
-- crear_turno: se suma la validación de que el horario pedido cae DENTRO
-- de la disponibilidad configurada (día de semana + franja horaria) — si
-- la escuela todavía no configuró nada, no se puede reservar (mensaje
-- claro en vez de dejar reservar en cualquier horario).
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
  v_disp disponibilidad_turnos%rowtype;
  v_dia_semana int;
begin
  if not is_member_of(p_org_id) then
    raise exception 'No sos miembro de esta organización';
  end if;
  if not organizacion_activa(p_org_id) then
    raise exception 'Esta organización todavía no fue aprobada por el admin de la app';
  end if;
  if p_fin <= p_inicio then
    raise exception 'El horario de fin tiene que ser posterior al de inicio';
  end if;
  if not exists (select 1 from aeronaves where id = p_aeronave_id and org_id = p_org_id) then
    raise exception 'Esa aeronave no pertenece a esta organización';
  end if;

  select * into v_disp from disponibilidad_turnos where org_id = p_org_id;
  if v_disp.org_id is null then
    raise exception 'Esta escuela todavía no configuró su horario de turnos';
  end if;
  -- hora_inicio/hora_fin/dias_semana se piensan en hora LOCAL de la
  -- escuela (Argentina, sin horario de verano) — p_inicio/p_fin llegan en
  -- UTC (timestamptz), hay que convertirlos antes de comparar, si no un
  -- turno de las 8am locales se compararía contra las 11am UTC y todo el
  -- rango quedaría corrido.
  v_dia_semana := extract(dow from p_inicio at time zone 'America/Argentina/Buenos_Aires');
  if not (v_dia_semana = any(v_disp.dias_semana)) then
    raise exception 'Ese día no está habilitado para reservar turnos';
  end if;
  if (p_inicio at time zone 'America/Argentina/Buenos_Aires')::time < v_disp.hora_inicio
     or (p_fin at time zone 'America/Argentina/Buenos_Aires')::time > v_disp.hora_fin then
    raise exception 'Ese horario está fuera del rango habilitado (% a %)', v_disp.hora_inicio, v_disp.hora_fin;
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

-- Fin — disponibilidad de turnos.
