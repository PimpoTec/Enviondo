-- ============================================================================
-- ENCUADRE DE LA FOTO DE AERONAVE — la miniatura de la tarjeta es una tira
-- ancha y baja; con fotos verticales u horizontales de cualquier tamaño,
-- el recorte automático (centrado) a veces corta justo la parte
-- importante (ej. deja ver solo el cielo y el timón). Este campo guarda
-- en qué % vertical de la foto centrar el recorte (0 = arriba, 100 =
-- abajo, 50 = centro, default), ajustable con un control en la propia
-- ficha — no es necesario volver a subir la foto para corregir el encuadre.
-- Correr en el SQL Editor de Supabase; seguro de correr una sola vez (y no
-- rompe nada si lo repetís).
-- ============================================================================

alter table aeronaves add column if not exists foto_posicion integer not null default 50;
alter table aeronaves drop constraint if exists aeronaves_foto_posicion_check;
alter table aeronaves add constraint aeronaves_foto_posicion_check check (foto_posicion between 0 and 100);
