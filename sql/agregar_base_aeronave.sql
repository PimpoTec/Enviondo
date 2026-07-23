-- ============================================================================
-- BASE (AERÓDROMO) DE LA AERONAVE — dónde está guarada habitualmente (ej.
-- "SADF", "MOR", "FDO"). Opcional, solo aplica a aeronaves reales (no a
-- simuladores, que no tienen base física). Se muestra en la tarjeta de la
-- grilla de Aeronaves en el lugar donde antes iba la matrícula.
-- Correr en el SQL Editor de Supabase; seguro de correr una sola vez (y no
-- rompe nada si lo repetís).
-- ============================================================================

alter table aeronaves add column if not exists base_aerodromo text;
