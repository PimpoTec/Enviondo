-- ============================================================================
-- DATOS DEL PILOTO — para completar la cabecera de la Hoja de Libro de Vuelo
-- (Res. ANAC 290/2012): Apellido y Nombre, Licencia, Nº de licencia y Legajo.
-- Se cargan una vez en el Perfil y se vuelcan solos en cada hoja exportada.
-- ============================================================================

alter table perfil_piloto add column if not exists nombre_completo   text;
alter table perfil_piloto add column if not exists licencia          text;
alter table perfil_piloto add column if not exists licencia_numero   text;
alter table perfil_piloto add column if not exists legajo            text;
