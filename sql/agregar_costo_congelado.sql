-- ============================================================================
-- COSTO CONGELADO — deja "clavado" en cada vuelo el importe realmente
-- abonado, en pesos, al momento de cargarlo.
--
-- Motivo: una aeronave puede tener su tarifa por hora en dólares. Lo que se
-- pagó por ese vuelo fue el equivalente en pesos AL DÍA que se voló (dólar
-- blue, venta). Si el dólar sube o baja después, el gasto histórico no tiene
-- que moverse. Por eso guardamos el monto ya convertido a ARS (costo_congelado)
-- y la cotización usada (cotizacion_usada), en vez de recalcular siempre con
-- la tarifa × dólar de hoy.
--
-- Vuelos viejos (sin estos valores) siguen mostrando el costo calculado al
-- vuelo con la tarifa de la aeronave, como antes.
-- ============================================================================

alter table vuelos add column if not exists costo_congelado numeric(14,2);
alter table vuelos add column if not exists cotizacion_usada numeric(12,2);

comment on column vuelos.costo_congelado is
  'Importe abonado en ARS, congelado al momento de cargar el vuelo. NULL = vuelo viejo, se calcula al vuelo con la tarifa.';
comment on column vuelos.cotizacion_usada is
  'Dólar blue (venta) usado para convertir, si la aeronave cobra en USD. NULL si la tarifa ya estaba en ARS.';
