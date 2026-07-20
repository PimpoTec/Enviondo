-- ============================================================================
-- Actualiza tarifas de LV-HQO, LV-S024, LV-S048 (ya existentes) a
-- 20500 día / 235000 noche, y da de alta LV-S079, LV-S100, LV-S114
-- (modelo ECHO, monomotor, terrestre) con la misma tarifa. Correr en el
-- SQL Editor de Supabase; seguro de correr más de una vez (no duplica).
-- ============================================================================
do $$
declare
  v_user_id uuid;
begin
  select id into v_user_id from auth.users where email = 'fileretocambrafrancisco@gmail.com';
  if v_user_id is null then
    raise exception 'No se encontró el usuario';
  end if;

  update aeronaves
    set tarifa_hora_diurna = 20500, tarifa_hora_nocturna = 235000
    where user_id = v_user_id and matricula in ('LV-HQO', 'LV-S024', 'LV-S048');

  insert into aeronaves (user_id, matricula, marca_modelo, clase, medio, tarifa_hora_diurna, tarifa_hora_nocturna, moneda, es_habitual, es_simulador)
    select v_user_id, m, 'ECHO', 'monomotor', 'terrestre', 20500, 235000, 'ARS', false, false
    from unnest(array['LV-S079', 'LV-S100', 'LV-S114']) as m
    where not exists (
      select 1 from aeronaves where user_id = v_user_id and matricula = m
    );
end $$;
