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
create policy "aeronaves_select_own" on aeronaves for select using (auth.uid() = user_id);
create policy "aeronaves_insert_own" on aeronaves for insert with check (auth.uid() = user_id);
create policy "aeronaves_update_own" on aeronaves for update using (auth.uid() = user_id);
create policy "aeronaves_delete_own" on aeronaves for delete using (auth.uid() = user_id);

drop policy if exists "vuelos_select_own" on vuelos;
drop policy if exists "vuelos_insert_own" on vuelos;
drop policy if exists "vuelos_update_own" on vuelos;
drop policy if exists "vuelos_delete_own" on vuelos;
create policy "vuelos_select_own" on vuelos for select using (auth.uid() = user_id);
create policy "vuelos_insert_own" on vuelos for insert with check (auth.uid() = user_id);
create policy "vuelos_update_own" on vuelos for update using (auth.uid() = user_id);
create policy "vuelos_delete_own" on vuelos for delete using (auth.uid() = user_id);

drop policy if exists "config_licencia_select_own" on config_licencia;
drop policy if exists "config_licencia_insert_own" on config_licencia;
drop policy if exists "config_licencia_update_own" on config_licencia;
drop policy if exists "config_licencia_delete_own" on config_licencia;
create policy "config_licencia_select_own" on config_licencia for select using (auth.uid() = user_id);
create policy "config_licencia_insert_own" on config_licencia for insert with check (auth.uid() = user_id);
create policy "config_licencia_update_own" on config_licencia for update using (auth.uid() = user_id);
create policy "config_licencia_delete_own" on config_licencia for delete using (auth.uid() = user_id);

drop policy if exists "vencimientos_select_own" on vencimientos;
drop policy if exists "vencimientos_insert_own" on vencimientos;
drop policy if exists "vencimientos_update_own" on vencimientos;
drop policy if exists "vencimientos_delete_own" on vencimientos;
create policy "vencimientos_select_own" on vencimientos for select using (auth.uid() = user_id);
create policy "vencimientos_insert_own" on vencimientos for insert with check (auth.uid() = user_id);
create policy "vencimientos_update_own" on vencimientos for update using (auth.uid() = user_id);
create policy "vencimientos_delete_own" on vencimientos for delete using (auth.uid() = user_id);

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
-- CONFIG_LICENCIA: ahora conviven varios cursos a la vez para el mismo
-- usuario (APPL, PPA, PCA, TLA), cada uno con sus propios requisitos.
-- El nombre de requisito (ej. "total") se puede repetir entre cursos
-- distintos, así que el unique pasa a ser por (usuario, curso, requisito).
-- ----------------------------------------------------------------------------
alter table config_licencia drop constraint if exists config_licencia_user_id_nombre_requisito_key;
alter table config_licencia drop constraint if exists config_licencia_user_licencia_requisito_key;
alter table config_licencia add constraint config_licencia_user_licencia_requisito_key
  unique (user_id, licencia_objetivo, nombre_requisito);

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
create policy "perfil_piloto_select_own" on perfil_piloto for select using (auth.uid() = user_id);
create policy "perfil_piloto_insert_own" on perfil_piloto for insert with check (auth.uid() = user_id);
create policy "perfil_piloto_update_own" on perfil_piloto for update using (auth.uid() = user_id);

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
alter table vuelos_programados enable row level security;
drop policy if exists "vuelos_programados_select_own" on vuelos_programados;
drop policy if exists "vuelos_programados_insert_own" on vuelos_programados;
drop policy if exists "vuelos_programados_update_own" on vuelos_programados;
drop policy if exists "vuelos_programados_delete_own" on vuelos_programados;
create policy "vuelos_programados_select_own" on vuelos_programados for select using (auth.uid() = user_id);
create policy "vuelos_programados_insert_own" on vuelos_programados for insert with check (auth.uid() = user_id);
create policy "vuelos_programados_update_own" on vuelos_programados for update using (auth.uid() = user_id);
create policy "vuelos_programados_delete_own" on vuelos_programados for delete using (auth.uid() = user_id);

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

-- Fin del esquema.
