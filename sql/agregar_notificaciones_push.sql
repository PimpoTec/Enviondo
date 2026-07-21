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
-- HTTP a la Edge Function cada 5 minutos, autenticado con un secreto propio
-- (no la service_role key, para no dejarla pegada en texto plano acá) que
-- la función valida contra su variable de entorno CRON_SECRET.
--
-- ¿Por qué cada 5 minutos y no cada hora? Los recordatorios de tipo
-- "fecha y hora puntual" solo se revisan cuando corre el cron — con un
-- schedule de '0 * * * *' (una vez por hora, en punto), uno puesto para
-- las 19:24 recién lo agarra el tick de las 20:00, casi una hora tarde.
-- Con '*/5 * * * *' el atraso máximo baja a ~5 minutos. Para una app de
-- un solo usuario el costo es insignificante (Supabase incluye 500.000
-- invocaciones/mes gratis; cada 5 min son ~8.600/mes). Si preferís
-- ahorrar invocaciones y no te importa la demora, usá '0 * * * *' en el
-- schedule de abajo.
--
-- OJO con timeout_milliseconds: pg_net espera 5000ms (5s) por default antes
-- de cortar la conexión y descartar la respuesta. Si la Edge Function
-- arranca "fría" (cold start: cargar `web-push` + `@supabase/supabase-js`
-- vía `npm:` en Deno) más el trabajo real del cron, puede superar esos 5s
-- fácil (visto en producción: ~4.9s y corta). Si eso pasa, pg_cron/pg_net
-- van a mostrar el job como "succeeded" en cron.job_run_details (solo
-- confirma que se LANZÓ el pedido) pero net._http_response va a tener
-- status_code null y error_msg "Timeout of 5000 ms reached" — y ningún
-- aviso llega, aunque el botón "Enviar notificación de prueba" (que no
-- pasa por acá) funcione bien. Por eso 30s de margen acá abajo.
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
--   '*/5 * * * *',
--   $$
--   select net.http_post(
--     url := 'https://TU-PROYECTO.supabase.co/functions/v1/notificaciones-push',
--     headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer TU-CRON-SECRET'),
--     body := jsonb_build_object('modo', 'cron'),
--     timeout_milliseconds := 30000
--   );
--   $$
-- );
--
-- Para desprogramarlo: select cron.unschedule('notificaciones-push-hourly');
--
-- Para cambiarle SOLO el intervalo a un cron que ya tenías programado
-- (por ejemplo, pasar de cada hora a cada 5 minutos sin recrearlo):
-- select cron.alter_job(
--   job_id := (select jobid from cron.job where jobname = 'notificaciones-push-hourly'),
--   schedule := '*/5 * * * *'
-- );
--
-- Para subirle el timeout a un cron que ya tenías programado (sin volver a
-- crearlo de cero), reemplazá el mismo placeholder de CRON_SECRET acá:
-- select cron.alter_job(
--   job_id := (select jobid from cron.job where jobname = 'notificaciones-push-hourly'),
--   command := $$
--   select net.http_post(
--     url := 'https://TU-PROYECTO.supabase.co/functions/v1/notificaciones-push',
--     headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer TU-CRON-SECRET'),
--     body := jsonb_build_object('modo', 'cron'),
--     timeout_milliseconds := 30000
--   );
--   $$
-- );
