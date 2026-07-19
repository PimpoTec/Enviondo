-- ============================================================================
-- Agrega el curso "PCA + HVI" (Piloto Comercial con Habilitación de Vuelo
-- por Instrumentos, RAAC 61.315 + 61.620) y el campo para que cada piloto
-- elija su reparto de instrumentos real/simulador. Correr en el SQL
-- Editor de Supabase; seguro de correr una sola vez.
-- ============================================================================
alter table perfil_piloto drop constraint if exists perfil_piloto_curso_activo_check;
alter table perfil_piloto add constraint perfil_piloto_curso_activo_check
  check (curso_activo in ('APPL', 'PPA', 'PCA', 'PCA_HVI', 'TLA'));
alter table perfil_piloto add column if not exists hvi_sim_horas numeric(5,2);

alter table licencias_requisitos drop constraint if exists licencias_requisitos_curso_id_check;
alter table licencias_requisitos add constraint licencias_requisitos_curso_id_check
  check (curso_id in ('APPL', 'PPA', 'PCA', 'PCA_HVI', 'TLA'));

insert into licencias_requisitos (curso_id, nombre_requisito, minimo_horas, orden) values
  ('PCA_HVI', 'total', 200, 1),
  ('PCA_HVI', 'pic', 100, 2),
  ('PCA_HVI', 'travesia_pic', 50, 3),
  ('PCA_HVI', 'instrumentos', 40, 4),
  ('PCA_HVI', 'nocturnas', 5, 5),
  ('PCA_HVI', 'aterrizajes_noche', 5, 6)
on conflict (curso_id, nombre_requisito) do nothing;
