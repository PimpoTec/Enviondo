-- ============================================================================
-- CAMBIO DE MODELO — solo la cuenta admin de la app puede crear
-- organizaciones (escuelas/empresas), asignando el owner por email desde
-- el momento de la creación.
-- ============================================================================
-- Depende de sql/agregar_organizaciones.sql y
-- agregar_aprobacion_organizaciones.sql (is_licencias_admin(),
-- organizaciones.estado).
--
-- Antes, cualquier piloto logueado podía crear su propia organización
-- (quedaba pendiente_aprobacion hasta que el admin la aprobaba). Ahora eso
-- se cierra del todo: crear_organizacion(nombre, tipo) — el self-service —
-- se elimina. La única puerta de entrada es
-- crear_organizacion_para_email(nombre, tipo, owner_email), que exige ser
-- la cuenta admin de la app y que recibe el email de quien va a ser el
-- owner. La organización nace 'activa' directo (el admin la crea a
-- propósito, no hace falta un paso de aprobación aparte).
--
-- Si `owner_email` no tiene cuenta registrada todavía, esta función lanza
-- una excepción con el prefijo 'NO_EXISTE_CUENTA:' — la Edge Function
-- `crear-organizacion` (que es quien de verdad llama a esto, nunca el
-- cliente directo) usa ese prefijo como señal para invitar a esa persona
-- por mail (admin.auth.admin.inviteUserByEmail, necesita la service_role
-- key) y reintentar. Acá en SQL no se puede mandar mails.
--
-- Las organizaciones que ya existían creadas por el modelo viejo (self
-- service, quedaron pendiente_aprobacion) NO se tocan — el admin las sigue
-- pudiendo aprobar/rechazar/suspender desde el panel existente.
--
-- Seguro de correr una sola vez, y seguro de volver a correr entero.
-- ============================================================================

drop function if exists crear_organizacion(text, text);

create or replace function crear_organizacion_para_email(p_nombre text, p_tipo text, p_owner_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_owner_user_id uuid;
begin
  if not is_licencias_admin() then
    raise exception 'Solo la cuenta admin de la app puede crear organizaciones';
  end if;
  if p_tipo not in ('escuela', 'empresa') then
    raise exception 'Tipo de organización inválido: %', p_tipo;
  end if;
  if trim(coalesce(p_nombre, '')) = '' then
    raise exception 'El nombre es obligatorio';
  end if;

  select id into v_owner_user_id from auth.users where lower(email) = lower(p_owner_email);
  if v_owner_user_id is null then
    raise exception 'NO_EXISTE_CUENTA: %', p_owner_email;
  end if;

  insert into organizaciones (tipo, nombre, creado_por, estado)
  values (p_tipo, trim(p_nombre), auth.uid(), 'activa')
  returning id into v_org_id;

  insert into organizacion_miembros (org_id, user_id, rol, estado)
  values (v_org_id, v_owner_user_id, 'owner', 'activo')
  on conflict (org_id, user_id) do nothing;

  return v_org_id;
end;
$$;

-- Fin — creación de organizaciones restringida al admin.
