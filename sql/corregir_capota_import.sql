-- ============================================================================
-- Corrige los 5 vuelos importados con instrumentos capota: el valor
-- correcto es el TOTAL del vuelo menos 0.3 hs (no 0.3 fijo).
-- Solo hace falta correr esto si ya habías corrido
-- agregar_vuelos_2025_2026.sql con el valor viejo. Es seguro correrlo
-- de nuevo (no rompe nada si ya está bien).
-- ============================================================================
do $$
declare
  v_user_id uuid;
begin
  select id into v_user_id from auth.users where email = 'fileretocambrafrancisco@gmail.com';
  if v_user_id is null then
    raise exception 'No se encontró un usuario con ese email';
  end if;

  update vuelos
  set instrumentos_capota = round(saero_dia_piloto - 0.3, 2)
  where user_id = v_user_id
    and observaciones = 'Importado (tabla de vuelos)'
    and finalidad_vuelo = 'INST'
    and fecha in ('2026-05-24', '2026-05-01', '2026-04-12', '2026-04-02', '2026-03-15');
end $$;
