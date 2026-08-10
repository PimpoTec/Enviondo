-- ============================================================================
-- CORRECCIÓN — un piloto recién invitado a una organización no podía ver
-- ni el nombre de la organización que lo invitó.
-- ============================================================================
-- Bug: "organizaciones_select_miembro" (sql/agregar_organizaciones.sql)
-- usaba is_member_of(id), que exige estado = 'activo'. Alguien con una
-- invitación pendiente (estado = 'invitado', todavía no la aceptó) no
-- pasaba ese chequeo, así que el join embebido `organizaciones(...)` que
-- hace js/db.js Repo.listarMisOrganizaciones() volvía null para su fila —
-- y la vista rompía con "Cannot read properties of null (reading
-- 'nombre')" justo en la pantalla que le tendría que mostrar la
-- invitación para poder aceptarla o rechazarla.
--
-- Corrección: cualquiera con una fila en organizacion_miembros para esa
-- organización (sea cual sea su estado — invitado, activo o suspendido)
-- puede ver el nombre/tipo/plan de la organización. No expone nada
-- sensible (cuit sigue sin ser un campo que nadie más necesite leer) y es
-- necesario para que la pantalla de "invitaciones pendientes" funcione.
--
-- Seguro de correr una sola vez, y seguro de volver a correr entero.
-- ============================================================================

-- (La cuenta admin de la app ya puede ver todas via la política aditiva
-- "organizaciones_select_admin_app" de agregar_aprobacion_organizaciones.sql
-- — no hace falta repetir ese chequeo acá.)
--
-- OJO con "m.org_id = id" a secas: organizacion_miembros TAMBIÉN tiene su
-- propia columna `id` (su primary key), así que un `id` sin calificar
-- adentro del EXISTS se resuelve contra la tabla de la subconsulta (m.id),
-- no contra `organizaciones.id` de la tabla externa — quedaba comparando
-- "m.org_id = m.id", una condición casi siempre falsa, así que la política
-- en la práctica no dejaba ver nada. Hay que calificar `organizaciones.id`
-- explícitamente.
drop policy if exists "organizaciones_select_miembro" on organizaciones;
create policy "organizaciones_select_miembro" on organizaciones for select
  using (
    exists (
      select 1 from organizacion_miembros m
      where m.org_id = organizaciones.id and m.user_id = (select auth.uid())
    )
    or creado_por = (select auth.uid())
  );
