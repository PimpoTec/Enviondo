-- ============================================================================
-- APROBACIÓN DE ORGANIZACIONES — nadie queda operativo solo por tocar
-- "Crear organización".
-- ============================================================================
-- Depende de sql/agregar_organizaciones.sql, agregar_flota_org.sql,
-- agregar_instructores.sql y agregar_turnos.sql (actualiza políticas de
-- las tres últimas).
--
-- Hasta acá, cualquier piloto logueado podía crear una organización y
-- quedaba 100% operativa al instante (flota, instructores, turnos). Esto
-- agrega un estado de aprobación: crear_organizacion() sigue abierta a
-- cualquier piloto (es un pedido, no un alta), pero la organización nace
-- 'pendiente_aprobacion' y en ese estado NO puede cargar flota, dar de
-- alta instructores ni reservar/asignar turnos — solo lo puede activar la
-- cuenta admin de la app (la misma de is_licencias_admin(), hardcodeada
-- a un solo email — no una tabla de roles nueva, aunque el nombre de la
-- función diga "licencias": es el mismo dueño de cuenta único que ya
-- existe en el proyecto, reutilizado acá en vez de duplicarlo).
--
-- Seguro de correr una sola vez, y seguro de volver a correr entero.
-- ============================================================================

alter table organizaciones add column if not exists estado text not null default 'pendiente_aprobacion'
  check (estado in ('pendiente_aprobacion', 'activa', 'suspendida', 'rechazada'));

create or replace function organizacion_activa(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select estado = 'activa' from organizaciones where id = p_org_id), false);
$$;

-- La cuenta admin de la app también tiene que poder VER todas las
-- organizaciones (incluidas las pendientes de aprobar) para el panel de
-- Perfil → Preferencias → Admin — política aditiva, no reemplaza la que
-- ya tenían los miembros.
drop policy if exists "organizaciones_select_admin_app" on organizaciones;
create policy "organizaciones_select_admin_app" on organizaciones for select
  using (is_licencias_admin());

-- ----------------------------------------------------------------------------
-- aprobar_organizacion / rechazar_organizacion / suspender_organizacion /
-- reactivar_organizacion: únicas puertas para cambiar el estado — todas
-- exigen ser la cuenta admin de la app.
-- ----------------------------------------------------------------------------
create or replace function aprobar_organizacion(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_licencias_admin() then
    raise exception 'Solo la cuenta admin de la app puede aprobar organizaciones';
  end if;
  update organizaciones set estado = 'activa' where id = p_org_id;
end;
$$;

create or replace function rechazar_organizacion(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_licencias_admin() then
    raise exception 'Solo la cuenta admin de la app puede rechazar organizaciones';
  end if;
  update organizaciones set estado = 'rechazada' where id = p_org_id;
end;
$$;

create or replace function suspender_organizacion(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_licencias_admin() then
    raise exception 'Solo la cuenta admin de la app puede suspender organizaciones';
  end if;
  update organizaciones set estado = 'suspendida' where id = p_org_id;
end;
$$;

create or replace function reactivar_organizacion(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_licencias_admin() then
    raise exception 'Solo la cuenta admin de la app puede reactivar organizaciones';
  end if;
  update organizaciones set estado = 'activa' where id = p_org_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- Flota de organización: solo se puede leer/cargar/editar/borrar mientras
-- la organización está 'activa'. Mismo nombre de policy que ya existía
-- (agregar_flota_org.sql) — se reemplaza, no se duplica.
-- ----------------------------------------------------------------------------
drop policy if exists "aeronaves_select_org" on aeronaves;
drop policy if exists "aeronaves_insert_org" on aeronaves;
drop policy if exists "aeronaves_update_org" on aeronaves;
drop policy if exists "aeronaves_delete_org" on aeronaves;

create policy "aeronaves_select_org" on aeronaves for select
  using (org_id is not null and is_member_of(org_id) and organizacion_activa(org_id));
create policy "aeronaves_insert_org" on aeronaves for insert
  with check (org_id is not null and user_id is null and is_member_of(org_id, array['owner', 'admin']) and organizacion_activa(org_id));
create policy "aeronaves_update_org" on aeronaves for update
  using (org_id is not null and is_member_of(org_id, array['owner', 'admin']) and organizacion_activa(org_id));
create policy "aeronaves_delete_org" on aeronaves for delete
  using (org_id is not null and is_member_of(org_id, array['owner', 'admin']) and organizacion_activa(org_id));

-- ----------------------------------------------------------------------------
-- Instructores: mismo criterio.
-- ----------------------------------------------------------------------------
drop policy if exists "instructores_select" on instructores;
drop policy if exists "instructores_insert" on instructores;
drop policy if exists "instructores_update" on instructores;
drop policy if exists "instructores_delete" on instructores;

create policy "instructores_select" on instructores for select
  using (is_member_of(org_id) and organizacion_activa(org_id));
create policy "instructores_insert" on instructores for insert
  with check (
    is_member_of(org_id, array['owner', 'admin']) and organizacion_activa(org_id)
    and exists (
      select 1 from organizacion_miembros m
      where m.org_id = org_id and m.user_id = user_id and m.rol = 'instructor' and m.estado = 'activo'
    )
  );
create policy "instructores_update" on instructores for update
  using (is_member_of(org_id, array['owner', 'admin']) and organizacion_activa(org_id));
create policy "instructores_delete" on instructores for delete
  using (is_member_of(org_id, array['owner', 'admin']) and organizacion_activa(org_id));

-- ----------------------------------------------------------------------------
-- Turnos: la policy de SELECT es RLS de verdad (el cliente lee la tabla
-- directo), pero crear_turno/confirmar_turno son funciones security
-- definer que NO pasan por RLS — el chequeo de "organización activa"
-- tiene que estar adentro de la función, no alcanza con la policy.
-- ----------------------------------------------------------------------------
drop policy if exists "turnos_select" on turnos;
create policy "turnos_select" on turnos for select
  using (is_member_of(org_id) and organizacion_activa(org_id));

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
  if not organizacion_activa(p_org_id) then
    raise exception 'Esta organización todavía no fue aprobada por el admin de la app';
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

-- Fin — aprobación de organizaciones.
