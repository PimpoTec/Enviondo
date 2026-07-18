-- ============================================================================
-- Vuelo faltante del libro en papel (hoja 14, fila 12) — fecha confirmada
-- por el piloto: 17/11/2025. Aeronave LV-S024, ya cargada por el import
-- anterior. Correr una sola vez en el SQL Editor de Supabase.
-- ============================================================================
do $$
declare
  v_user_id uuid;
begin
  select id into v_user_id from auth.users where email = 'fileretocambrafrancisco@gmail.com';
  if v_user_id is null then
    raise exception 'No se encontró un usuario con ese email';
  end if;

  insert into vuelos (
    user_id, fecha, desde, hasta, finalidad_vuelo, aeronave_id,
    saero_dia_piloto, aterrizajes_dia, observaciones
  ) values (
    v_user_id, '2025-11-17', 'FDO', 'FDO', 'local',
    (select id from aeronaves where user_id = v_user_id and matricula = 'LV-S024'),
    1.2, 1,
    'Importado del libro papel (hoja 14, fila 12) — fecha confirmada a mano por el piloto (faltaba en el excel)'
  );
end $$;
