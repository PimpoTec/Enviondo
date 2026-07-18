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

  finalidad_vuelo       text not null default 'local'
                          check (finalidad_vuelo in
                            ('instruccion', 'travesia', 'local', 'trabajo_aereo',
                             'verificacion', 'adiestramiento')),

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

-- ============================================================================
-- SEED: mínimos referenciales de CPL Avión (RAAC 61.129) para usuarios nuevos.
-- Se dispara solo la primera vez que el usuario abre "Perfil / Licencias"
-- (la app hace el insert desde el cliente); dejamos acá una función helper
-- opcional por si preferís poblarlo por trigger en vez de desde el front.
-- ============================================================================
create or replace function seed_config_licencia_default(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
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

-- Fin del esquema.
