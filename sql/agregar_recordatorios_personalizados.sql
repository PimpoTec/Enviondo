-- ============================================================================
-- RECORDATORIOS PERSONALIZADOS — uno o varios avisos por evento (vuelo
-- programado o vencimiento), cada uno con su propio disparador: "X días
-- antes", "X horas antes", o una fecha y hora puntual. Reemplaza/completa
-- el aviso automático simple de sql/agregar_notificaciones_push.sql, que
-- sigue funcionando como respaldo para los eventos que no tengan ningún
-- recordatorio propio configurado (ver supabase/functions/notificaciones-push).
--
-- Es seguro correr este archivo solo (ya está incluido al final de
-- sql/schema.sql también). Requiere haber corrido antes
-- sql/agregar_notificaciones_push.sql (usa las mismas tablas base).
-- ============================================================================

-- La papelera de vuelos (sql/agregar_papelera_vuelos.sql) puede no haberse
-- corrido todavía en algunos proyectos — este archivo la necesita para el
-- cálculo de "vencimientos rodantes" de abajo, así que la garantizamos acá.
alter table vuelos add column if not exists deleted_at timestamptz;

-- ----------------------------------------------------------------------------
-- VENCIMIENTOS RODANTES — en vez de una fecha fija, algunos vencimientos
-- ANAC/RAAC son "tenés que volar cada N días o se te vence" (currency). Con
-- `rodante` activado, `fecha_vencimiento` deja de ser un dato fijo: se
-- recalcula sola cada vez que cargás/editás/borrás un vuelo, como
-- "fecha de tu último vuelo + intervalo_dias". Nunca retrocede (greatest),
-- para que borrar un vuelo viejo no adelante el vencimiento de golpe.
-- ----------------------------------------------------------------------------
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

-- Al crear/editar un vencimiento rodante, se recalcula al toque con el
-- historial de vuelos que ya tenías cargado (no espera al próximo vuelo).
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

-- Al cargar/editar/borrar un vuelo, se recalculan TODOS los vencimientos
-- rodantes del usuario dueño de ese vuelo (ej: volaste al día 24 de una
-- ventana de 30 → el vencimiento se corre a "ese vuelo + 30 días" de nuevo).
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

-- ----------------------------------------------------------------------------
-- VUELOS_PROGRAMADOS: hora de finalización estimada (opcional). Si se
-- carga, la app arma sola un recordatorio "cargá los datos del vuelo" para
-- el otro día a la mañana (ver js/views/dashboard.js).
-- ----------------------------------------------------------------------------
alter table vuelos_programados add column if not exists hora_finalizacion time;

-- ----------------------------------------------------------------------------
-- RECORDATORIOS — uno o varios por evento. `evento_id` no es una FK dura
-- (apunta a vuelos_programados.id o vencimientos.id según evento_tipo)
-- porque un evento puede ser de dos tablas distintas; la limpieza al
-- borrar el evento la hace la app (Repo.borrarVueloProgramado /
-- borrarVencimiento). `ultimo_aviso_clave` guarda a qué instancia del
-- evento correspondió el último aviso mandado (ej. la fecha_vencimiento
-- vigente en ese momento) — si el evento se corre (currency rodante que se
-- resetea, vuelo reprogramado), la clave ya no coincide y el recordatorio
-- vuelve a estar habilitado para la fecha nueva sin esperar nada más.
-- ----------------------------------------------------------------------------
create table if not exists recordatorios (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  evento_tipo       text not null check (evento_tipo in ('vuelo_programado', 'vencimiento')),
  evento_id         uuid not null,
  tipo_disparo      text not null check (tipo_disparo in ('dias_antes', 'horas_antes', 'fecha_hora')),
  valor             numeric,       -- cantidad de días/horas (dias_antes / horas_antes)
  fecha_hora        timestamptz,   -- solo para tipo_disparo = 'fecha_hora'
  mensaje           text,          -- opcional, reemplaza el texto automático
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
create policy "recordatorios_select_own" on recordatorios for select using (auth.uid() = user_id);
create policy "recordatorios_insert_own" on recordatorios for insert with check (auth.uid() = user_id);
create policy "recordatorios_update_own" on recordatorios for update using (auth.uid() = user_id);
create policy "recordatorios_delete_own" on recordatorios for delete using (auth.uid() = user_id);
