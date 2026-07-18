-- ============================================================================
-- Corrige los códigos de "finalidad del vuelo" para que muestren INST, ADAP,
-- REDAP, EXA, ENTT o VP tal cual se usan en la escuela, en vez de las
-- categorías genéricas viejas (instruccion/verificacion/adiestramiento/etc).
-- Seguro de correr una sola vez (y no rompe nada si lo corrés de nuevo).
-- ============================================================================

alter table vuelos drop constraint if exists vuelos_finalidad_vuelo_check;

-- Los vuelos importados del libro en papel tienen el código original
-- guardado en "observaciones" (ej. "...finalidad original: ENTT"). Lo
-- recuperamos de ahí.
update vuelos
set finalidad_vuelo = upper(trim(substring(observaciones from 'finalidad original:\s*([A-Za-z]*)')))
where observaciones ~ 'finalidad original:\s*[A-Za-z]+';

-- Categorías genéricas viejas que hayan quedado sin código original -> el
-- código nuevo más parecido.
update vuelos set finalidad_vuelo = 'INST' where finalidad_vuelo = 'instruccion';
update vuelos set finalidad_vuelo = 'EXA'  where finalidad_vuelo = 'verificacion';
update vuelos set finalidad_vuelo = 'ENTT' where finalidad_vuelo in ('local', 'travesia', 'trabajo_aereo', 'adiestramiento');
update vuelos set finalidad_vuelo = 'ENTT' where finalidad_vuelo not in ('INST', 'ADAP', 'REDAP', 'EXA', 'ENTT', 'VP');

alter table vuelos alter column finalidad_vuelo set default 'INST';
alter table vuelos add constraint vuelos_finalidad_vuelo_check
  check (finalidad_vuelo in ('INST', 'ADAP', 'REDAP', 'EXA', 'ENTT', 'VP'));
