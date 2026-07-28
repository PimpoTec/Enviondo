-- ============================================================================
-- Libro de Vuelo — Esquema Supabase (PostgreSQL)
-- Formato Hoja de Libro de Vuelo de Pilotos, Res. ANAC 290/2012
-- ============================================================================
-- Corré este archivo entero en el SQL Editor de tu proyecto Supabase
-- (Dashboard > SQL Editor > New query > pegar > Run).
-- Es idempotente: podés volver a correrlo sin romper nada si ya existe.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- AERONAVES
-- Ficha de cada avión que volás, con las tarifas por hora que alimentan
-- el cálculo automático de costos.
-- ----------------------------------------------------------------------------
create table if not exists aeronaves (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  matricula           text not null,                 -- LV-XXX
  marca_modelo        text not null,
  potencia            text,                           -- ej. "160 HP"
  clase               text,                            -- ASEL, AMEL, etc. (libre)
  tipo_motor          text not null default 'monomotor'
                        check (tipo_motor in ('monomotor', 'multimotor')),
  medio               text not null default 'terrestre'
                        check (medio in ('terrestre', 'hidro', 'anfibio')),
  reactor             boolean not null default false,
  turbohelice         boolean not null default false,
  tarifa_hora_diurna  numeric(12,2) not null default 0,
  tarifa_hora_nocturna numeric(12,2) not null default 0,
  moneda              text not null default 'ARS',
  es_habitual         boolean not null default false,
  notas               text,
  created_at          timestamptz not null default now()
);

create index if not exists idx_aeronaves_user on aeronaves(user_id);

-- ----------------------------------------------------------------------------
-- VUELOS
-- Una fila = una línea del libro de vuelo, fiel al formato 290/2012.
-- Los 8 campos de tiempo son buckets EXCLUYENTES (cada hora cae en uno solo).
-- Las columnas de discriminación (multimotor, reactor, etc.) están
-- comprendidas DENTRO de esos tiempos: NO se suman aparte al total.
-- ----------------------------------------------------------------------------
create table if not exists vuelos (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  fecha                 date not null,

  -- Itinerario
  hora_salida_utc       time,
  desde                 text not null,   -- OACI, 4 letras
  hasta                 text not null,   -- OACI, 4 letras
  hora_llegada_utc      time,

  -- Códigos tal cual se usan en la escuela/libro en papel:
  -- INST=Instrucción · ADAP=Adaptación · REDAP=Readaptación · EXA=Examen
  -- ENTT=Entrenamiento (en escuela) · VP=Vuelo Privado (mismo entrenamiento,
  -- pero en aeronave privada, fuera de la escuela).
  finalidad_vuelo       text not null default 'INST'
                          check (finalidad_vuelo in ('INST', 'ADAP', 'REDAP', 'EXA', 'ENTT', 'VP')),

  aeronave_id           uuid not null references aeronaves(id) on delete restrict,

  -- Tiempos de vuelo (horas.décimos, ej 1.5 = 1h30m) — buckets excluyentes
  saero_dia_piloto      numeric(6,2) not null default 0,
  saero_dia_copiloto    numeric(6,2) not null default 0,
  saero_noche_piloto    numeric(6,2) not null default 0,
  saero_noche_copiloto  numeric(6,2) not null default 0,
  trav_dia_piloto       numeric(6,2) not null default 0,
  trav_dia_copiloto     numeric(6,2) not null default 0,
  trav_noche_piloto     numeric(6,2) not null default 0,
  trav_noche_copiloto   numeric(6,2) not null default 0,

  -- Aterrizajes
  aterrizajes_dia       integer not null default 0,
  aterrizajes_noche     integer not null default 0,

  -- Discriminación (subset informativo, NO se suma al total)
  instruccion_vuelo     numeric(6,2) not null default 0,
  multimotor             numeric(6,2) not null default 0,
  reactor                numeric(6,2) not null default 0,
  turbohelice            numeric(6,2) not null default 0,
  aeroaplicador          numeric(6,2) not null default 0,
  instrumentos_real      numeric(6,2) not null default 0,
  instrumentos_capota    numeric(6,2) not null default 0,
  adiestrador_simulador  numeric(6,2) not null default 0,

  -- Certificaciones (referencia; las firmas del papel no aplican acá)
  instructor_nombre      text,
  instructor_matricula   text,

  observaciones          text,
  created_at             timestamptz not null default now(),

  -- Columnas calculadas (persistidas) — ver reglas en el prompt original
  tiempo_total  numeric(6,2) generated always as (
    saero_dia_piloto + saero_dia_copiloto + saero_noche_piloto + saero_noche_copiloto +
    trav_dia_piloto + trav_dia_copiloto + trav_noche_piloto + trav_noche_copiloto
  ) stored,
  total_dia numeric(6,2) generated always as (
    saero_dia_piloto + saero_dia_copiloto + trav_dia_piloto + trav_dia_copiloto
  ) stored,
  total_noche numeric(6,2) generated always as (
    saero_noche_piloto + saero_noche_copiloto + trav_noche_piloto + trav_noche_copiloto
  ) stored,
  total_pic numeric(6,2) generated always as (
    saero_dia_piloto + saero_noche_piloto + trav_dia_piloto + trav_noche_piloto
  ) stored,
  total_copiloto numeric(6,2) generated always as (
    saero_dia_copiloto + saero_noche_copiloto + trav_dia_copiloto + trav_noche_copiloto
  ) stored,
  total_travesia numeric(6,2) generated always as (
    trav_dia_piloto + trav_dia_copiloto + trav_noche_piloto + trav_noche_copiloto
  ) stored
);

