-- ============================================================================
-- FASE 0 — CAPA DE ORGANIZACIONES (multi-tenant, aditivo)
-- ============================================================================
-- Agrega el concepto de "organización" (escuela de vuelo o empresa de
-- vuelos privados) por ENCIMA del modelo actual de piloto individual, sin
-- tocar ninguna tabla ni política existente de aeronaves/vuelos/perfil. Un
-- piloto que nunca crea ni se une a una organización no nota ningún cambio.
--
-- Esta es la base fundacional (Fase 0 del roadmap B2B): organizaciones +
-- membresías + roles. La flota de organización, turnos y despacho son
-- fases posteriores que se agregan en sus propios sql/agregar_*.sql,
-- reutilizando is_member_of() de acá.
--
-- Seguro de correr una sola vez, y seguro de volver a correr entero (usa
-- if not exists / or replace / drop policy if exists en todos lados).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ORGANIZACIONES
-- ----------------------------------------------------------------------------
create table if not exists organizaciones (
  id         uuid primary key default gen_random_uuid(),
  tipo       text not null check (tipo in ('escuela', 'empresa')),
  nombre     text not null,
  cuit       text,
  plan       text not null default 'trial',
  creado_por uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- ORGANIZACION_MIEMBROS: quién pertenece a qué organización y con qué rol.
-- 'invitado' = todavía no aceptó; el propio usuario pasa a 'activo' con
-- aceptar_invitacion(). 'suspendido' conserva el historial sin dar acceso.
-- ----------------------------------------------------------------------------
create table if not exists organizacion_miembros (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizaciones(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  rol        text not null check (rol in ('owner', 'admin', 'instructor', 'piloto_vinculado')),
  estado     text not null default 'invitado' check (estado in ('activo', 'invitado', 'suspendido')),
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create index if not exists idx_organizacion_miembros_org on organizacion_miembros(org_id);
create index if not exists idx_organizacion_miembros_user on organizacion_miembros(user_id);

-- ----------------------------------------------------------------------------
-- is_member_of: helper para políticas RLS de esta y futuras tablas de
-- organización (flota_org, turnos, vuelos_asignados, ...). p_roles=null
-- significa "cualquier rol, alcanza con ser miembro activo".
-- ----------------------------------------------------------------------------
create or replace function is_member_of(p_org_id uuid, p_roles text[] default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from organizacion_miembros m
    where m.org_id = p_org_id
      and m.user_id = (select auth.uid())
      and m.estado = 'activo'
      and (p_roles is null or m.rol = any(p_roles))
  );
$$;

alter table organizaciones        enable row level security;
alter table organizacion_miembros enable row level security;

-- SELECT: cualquier miembro activo ve la organización; el creador la ve
-- aunque todavía no exista la fila de membresía (no debería pasar, la crea
-- crear_organizacion() en la misma transacción, pero es una red de
-- contención barata).
drop policy if exists "organizaciones_select_miembro" on organizaciones;
create policy "organizaciones_select_miembro" on organizaciones for select
  using (is_member_of(id) or creado_por = (select auth.uid()));

-- UPDATE: owner/admin. No hay política de INSERT/DELETE directa a
-- propósito — se crean solo vía crear_organizacion() (security definer,
-- corre con privilegios de servidor) para no dejar huérfana una
-- organización sin su fila de owner en organizacion_miembros.
drop policy if exists "organizaciones_update_owner_admin" on organizaciones;
create policy "organizaciones_update_owner_admin" on organizaciones for update
  using (is_member_of(id, array['owner', 'admin']));

-- organizacion_miembros: cada usuario ve sus propias filas (incluidas
-- invitaciones pendientes) y, si es owner/admin de esa organización, ve
-- también las de sus compañeros (para poder gestionarlos).
drop policy if exists "organizacion_miembros_select" on organizacion_miembros;
create policy "organizacion_miembros_select" on organizacion_miembros for select
  using (user_id = (select auth.uid()) or is_member_of(org_id, array['owner', 'admin']));

-- Sin políticas de INSERT/UPDATE/DELETE directas: todo pasa por las
-- funciones de abajo, que validan el rol de quien llama antes de tocar la
-- tabla (evita que un miembro se autoasigne 'owner' escribiendo la fila a
-- mano).

-- ----------------------------------------------------------------------------
-- crear_organizacion: crea la organización y, en la misma transacción, la
-- fila de membresía 'owner' de quien la crea. Devuelve el id nuevo.
-- ----------------------------------------------------------------------------
create or replace function crear_organizacion(p_nombre text, p_tipo text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if p_tipo not in ('escuela', 'empresa') then
    raise exception 'Tipo de organización inválido: %', p_tipo;
  end if;
  insert into organizaciones (tipo, nombre, creado_por)
  values (p_tipo, p_nombre, auth.uid())
  returning id into v_org_id;

  insert into organizacion_miembros (org_id, user_id, rol, estado)
  values (v_org_id, auth.uid(), 'owner', 'activo');

  return v_org_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- invitar_miembro: owner/admin invita a un piloto YA REGISTRADO en la app
-- por su email (no crea cuentas nuevas). Queda en estado 'invitado' hasta
-- que el piloto la acepta desde su propio perfil.
-- ----------------------------------------------------------------------------
create or replace function invitar_miembro(p_org_id uuid, p_email text, p_rol text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_miembro_id uuid;
begin
  if not is_member_of(p_org_id, array['owner', 'admin']) then
    raise exception 'No tenés permiso para invitar miembros a esta organización';
  end if;
  if p_rol not in ('admin', 'instructor', 'piloto_vinculado') then
    raise exception 'Rol inválido para invitación: %', p_rol;
  end if;

  select id into v_user_id from auth.users where lower(email) = lower(p_email);
  if v_user_id is null then
    raise exception 'No hay ninguna cuenta registrada con ese email todavía';
  end if;

  insert into organizacion_miembros (org_id, user_id, rol, estado)
  values (p_org_id, v_user_id, p_rol, 'invitado')
  on conflict (org_id, user_id) do update
    set rol = excluded.rol, estado = 'invitado'
  returning id into v_miembro_id;

  return v_miembro_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- aceptar_invitacion / rechazar_invitacion: el propio piloto resuelve su
-- invitación pendiente. Rechazar borra la fila (no deja un 'suspendido'
-- fantasma de algo que nunca llegó a aceptar).
-- ----------------------------------------------------------------------------
create or replace function aceptar_invitacion(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update organizacion_miembros
  set estado = 'activo'
  where org_id = p_org_id and user_id = auth.uid() and estado = 'invitado';
  if not found then
    raise exception 'No tenés una invitación pendiente para esta organización';
  end if;
end;
$$;

create or replace function rechazar_invitacion(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from organizacion_miembros
  where org_id = p_org_id and user_id = auth.uid() and estado = 'invitado';
end;
$$;

-- ----------------------------------------------------------------------------
-- salir_organizacion: un miembro deja la organización por su cuenta. El
-- owner no puede salir por acá (evita dejar la organización sin dueño) —
-- primero tiene que transferir el rol a otro miembro.
-- ----------------------------------------------------------------------------
create or replace function salir_organizacion(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if is_member_of(p_org_id, array['owner']) then
    raise exception 'El owner no puede salir de la organización — transferí la titularidad primero';
  end if;
  delete from organizacion_miembros
  where org_id = p_org_id and user_id = auth.uid();
end;
$$;

-- ----------------------------------------------------------------------------
-- quitar_miembro: owner/admin da de baja a otro miembro. No se puede dar
-- de baja al owner por acá (mismo motivo que salir_organizacion).
-- ----------------------------------------------------------------------------
create or replace function quitar_miembro(p_org_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_member_of(p_org_id, array['owner', 'admin']) then
    raise exception 'No tenés permiso para dar de baja miembros de esta organización';
  end if;
  delete from organizacion_miembros
  where org_id = p_org_id and user_id = p_user_id and rol <> 'owner';
end;
$$;

-- Fin de Fase 0 — capa fundacional de organizaciones.
