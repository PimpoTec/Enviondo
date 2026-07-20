-- ============================================================================
-- TIPO DE VUELO (opcional) en vuelos programados — para que la tarjeta de
-- "Próximo vuelo" pueda mostrar algo más específico que Local/Travesía
-- cuando el piloto lo elige (ej. Instrucción, Nocturno, Examen). Si no se
-- elige nada, la tarjeta sigue mostrando Local/Travesía como antes.
-- ============================================================================

alter table vuelos_programados add column if not exists tipo_vuelo text;