create index if not exists idx_vuelos_user on vuelos(user_id);
create index if not exists idx_vuelos_fecha on vuelos(user_id, fecha desc);
create index if not exists idx_vuelos_aeronave on vuelos(aeronave_id);

-- ----------------------------------------------------------------------------
-- CONFIG_LICENCIA
-- Mínimos de horas por requisito. Son EDITABLES y "referenciales": no
-- reemplazan la lectura de la RAAC 61.129 vigente.
-- ----------------------------------------------------------------------------
create table if not exists config_licencia (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  licencia_objetivo text not null default 'CPL Avión',
  nombre_requisito  text not null,   -- 'total', 'pic', 'travesia_pic', 'nocturnas', 'instrumentos', 'aterrizajes_noche', ...
  minimo_horas      numeric(6,2) not null default 0,
  orden             integer not null default 0,
  created_at        timestamptz not null default now(),
  unique (user_id, nombre_requisito)
);

create index if not exists idx_config_licencia_user on config_licencia(user_id);

-- ----------------------------------------------------------------------------
-- VENCIMIENTOS
-- CMA, habilitaciones, IFR, currency, etc.
-- ----------------------------------------------------------------------------
create table if not exists vencimientos (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  tipo              text not null,   -- 'CMA', 'habilitacion', 'IFR', 'currency_nocturno', ...
  fecha_vencimiento date not null,
  umbral_alerta_dias integer not null default 30,
  notas             text,
  created_at        timestamptz not null default now()
);

create index if not exists idx_vencimientos_user on vencimientos(user_id);

-- ============================================================================
-- ROW LEVEL SECURITY — cada usuario ve y toca solo lo suyo.
-- ============================================================================
alter table aeronaves       enable row level security;
alter table vuelos          enable row level security;
alter table config_licencia enable row level security;
alter table vencimientos    enable row level security;

drop policy if exists "aeronaves_select_own" on aeronaves;
drop policy if exists "aeronaves_insert_own" on aeronaves;
drop policy if exists "aeronaves_update_own" on aeronaves;
drop policy if exists "aeronaves_delete_own" on aeronaves;
create policy "aeronaves_select_own" on aeronaves for select using ((select auth.uid()) = user_id);
create policy "aeronaves_insert_own" on aeronaves for insert with check ((select auth.uid()) = user_id);
create policy "aeronaves_update_own" on aeronaves for update using ((select auth.uid()) = user_id);
create policy "aeronaves_delete_own" on aeronaves for delete using ((select auth.uid()) = user_id);

drop policy if exists "vuelos_select_own" on vuelos;
drop policy if exists "vuelos_insert_own" on vuelos;
drop policy if exists "vuelos_update_own" on vuelos;
drop policy if exists "vuelos_delete_own" on vuelos;
create policy "vuelos_select_own" on vuelos for select using ((select auth.uid()) = user_id);
create policy "vuelos_insert_own" on vuelos for insert with check ((select auth.uid()) = user_id);
create policy "vuelos_update_own" on vuelos for update using ((select auth.uid()) = user_id);
create policy "vuelos_delete_own" on vuelos for delete using ((select auth.uid()) = user_id);

