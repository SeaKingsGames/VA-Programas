-- =============================================================
-- Programas de la congregación: base de datos para Supabase
-- Pégalo completo en  SQL Editor > New query  y presiona Run.
-- Se puede volver a ejecutar sin problema.
--
-- Cómo queda la seguridad:
--   * Cualquiera con el link puede LEER lo publicado (clave pública).
--   * Nadie puede escribir con la clave pública.
--   * Solo la función de Vercel (api/editar.js) escribe, usando la
--     clave secreta, y solo si le dieron la contraseña CLAVE_EDITORES.
-- =============================================================

-- 1) Todo se guarda en una sola tabla (personas, formatos, programas, ajustes)
create table if not exists public.registros (
  id          text primary key,
  coleccion   text not null check (coleccion in ('personas','formatos','programas','ajustes')),
  data        jsonb not null default '{}'::jsonb,
  publicado   boolean not null default true,
  updated_at  timestamptz not null default now()
);
alter table public.registros enable row level security;
grant select on public.registros to anon, authenticated;
grant all    on public.registros to service_role;

-- Quitar reglas de versiones anteriores (si existían)
drop policy if exists "ver publicados"   on public.registros;
drop policy if exists "editores crean"   on public.registros;
drop policy if exists "editores cambian" on public.registros;
drop policy if exists "editores borran"  on public.registros;

-- 2) Regla única: leer solo lo publicado. (No hay reglas para escribir a propósito.)
create policy "ver publicados" on public.registros for select to anon, authenticated using (publicado);

-- 3) Fotos: carpeta pública para ver; solo el servidor sube.
insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', true)
on conflict (id) do update set public = true;

drop policy if exists "fotos ver"     on storage.objects;
drop policy if exists "fotos subir"   on storage.objects;
drop policy if exists "fotos cambiar" on storage.objects;
drop policy if exists "fotos borrar"  on storage.objects;
create policy "fotos ver" on storage.objects for select using (bucket_id = 'fotos');

-- 4) Limpieza de la versión anterior con correos (ya no se usa)
drop function if exists public.es_editor();
drop table if exists public.editores;
