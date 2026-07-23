-- ============================================================================
-- FOTO DE AERONAVE — columna para la URL pública de la foto (opcional) y el
-- bucket de Storage donde se suben, con políticas para que cada usuario solo
-- pueda subir/reemplazar/borrar sus propios archivos (carpeta = su user_id),
-- aunque la lectura es pública (son solo fotos, sin dato sensible, y así se
-- pueden mostrar con una URL directa sin pasar por el cliente autenticado).
-- Correr en el SQL Editor de Supabase; seguro de correr una sola vez (y no
-- rompe nada si lo repetís).
-- ============================================================================

alter table aeronaves add column if not exists foto_url text;

insert into storage.buckets (id, name, public)
values ('aeronaves-fotos', 'aeronaves-fotos', true)
on conflict (id) do nothing;

drop policy if exists "aeronaves_fotos_select_public" on storage.objects;
drop policy if exists "aeronaves_fotos_insert_own" on storage.objects;
drop policy if exists "aeronaves_fotos_update_own" on storage.objects;
drop policy if exists "aeronaves_fotos_delete_own" on storage.objects;

create policy "aeronaves_fotos_select_public" on storage.objects for select
  using (bucket_id = 'aeronaves-fotos');

create policy "aeronaves_fotos_insert_own" on storage.objects for insert
  with check (bucket_id = 'aeronaves-fotos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "aeronaves_fotos_update_own" on storage.objects for update
  using (bucket_id = 'aeronaves-fotos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "aeronaves_fotos_delete_own" on storage.objects for delete
  using (bucket_id = 'aeronaves-fotos' and auth.uid()::text = (storage.foldername(name))[1]);
