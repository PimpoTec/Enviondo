-- ============================================================================
-- NOMBRES DE PILOTOS PARA LA GRILLA DE TURNOS — la grilla de Turnos
-- (js/views/escuela.js) necesita mostrar el nombre de quién reservó cada
-- bloque, no solo su ID. `perfil_piloto` (con la columna `nombre_completo`,
-- ver sql/agregar_datos_piloto.sql) solo se puede leer la fila propia
-- (política "perfil_piloto_select_own" de sql/schema.sql) — a propósito,
-- porque esa tabla también tiene licencia/legajo/datos que no son de
-- exponer a cualquier compañero de organización.
--
-- En vez de abrir una política de RLS de más columnas de las necesarias,
-- esta función expone SOLO nombre_completo, y solo para los user_id que
-- pide quien llama Y que además comparten con él una organización activa
-- (evita que cualquier usuario logueado pueda pedir el nombre de cualquier
-- otro con solo saber su UUID).
--
-- Depende de sql/agregar_organizaciones.sql (is_member_of) y
-- sql/agregar_datos_piloto.sql (perfil_piloto.nombre_completo).
--
-- Seguro de correr una sola vez, y seguro de volver a correr entero.
-- ============================================================================

create or replace function nombres_pilotos_org(p_org_id uuid, p_user_ids uuid[])
returns table(user_id uuid, nombre_completo text)
language sql
stable
security definer
set search_path = public
as $$
  select pp.user_id, pp.nombre_completo
  from perfil_piloto pp
  where is_member_of(p_org_id)
    and pp.user_id = any(p_user_ids)
    and exists (
      select 1 from organizacion_miembros om
      where om.org_id = p_org_id and om.user_id = pp.user_id and om.estado = 'activo'
    );
$$;

grant execute on function nombres_pilotos_org(uuid, uuid[]) to authenticated;

-- Fin — nombres de pilotos para la grilla de turnos.
