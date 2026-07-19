-- ============================================================================
-- IMPORTACIÓN DE 23 REGISTROS (dic/2025 — jun/2026)
-- Usuario: fileretocambrafrancisco@gmail.com
--
-- 3 turnos de simulador (INST) — se cargan contra el ÚNICO simulador que
--   ya tenés en Aeronaves (si tenés más de uno, ajustá el subquery de
--   "v_sim_id" antes de correr esto).
-- 5 vuelos LOCAL con 0.3 hs de instrumentos capota (INST) — esas 0.3 hs
--   ya están incluidas dentro del tiempo total del vuelo, no se suman
--   aparte (regla del formato 290/2012).
-- 15 vuelos LOCAL/TRAVESIA restantes (ENTT).
-- Todos cargados como de día (según lo que confirmaste), 1 aterrizaje
-- cada uno, piloto al mando.
--
-- Correr una sola vez en el SQL Editor de Supabase.
-- ============================================================================
do $$
declare
  v_user_id uuid;
  v_sim_id uuid;
  v_s024 uuid;
  v_gqh uuid;
  v_s048 uuid;
  v_s114 uuid;
  v_s079 uuid;
begin
  select id into v_user_id from auth.users where email = 'fileretocambrafrancisco@gmail.com';
  if v_user_id is null then
    raise exception 'No se encontró un usuario con ese email';
  end if;

  select id into v_sim_id from aeronaves where user_id = v_user_id and es_simulador = true order by created_at limit 1;
  if v_sim_id is null then
    raise exception 'No se encontró ningún simulador cargado en Aeronaves';
  end if;

  select id into v_s024 from aeronaves where user_id = v_user_id and matricula = 'LV-S024';
  select id into v_gqh  from aeronaves where user_id = v_user_id and matricula = 'LV-GQH';
  select id into v_s048 from aeronaves where user_id = v_user_id and matricula = 'LV-S048';
  select id into v_s114 from aeronaves where user_id = v_user_id and matricula = 'LV-S114';
  select id into v_s079 from aeronaves where user_id = v_user_id and matricula = 'LV-S079';

  if v_s024 is null or v_gqh is null or v_s048 is null or v_s114 is null or v_s079 is null then
    raise exception 'Falta alguna aeronave (LV-S024 / LV-GQH / LV-S048 / LV-S114 / LV-S079) en tu ficha de Aeronaves';
  end if;

  -- ---- Simulador (INST) ----
  insert into vuelos (user_id, fecha, hora_salida_utc, hora_llegada_utc, desde, hasta, finalidad_vuelo, aeronave_id, adiestrador_simulador, observaciones)
  values
    (v_user_id, '2026-06-19', '19:00', '21:00', 'TERR', 'TERR', 'INST', v_sim_id, 2.0, 'Importado (tabla de vuelos, turno de simulador)'),
    (v_user_id, '2026-06-12', '21:00', '23:00', 'TERR', 'TERR', 'INST', v_sim_id, 2.0, 'Importado (tabla de vuelos, turno de simulador)'),
    (v_user_id, '2026-06-05', '21:30', '23:00', 'TERR', 'TERR', 'INST', v_sim_id, 1.5, 'Importado (tabla de vuelos, turno de simulador)');

  -- ---- LOCAL con 0.3 hs de instrumentos capota (INST) ----
  insert into vuelos (user_id, fecha, hora_salida_utc, hora_llegada_utc, desde, hasta, finalidad_vuelo, aeronave_id, saero_dia_piloto, aterrizajes_dia, instrumentos_capota, observaciones)
  values
    (v_user_id, '2026-05-24', '16:00', '17:30', 'SADF', 'SADF', 'INST', v_s024, 1.5, 1, 0.3, 'Importado (tabla de vuelos)'),
    (v_user_id, '2026-05-01', '11:30', '13:00', 'SADF', 'SADF', 'INST', v_s024, 1.5, 1, 0.3, 'Importado (tabla de vuelos)'),
    (v_user_id, '2026-04-12', '19:25', '20:30', 'SADM', 'SADM', 'INST', v_gqh,  1.1, 1, 0.3, 'Importado (tabla de vuelos)'),
    (v_user_id, '2026-04-02', '17:00', '18:15', 'SADM', 'SADM', 'INST', v_s048, 1.3, 1, 0.3, 'Importado (tabla de vuelos)'),
    (v_user_id, '2026-03-15', '19:45', '21:00', 'SADF', 'SADF', 'INST', v_s114, 1.3, 1, 0.3, 'Importado (tabla de vuelos)');

  -- ---- LOCAL restantes (ENTT) ----
  insert into vuelos (user_id, fecha, hora_salida_utc, hora_llegada_utc, desde, hasta, finalidad_vuelo, aeronave_id, saero_dia_piloto, aterrizajes_dia, observaciones)
  values
    (v_user_id, '2026-01-18', '22:15', '23:05', 'SADF', 'SADF', 'ENTT', v_s114, 0.8, 1, 'Importado (tabla de vuelos)'),
    (v_user_id, '2026-01-11', '11:10', '12:10', 'SADF', 'SADF', 'ENTT', v_s024, 1.0, 1, 'Importado (tabla de vuelos)');

  -- ---- Travesías (ENTT) ----
  insert into vuelos (user_id, fecha, hora_salida_utc, hora_llegada_utc, desde, hasta, finalidad_vuelo, aeronave_id, trav_dia_piloto, aterrizajes_dia, observaciones)
  values
    (v_user_id, '2026-03-01', '20:05', '20:35', 'SADM', 'SADF', 'ENTT', v_s114, 0.5, 1, 'Importado (tabla de vuelos)'),
    (v_user_id, '2026-02-28', '17:00', '18:30', 'SAZM', 'SAZV', 'ENTT', v_s114, 1.5, 1, 'Importado (tabla de vuelos)'),
    (v_user_id, '2026-02-28', '11:30', '14:30', 'SADM', 'SAZM', 'ENTT', v_s114, 3.0, 1, 'Importado (tabla de vuelos)'),
    (v_user_id, '2026-02-01', '20:50', '22:20', 'UCO',  'SADM', 'ENTT', v_s079, 1.5, 1, 'Importado (tabla de vuelos)'),
    (v_user_id, '2026-02-01', '18:15', '19:45', 'SADM', 'UCO',  'ENTT', v_s079, 1.5, 1, 'Importado (tabla de vuelos)'),
    (v_user_id, '2026-01-11', '17:00', '18:35', 'LDG',  'SADF', 'ENTT', v_s024, 1.6, 1, 'Importado (tabla de vuelos)'),
    (v_user_id, '2026-01-11', '15:10', '16:50', 'SADF', 'LDG',  'ENTT', v_s024, 1.7, 1, 'Importado (tabla de vuelos)'),
    (v_user_id, '2026-01-04', '21:00', '22:00', 'SRDS', 'SADF', 'ENTT', v_s024, 1.0, 1, 'Importado (tabla de vuelos)'),
    (v_user_id, '2026-01-04', '18:00', '19:00', 'SADF', 'SRDS', 'ENTT', v_s024, 1.0, 1, 'Importado (tabla de vuelos)'),
    (v_user_id, '2025-12-28', '21:40', '22:50', 'PED',  'SADF', 'ENTT', v_s114, 1.2, 1, 'Importado (tabla de vuelos)'),
    (v_user_id, '2025-12-28', '19:30', '20:30', 'SADF', 'PED',  'ENTT', v_s114, 1.0, 1, 'Importado (tabla de vuelos)'),
    (v_user_id, '2025-12-21', '21:30', '22:30', 'SRDS', 'SADF', 'ENTT', v_s114, 1.0, 1, 'Importado (tabla de vuelos)'),
    (v_user_id, '2025-12-21', '19:20', '20:20', 'SADF', 'SRDS', 'ENTT', v_s114, 1.0, 1, 'Importado (tabla de vuelos)');
end $$;