drop policy if exists "config_licencia_select_own" on config_licencia;
drop policy if exists "config_licencia_insert_own" on config_licencia;
drop policy if exists "config_licencia_update_own" on config_licencia;
drop policy if exists "config_licencia_delete_own" on config_licencia;
create policy "config_licencia_select_own" on config_licencia for select using ((select auth.uid()) = user_id);
create policy "config_licencia_insert_own" on config_licencia for insert with check ((select auth.uid()) = user_id);
create policy "config_licencia_update_own" on config_licencia for update using ((select auth.uid()) = user_id);
create policy "config_licencia_delete_own" on config_licencia for delete using ((select auth.uid()) = user_id);

drop policy if exists "vencimientos_select_own" on vencimientos;
drop policy if exists "vencimientos_insert_own" on vencimientos;
drop policy if exists "vencimientos_update_own" on vencimientos;
drop policy if exists "vencimientos_delete_own" on vencimientos;
create policy "vencimientos_select_own" on vencimientos for select using ((select auth.uid()) = user_id);
create policy "vencimientos_insert_own" on vencimientos for insert with check ((select auth.uid()) = user_id);
create policy "vencimientos_update_own" on vencimientos for update using ((select auth.uid()) = user_id);
create policy "vencimientos_delete_own" on vencimientos for delete using ((select auth.uid()) = user_id);

-- El seed de mínimos por curso (APPL / PPA / PCA / TLA) lo hace la app desde
-- el cliente (js/db.js), un curso a la vez, la primera vez que se abre
-- Perfil o el Dashboard con ese curso seleccionado como "curso activo".

-- Fin del esquema base.


-- ============================================================================
-- ACTUALIZACIÓN — carreras del piloto, aeronaves simplificadas y vuelos
-- programados. Es seguro volver a correr todo el archivo de nuevo (es
-- idempotente); si ya tenías el esquema base corrido, con pegar y correr
-- este bloque de acá para abajo alcanza.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- AERONAVES: "clase" pasa a ser el tipo de aeronave en una sola opción
-- (monomotor / multimotor / reactor / turbohélice / aeroaplicador),
-- reemplazando los campos separados tipo_motor + reactor + turbohelice.
-- ----------------------------------------------------------------------------
alter table aeronaves drop column if exists tipo_motor;
alter table aeronaves drop column if exists reactor;
alter table aeronaves drop column if exists turbohelice;
alter table aeronaves drop constraint if exists aeronaves_clase_check;
update aeronaves set clase = 'monomotor'
  where clase is null or clase not in ('monomotor', 'multimotor', 'reactor', 'turbohelice', 'aeroaplicador');
alter table aeronaves alter column clase set default 'monomotor';
alter table aeronaves alter column clase set not null;
alter table aeronaves add constraint aeronaves_clase_check
  check (clase in ('monomotor', 'multimotor', 'reactor', 'turbohelice', 'aeroaplicador'));

-- ----------------------------------------------------------------------------
-- VUELOS: sumamos "remolques" (lanzamientos a remolque, para el curso de
-- piloto de planeador — APPL). No es parte de las 8 columnas de tiempo del
-- formato 290/2012, es un contador aparte, igual que los aterrizajes.
-- ----------------------------------------------------------------------------
alter table vuelos add column if not exists remolques integer not null default 0;

-- ----------------------------------------------------------------------------
-- PAPELERA DE VUELOS: "Borrar" marca deleted_at en vez de borrar la fila
-- directo, así el vuelo desaparece de bitácora/totales/progreso pero se
-- puede restaurar desde Perfil → Papelera hasta que se vacíe a mano (no hay
-- borrado automático por tiempo). Antes vivía solo en
-- sql/agregar_papelera_vuelos.sql, sin sumar al schema.sql base — lo
-- estaba dejando afuera de "correr el archivo entero de nuevo".
-- ----------------------------------------------------------------------------
alter table vuelos add column if not exists deleted_at timestamptz;
create index if not exists idx_vuelos_deleted_at on vuelos(user_id, deleted_at);

-- ----------------------------------------------------------------------------
-- CONFIG_LICENCIA: ahora conviven varios cursos a la vez para el mismo
-- usuario (APPL, PPA, PCA, TLA), cada uno con sus propios requisitos.
-- El nombre de requisito (ej. "total") se puede repetir entre cursos
-- distintos, así que el unique pasa a ser por (usuario, curso, requisito).
-- ----------------------------------------------------------------------------
alter table config_licencia drop constraint if exists config_licencia_user_id_nombre_requisito_key;
alter table config_licencia drop constraint if exists config_licencia_user_licencia_requisito_key;
alter table config_licencia add constraint config_licencia_user_licencia_requisito_key
  unique (user_id, licencia_objetivo, nombre_requisito);

