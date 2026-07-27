-- ============================================================================
-- TRACK GPS REAL DEL VUELO (opcional) — guarda el recorrido efectivamente
-- volado (lista de puntos [lat, lon]), a partir del archivo .kml que se
-- puede descargar de FlightRadar24 para un vuelo con transponder ADS-B.
-- Se parsea del lado del cliente al cargar/editar el vuelo (no hace falta
-- ningún servicio externo ni Storage) y se guarda ya como puntos,
-- muestreados a un máximo de 500 para no inflar la fila con un track de
-- miles de posiciones.
-- Correr en el SQL Editor de Supabase; seguro de correr una sola vez (y no
-- rompe nada si lo repetís).
-- ============================================================================

alter table vuelos add column if not exists ruta_track jsonb;
