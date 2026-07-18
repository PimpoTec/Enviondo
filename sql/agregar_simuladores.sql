-- ============================================================================
-- Agrega el soporte de "simuladores" (adiestrador terrestre) como un tipo
-- de aeronave aparte, con ficha simplificada. Correr en el SQL Editor de
-- Supabase; seguro de correr una sola vez (y no rompe nada si lo repetís).
-- ============================================================================
alter table aeronaves add column if not exists es_simulador boolean not null default false;
alter table aeronaves drop constraint if exists aeronaves_clase_check;
alter table aeronaves add constraint aeronaves_clase_check
  check (clase in ('monomotor', 'multimotor', 'reactor', 'turbohelice', 'aeroaplicador', 'simulador'));
