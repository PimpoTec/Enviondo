-- ============================================================================
-- NOTIFICACIONES PUSH — Web Push nativo (VAPID) + Supabase, sin terceros.
-- Es seguro correr este archivo solo (ya está incluido al final de
-- sql/schema.sql también, por si corrés el esquema completo de nuevo).
--
-- Qué crea:
--   - push_subscriptions: un endpoint de push por dispositivo suscripto.
--     La clave de conflicto es el ENDPOINT, no el user_id — así un mismo
--     usuario puede tener el celu y la notebook suscriptos a la vez, sin
--     que uno pise al otro.
--   - notif_config: preferencias del usuario (qué tipos de aviso quiere).
--   - vencimientos.ultimo_aviso / vuelos_programados.aviso_enviado: para
--     que la Edge Function no mande el mismo aviso todos los días.
--
-- Esto NO alcanza para que lleguen notificaciones solo: además hay que
-- generar el par de claves VAPID, desplegar
-- supabase/functions/notificaciones-push y programar el cron que la
-- dispare. Toda la guía paso a paso está en README.md, sección 8.
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

-- ----------------------------------------------------------------------------
-- RLS: cada usuario ve y toca solo sus propias suscripciones/preferencias.
-- La Edge Function que manda los avisos usa la service_role key (bypassea
-- RLS a propósito, porque tiene que barrer a TODOS los usuarios en el cron).
-- ----------------------------------------------------------------------------
alter table push_subscriptions enable row level security;
alter table notif_config       enable row level security;

drop policy if exists "push_subscriptions_select_own" on push_subscriptions;
drop policy if exists "push_subscriptions_insert_own" on push_subscriptions;
drop policy if exists "push_subscriptions_update_own" on push_subscriptions;
drop policy if exists "push_subscriptions_delete_own" on push_subscriptions;
create policy "push_subscriptions_select_own" on push_subscriptions for select using (auth.uid() = user_id);
create policy "push_subscriptions_insert_own" on push_subscriptions for insert with check (auth.uid() = user_id);
create policy "push_subscriptions_update_own" on push_subscriptions for update using (auth.uid() = user_id);
create policy "push_subscriptions_delete_own" on push_subscriptions for delete using (auth.uid() = user_id);

drop policy if exists "notif_config_select_own" on notif_config;
drop policy if exists "notif_config_insert_own" on notif_config;
drop policy if exists "notif_config_update_own" on notif_config;
create policy "notif_config_select_own" on notif_config for select using (auth.uid() = user_id);
create policy "notif_config_insert_own" on notif_config for insert with check (auth.uid() = user_id);
create policy "notif_config_update_own" on notif_config for update using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- CRON (opcional, para que los avisos se disparen solos): pg_cron + pg_net
-- ya vienen habilitadas en todo proyecto Supabase. Esto programa un pedido
-- HTTP a la Edge Function cada una hora, autenticado con un secreto propio
-- (no la service_role key, para no dejarla pegada en texto plano acá) que
-- la función valida contra su variable de entorno CRON_SECRET.
--
-- Reemplazá los dos placeholders y corré esto DESPUÉS de:
--   1) desplegar supabase/functions/notificaciones-push
--   2) fijar el secreto:
--      supabase secrets set CRON_SECRET=elegí-algo-largo-y-random
-- ============================================================================
-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;
--
-- select cron.schedule(
--   'notificaciones-push-hourly',
--   '0 * * * *',
--   $$
--   select net.http_post(
--     url := 'https://TU-PROYECTO.supabase.co/functions/v1/notificaciones-push',
--     headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer TU-CRON-SECRET'),
--     body := jsonb_build_object('modo', 'cron')
--   );
--   $$
-- );
--
-- Para desprogramarlo: select cron.unschedule('notificaciones-push-hourly');