-- Siembra los mínimos de referencia por defecto para un usuario nuevo.
-- SECURITY DEFINER porque corre antes de que exista ninguna fila propia del
-- usuario a la que apoyarse, pero valida p_user_id = auth.uid() para que
-- nadie pueda sembrarle (o forzar el insert de) esta config a otro usuario
-- llamando la RPC con un UUID ajeno.
create or replace function seed_config_licencia_default(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if p_user_id is distinct from auth.uid() then
    raise exception 'No autorizado: solo podés sembrar tu propia configuración.';
  end if;

  insert into config_licencia (user_id, licencia_objetivo, nombre_requisito, minimo_horas, orden)
  values
    (p_user_id, 'CPL Avión', 'total', 200, 1),
    (p_user_id, 'CPL Avión', 'pic', 100, 2),
    (p_user_id, 'CPL Avión', 'travesia_pic', 20, 3),
    (p_user_id, 'CPL Avión', 'nocturnas', 10, 4),
    (p_user_id, 'CPL Avión', 'instrumentos', 10, 5),
    (p_user_id, 'CPL Avión', 'aterrizajes_noche', 5, 6)
  on conflict (user_id, nombre_requisito) do nothing;
end;
$$;

-- ----------------------------------------------------------------------------
-- PERFIL_PILOTO: qué curso está "activo" ahora mismo (el que se muestra
-- primero en el Dashboard). Una fila por usuario.
-- ----------------------------------------------------------------------------
create table if not exists perfil_piloto (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  curso_activo text not null default 'PPA' check (curso_activo in ('APPL', 'PPA', 'PCA', 'TLA')),
  updated_at   timestamptz not null default now()
);
alter table perfil_piloto enable row level security;
drop policy if exists "perfil_piloto_select_own" on perfil_piloto;
drop policy if exists "perfil_piloto_insert_own" on perfil_piloto;
drop policy if exists "perfil_piloto_update_own" on perfil_piloto;
create policy "perfil_piloto_select_own" on perfil_piloto for select using ((select auth.uid()) = user_id);
create policy "perfil_piloto_insert_own" on perfil_piloto for insert with check ((select auth.uid()) = user_id);
create policy "perfil_piloto_update_own" on perfil_piloto for update using ((select auth.uid()) = user_id);

-- ----------------------------------------------------------------------------
-- VUELOS_PROGRAMADOS: vuelos que todavía no volaste, para que el Dashboard
-- te muestre "tu próximo vuelo". Cuando lo volás de verdad, se borra esta
-- fila y queda cargado como vuelo real en la tabla `vuelos`.
-- ----------------------------------------------------------------------------
create table if not exists vuelos_programados (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  fecha              date not null,
  hora_prevista      time,
  aeronave_id        uuid references aeronaves(id) on delete set null,
  desde              text,
  hasta              text,
  instructor_nombre  text,
  notas              text,
  created_at         timestamptz not null default now()
);
create index if not exists idx_vuelos_programados_user on vuelos_programados(user_id, fecha);
create index if not exists idx_vuelos_programados_aeronave on vuelos_programados(aeronave_id);
alter table vuelos_programados enable row level security;
drop policy if exists "vuelos_programados_select_own" on vuelos_programados;
drop policy if exists "vuelos_programados_insert_own" on vuelos_programados;
drop policy if exists "vuelos_programados_update_own" on vuelos_programados;
drop policy if exists "vuelos_programados_delete_own" on vuelos_programados;
create policy "vuelos_programados_select_own" on vuelos_programados for select using ((select auth.uid()) = user_id);
create policy "vuelos_programados_insert_own" on vuelos_programados for insert with check ((select auth.uid()) = user_id);
create policy "vuelos_programados_update_own" on vuelos_programados for update using ((select auth.uid()) = user_id);
create policy "vuelos_programados_delete_own" on vuelos_programados for delete using ((select auth.uid()) = user_id);

-- ============================================================================
-- ACTUALIZACIÓN — códigos de finalidad del vuelo tal cual los usa la
-- escuela/libro en papel (INST, ADAP, REDAP, EXA, ENTT, VP) en vez de las
-- categorías genéricas que había antes.
-- ============================================================================
alter table vuelos drop constraint if exists vuelos_finalidad_vuelo_check;

-- A los vuelos importados del libro en papel les habíamos guardado el
-- código original dentro de "observaciones" (ej. "...finalidad original: ENTT").
-- Lo recuperamos de ahí para no perder la distinción real.
update vuelos
set finalidad_vuelo = upper(trim(substring(observaciones from 'finalidad original:\s*([A-Za-z]*)')))
where observaciones ~ 'finalidad original:\s*[A-Za-z]+';

-- Mapeo de las categorías genéricas viejas (para vuelos que no tenían el
-- código original guardado) a los códigos nuevos más parecidos.
update vuelos set finalidad_vuelo = 'INST' where finalidad_vuelo = 'instruccion';
update vuelos set finalidad_vuelo = 'EXA'  where finalidad_vuelo = 'verificacion';
update vuelos set finalidad_vuelo = 'ENTT' where finalidad_vuelo in ('local', 'travesia', 'trabajo_aereo', 'adiestramiento');

-- Cualquier valor que haya quedado fuera del set nuevo (por las dudas) cae
-- en ENTT, el más frecuente, para no dejar filas inconsistentes.
update vuelos set finalidad_vuelo = 'ENTT' where finalidad_vuelo not in ('INST', 'ADAP', 'REDAP', 'EXA', 'ENTT', 'VP');

alter table vuelos alter column finalidad_vuelo set default 'INST';
alter table vuelos add constraint vuelos_finalidad_vuelo_check
  check (finalidad_vuelo in ('INST', 'ADAP', 'REDAP', 'EXA', 'ENTT', 'VP'));

-- ============================================================================
-- ACTUALIZACIÓN — simuladores (adiestrador terrestre) como un tipo de
-- aeronave aparte, con ficha simplificada (nombre, modelo y tarifa nomás).
-- ============================================================================
alter table aeronaves add column if not exists es_simulador boolean not null default false;
alter table aeronaves drop constraint if exists aeronaves_clase_check;
alter table aeronaves add constraint aeronaves_clase_check
  check (clase in ('monomotor', 'multimotor', 'reactor', 'turbohelice', 'aeroaplicador', 'simulador'));

-- ============================================================================
-- ACTUALIZACIÓN — modo administrador en Perfil, para poder agregar/sacar
-- requisitos de licencia (ej. sumar la habilitación HVI a un curso) sin
-- que sea tan fácil tocarlo por accidente en el uso diario.
-- ============================================================================
alter table perfil_piloto add column if not exists es_admin boolean not null default false;

-- ============================================================================
-- ACTUALIZACIÓN — mínimos de licencia como tabla GLOBAL compartida.
-- Antes cada usuario tenía su propia copia editable de los mínimos
-- (config_licencia, por user_id). Eso estaba mal pensado: los mínimos de
-- cada licencia son los mismos para todos los pilotos, y lo único que
-- cambia de vez en cuando es la normativa. Esta tabla nueva es una sola
-- fila por requisito, la puede LEER cualquier usuario logueado, y la
-- puede EDITAR/AGREGAR/BORRAR únicamente la cuenta cuyo email coincida
-- con la función is_licencias_admin() de acá abajo (hoy hardcodeada a
-- un solo email — cambiala si el dueño de la cuenta admin cambia).
-- config_licencia (la vieja, por usuario) queda sin usar; no se borra
-- por las dudas, pero la app ya no le pega.
-- ============================================================================
create or replace function is_licencias_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((auth.jwt() ->> 'email') = 'fileretocambrafrancisco@gmail.com', false);
$$;

create table if not exists licencias_requisitos (
  id               uuid primary key default gen_random_uuid(),
  curso_id         text not null check (curso_id in ('APPL', 'PPA', 'PCA', 'TLA')),
  nombre_requisito text not null,
  minimo_horas     numeric(8,2) not null default 0,
  orden            integer not null default 0,
  updated_at       timestamptz not null default now(),
  unique (curso_id, nombre_requisito)
);

alter table licencias_requisitos enable row level security;
drop policy if exists "licencias_requisitos_select_all" on licencias_requisitos;
drop policy if exists "licencias_requisitos_admin_insert" on licencias_requisitos;
drop policy if exists "licencias_requisitos_admin_update" on licencias_requisitos;
drop policy if exists "licencias_requisitos_admin_delete" on licencias_requisitos;
-- Cualquier usuario logueado puede leer los mínimos (son públicos entre
-- los pilotos de la app, no datos privados de nadie).
create policy "licencias_requisitos_select_all" on licencias_requisitos
  for select using ((select auth.role()) = 'authenticated');
create policy "licencias_requisitos_admin_insert" on licencias_requisitos
  for insert with check (is_licencias_admin());
create policy "licencias_requisitos_admin_update" on licencias_requisitos
  for update using (is_licencias_admin());
create policy "licencias_requisitos_admin_delete" on licencias_requisitos
  for delete using (is_licencias_admin());

-- Semilla inicial (RAAC Parte 61, Ed. VI, enero 2026 — categoría Avión,
-- vía sin curso aprobado/reconocido en CIAC). No pisa valores si ya
-- corriste esto antes.
insert into licencias_requisitos (curso_id, nombre_requisito, minimo_horas, orden) values
  ('APPL', 'remolques', 40, 1),
  ('PPA', 'total', 40, 1),
  ('PPA', 'travesia_pic', 5, 2),
  ('PPA', 'nocturnas', 3, 3),
  ('PPA', 'aterrizajes_noche', 10, 4),
  ('PCA', 'total', 200, 1),
  ('PCA', 'pic', 100, 2),
  ('PCA', 'travesia_pic', 20, 3),
  ('PCA', 'instrumentos', 10, 4),
  ('PCA', 'nocturnas', 5, 5),
  ('PCA', 'aterrizajes_noche', 5, 6),
  ('TLA', 'total', 1500, 1),
  ('TLA', 'pic', 250, 2),
  ('TLA', 'travesia_pic', 100, 3),
  ('TLA', 'nocturnas', 100, 4),
  ('TLA', 'instrumentos', 75, 5)
on conflict (curso_id, nombre_requisito) do nothing;

-- ============================================================================
-- ACTUALIZACIÓN — PCA con habilitación de vuelo por instrumentos (HVI)
-- como curso aparte (61.315 + 61.620). La RAAC pide 40 hs de instrumentos
-- en total, de las cuales hasta 20 pueden ser en simulador (FSTD) — el
-- resto tiene que ser vuelo real. Como esa repartición la elige cada
-- piloto (no es un mínimo fijo igual para todos), se guarda como
-- preferencia personal en perfil_piloto, no en la tabla global.
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

-- ============================================================================
-- COSTO CONGELADO — importe en ARS realmente abonado por cada vuelo,
-- clavado al momento de cargarlo (dólar blue venta del día si la aeronave
-- cobra en USD). Ver sql/agregar_costo_congelado.sql para el detalle.
-- ============================================================================
alter table vuelos add column if not exists costo_congelado numeric(14,2);
alter table vuelos add column if not exists cotizacion_usada numeric(12,2);

-- ============================================================================
-- DATOS DEL PILOTO — cabecera de la Hoja de Libro de Vuelo (ANAC 290/2012).
-- Ver sql/agregar_datos_piloto.sql.
-- ============================================================================
alter table perfil_piloto add column if not exists nombre_completo text;
alter table perfil_piloto add column if not exists licencia        text;
alter table perfil_piloto add column if not exists licencia_numero text;
alter table perfil_piloto add column if not exists legajo          text;

-- ============================================================================
-- TIPO DE VUELO (opcional) en vuelos programados. Ver
-- sql/agregar_tipo_vuelo_programado.sql.
-- ============================================================================
alter table vuelos_programados add column if not exists tipo_vuelo text;

-- ============================================================================
-- NOTIFICACIONES PUSH — Web Push nativo (VAPID) + Supabase. Ver el detalle,
-- la RLS y el bloque comentado para programar el cron en
-- sql/agregar_notificaciones_push.sql (y README.md, sección 8).
-- ============================================================================
create table if not exists push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  endpoint   text not null unique,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_push_subscriptions_user on push_subscriptions(user_id);

create table if not exists notif_config (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  vencimientos       boolean not null default true,
  vuelos_programados boolean not null default true,
  horas_antes_vuelo  integer not null default 12,
  updated_at         timestamptz not null default now()
);

alter table vencimientos add column if not exists ultimo_aviso date;
alter table vuelos_programados add column if not exists aviso_enviado boolean not null default false;

alter table push_subscriptions enable row level security;
alter table notif_config       enable row level security;

drop policy if exists "push_subscriptions_select_own" on push_subscriptions;
drop policy if exists "push_subscriptions_insert_own" on push_subscriptions;
drop policy if exists "push_subscriptions_update_own" on push_subscriptions;
drop policy if exists "push_subscriptions_delete_own" on push_subscriptions;
create policy "push_subscriptions_select_own" on push_subscriptions for select using ((select auth.uid()) = user_id);
create policy "push_subscriptions_insert_own" on push_subscriptions for insert with check ((select auth.uid()) = user_id);
create policy "push_subscriptions_update_own" on push_subscriptions for update using ((select auth.uid()) = user_id);
create policy "push_subscriptions_delete_own" on push_subscriptions for delete using ((select auth.uid()) = user_id);

drop policy if exists "notif_config_select_own" on notif_config;
drop policy if exists "notif_config_insert_own" on notif_config;
drop policy if exists "notif_config_update_own" on notif_config;
create policy "notif_config_select_own" on notif_config for select using ((select auth.uid()) = user_id);
create policy "notif_config_insert_own" on notif_config for insert with check ((select auth.uid()) = user_id);
create policy "notif_config_update_own" on notif_config for update using ((select auth.uid()) = user_id);

-- ============================================================================
-- RECORDATORIOS PERSONALIZADOS — uno o varios avisos por evento, cada uno
-- con su propio disparador. Ver el detalle completo en
-- sql/agregar_recordatorios_personalizados.sql. (deleted_at ya se define
-- más arriba, en el bloque de Papelera de vuelos.)
-- ============================================================================
alter table vencimientos add column if not exists rodante boolean not null default false;
alter table vencimientos add column if not exists intervalo_dias integer;

create or replace function fn_recalcular_vencimiento_rodante(p_user_id uuid, p_fecha_vencimiento date, p_intervalo_dias integer)
returns date language sql stable as $$
  select greatest(
    p_fecha_vencimiento,
    coalesce(
      (
        select (max(fecha) + (p_intervalo_dias || ' days')::interval)::date
        from vuelos where user_id = p_user_id and deleted_at is null
      ),
      p_fecha_vencimiento
    )
  );
$$;

create or replace function trg_fn_vencimiento_rodante() returns trigger language plpgsql as $$
begin
  if NEW.rodante and NEW.intervalo_dias is not null then
    NEW.fecha_vencimiento := fn_recalcular_vencimiento_rodante(NEW.user_id, NEW.fecha_vencimiento, NEW.intervalo_dias);
  end if;
  return NEW;
end;
$$;
drop trigger if exists trg_vencimientos_rodante on vencimientos;
create trigger trg_vencimientos_rodante before insert or update on vencimientos
for each row execute function trg_fn_vencimiento_rodante();

create or replace function trg_fn_vuelos_recalcular_rodantes() returns trigger language plpgsql as $$
declare
  uid uuid := coalesce(NEW.user_id, OLD.user_id);
begin
  update vencimientos
  set fecha_vencimiento = fn_recalcular_vencimiento_rodante(uid, fecha_vencimiento, intervalo_dias)
  where user_id = uid and rodante and intervalo_dias is not null;
  return null;
end;
$$;
drop trigger if exists trg_vuelos_recalc_vencimientos on vuelos;
create trigger trg_vuelos_recalc_vencimientos after insert or update or delete on vuelos
for each row execute function trg_fn_vuelos_recalcular_rodantes();

alter table vuelos_programados add column if not exists hora_finalizacion time;

create table if not exists recordatorios (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  evento_tipo       text not null check (evento_tipo in ('vuelo_programado', 'vencimiento')),
  evento_id         uuid not null,
  tipo_disparo      text not null check (tipo_disparo in ('dias_antes', 'horas_antes', 'fecha_hora')),
  valor             numeric,
  fecha_hora        timestamptz,
  mensaje           text,
  origen            text not null default 'manual' check (origen in ('manual', 'auto_cargar_datos')),
  activo            boolean not null default true,
  ultimo_aviso_clave text,
  created_at        timestamptz not null default now()
);
create index if not exists idx_recordatorios_user on recordatorios(user_id);
create index if not exists idx_recordatorios_evento on recordatorios(evento_tipo, evento_id);

alter table recordatorios enable row level security;
drop policy if exists "recordatorios_select_own" on recordatorios;
drop policy if exists "recordatorios_insert_own" on recordatorios;
drop policy if exists "recordatorios_update_own" on recordatorios;
drop policy if exists "recordatorios_delete_own" on recordatorios;
create policy "recordatorios_select_own" on recordatorios for select using ((select auth.uid()) = user_id);
create policy "recordatorios_insert_own" on recordatorios for insert with check ((select auth.uid()) = user_id);
create policy "recordatorios_update_own" on recordatorios for update using ((select auth.uid()) = user_id);
create policy "recordatorios_delete_own" on recordatorios for delete using ((select auth.uid()) = user_id);

-- Foto de aeronave (opcional): URL pública + bucket de Storage con
-- políticas de subida/borrado por dueño (carpeta = user_id), lectura
-- pública (ver sql/agregar_foto_aeronave.sql para el detalle comentado).
alter table aeronaves add column if not exists foto_url text;

insert into storage.buckets (id, name, public)
values ('aeronaves-fotos', 'aeronaves-fotos', true)
on conflict (id) do nothing;

drop policy if exists "aeronaves_fotos_select_public" on storage.objects;
drop policy if exists "aeronaves_fotos_insert_own" on storage.objects;
drop policy if exists "aeronaves_fotos_update_own" on storage.objects;
drop policy if exists "aeronaves_fotos_delete_own" on storage.objects;

-- Sin política de SELECT a propósito: el bucket ya es público, así que
-- getPublicUrl() sirve los archivos por CDN sin pasar por RLS. Una política
-- de SELECT abierta acá no agrega nada al acceso por URL directa, pero sí
-- permite LISTAR el bucket entero (incluye los user_id de cada carpeta) vía
-- la API — por eso no se crea.

create policy "aeronaves_fotos_insert_own" on storage.objects for insert
  with check (bucket_id = 'aeronaves-fotos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "aeronaves_fotos_update_own" on storage.objects for update
  using (bucket_id = 'aeronaves-fotos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "aeronaves_fotos_delete_own" on storage.objects for delete
  using (bucket_id = 'aeronaves-fotos' and auth.uid()::text = (storage.foldername(name))[1]);

-- Base (aeródromo) de la aeronave — opcional, solo aeronaves reales.
alter table aeronaves add column if not exists base_aerodromo text;

-- Encuadre vertical de la foto de aeronave (0-100, 50=centro) — ver
-- sql/agregar_posicion_foto_aeronave.sql para el detalle comentado.
alter table aeronaves add column if not exists foto_posicion integer not null default 50;
alter table aeronaves drop constraint if exists aeronaves_foto_posicion_check;
alter table aeronaves add constraint aeronaves_foto_posicion_check check (foto_posicion between 0 and 100);

-- Track GPS real del vuelo (opcional, puntos [lat,lon] parseados de un
-- .csv/.kml de FlightRadar24) — ver sql/agregar_track_vuelo.sql.
alter table vuelos add column if not exists ruta_track jsonb;

-- ============================================================================
-- MÍNIMOS DE LICENCIA PERSONALIZADOS (opcional) — licencias_requisitos
-- sigue siendo la tabla global de referencia (RAAC vigente, editable solo
-- por el admin); esta tabla nueva deja que CUALQUIER piloto guarde su
-- propio valor para un requisito puntual (ej. su escuela le pide otra
-- cosa) sin tocar el de nadie más. Ver sql/agregar_licencias_requisitos_personal.sql.
-- ============================================================================
create table if not exists licencias_requisitos_personal (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  curso_id         text not null,
  nombre_requisito text not null,
  minimo_horas     numeric(8,2) not null default 0,
  updated_at       timestamptz not null default now(),
  unique (user_id, curso_id, nombre_requisito)
);

alter table licencias_requisitos_personal enable row level security;
drop policy if exists "licencias_requisitos_personal_select_own" on licencias_requisitos_personal;
drop policy if exists "licencias_requisitos_personal_insert_own" on licencias_requisitos_personal;
drop policy if exists "licencias_requisitos_personal_update_own" on licencias_requisitos_personal;
drop policy if exists "licencias_requisitos_personal_delete_own" on licencias_requisitos_personal;
create policy "licencias_requisitos_personal_select_own" on licencias_requisitos_personal
  for select using ((select auth.uid()) = user_id);
create policy "licencias_requisitos_personal_insert_own" on licencias_requisitos_personal
  for insert with check ((select auth.uid()) = user_id);
create policy "licencias_requisitos_personal_update_own" on licencias_requisitos_personal
  for update using ((select auth.uid()) = user_id);
create policy "licencias_requisitos_personal_delete_own" on licencias_requisitos_personal
  for delete using ((select auth.uid()) = user_id);

-- ============================================================================
-- REGISTRO DE ERRORES (opcional) — monitoreo básico, propio, sin depender de
-- ningún servicio de terceros. Ver sql/agregar_registro_errores.sql.
-- ============================================================================
create table if not exists error_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete set null,
  mensaje    text not null,
  detalle    text,
  url        text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists idx_error_logs_created on error_logs(created_at desc);
create index if not exists idx_error_logs_user on error_logs(user_id);

alter table error_logs enable row level security;
drop policy if exists "error_logs_insert_own" on error_logs;
drop policy if exists "error_logs_select_admin" on error_logs;
drop policy if exists "error_logs_delete_admin" on error_logs;
create policy "error_logs_insert_own" on error_logs
  for insert with check ((select auth.uid()) = user_id);
create policy "error_logs_select_admin" on error_logs
  for select using (is_licencias_admin());
create policy "error_logs_delete_admin" on error_logs
  for delete using (is_licencias_admin());

-- Fin del esquema.
