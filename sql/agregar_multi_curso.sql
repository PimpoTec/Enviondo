-- ============================================================================
-- Permite tener más de un curso/habilitación activo a la vez (ej. PCA +
-- Habilitación de Vuelo Nocturno en paralelo), y agrega la Habilitación de
-- Vuelo Nocturno (HAB_NOC) como curso nuevo. Correr en el SQL Editor de
-- Supabase; seguro de correr una sola vez.
-- ============================================================================
alter table perfil_piloto drop constraint if exists perfil_piloto_curso_activo_check;
alter table perfil_piloto add constraint perfil_piloto_curso_activo_check
  check (curso_activo in ('APPL', 'PPA', 'PCA', 'PCA_HVI', 'TLA', 'HAB_NOC'));

alter table perfil_piloto add column if not exists cursos_activos text[] not null default '{}';
-- Migra a todos los que ya tenían un curso activo (single) al array nuevo,
-- para no perder el dato de nadie que ya venía usando la app.
update perfil_piloto set cursos_activos = array[curso_activo]
  where cursos_activos = '{}' and curso_activo is not null;

alter table licencias_requisitos drop constraint if exists licencias_requisitos_curso_id_check;
alter table licencias_requisitos add constraint licencias_requisitos_curso_id_check
  check (curso_id in ('APPL', 'PPA', 'PCA', 'PCA_HVI', 'TLA', 'HAB_NOC'));

-- Habilitación de Vuelo Nocturno: 3 hs nocturnas — para quienes sacaron el
-- PPA antes de que la habilitación viniera incluida en la RAAC vigente.
insert into licencias_requisitos (curso_id, nombre_requisito, minimo_horas, orden) values
  ('HAB_NOC', 'nocturnas', 3, 1)
on conflict (curso_id, nombre_requisito) do nothing;
