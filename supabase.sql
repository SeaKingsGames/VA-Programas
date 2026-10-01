-- =============================================================
-- Programas de la congregación: base de datos para Supabase
-- Pégalo completo en  SQL Editor > New query  y presiona Run.
-- Se puede volver a ejecutar sin problema.
-- =============================================================

-- 1) Todo se guarda en una sola tabla (personas, formatos, programas, ajustes)
create table if not exists public.registros (
  id          text primary key,
  coleccion   text not null check (coleccion in ('personas','formatos','programas','ajustes')),
  data        jsonb not null default '{}'::jsonb,
  publicado   boolean not null default true,
  updated_at  timestamptz not null default now()
);

-- 2) Lista de correos que pueden editar
create table if not exists public.editores (
  email text primary key
);

alter table public.registros enable row level security;
alter table public.editores  enable row level security;   -- sin políticas: nadie la lee desde la app

create or replace function public.es_editor()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.editores e
    where lower(e.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
grant execute on function public.es_editor() to anon, authenticated;

-- 3) Reglas: cualquiera ve lo publicado; solo editores crean, cambian y borran
drop policy if exists "ver publicados"   on public.registros;
drop policy if exists "editores crean"   on public.registros;
drop policy if exists "editores cambian" on public.registros;
drop policy if exists "editores borran"  on public.registros;

create policy "ver publicados"   on public.registros for select to anon, authenticated using (publicado or public.es_editor());
create policy "editores crean"   on public.registros for insert to authenticated with check (public.es_editor());
create policy "editores cambian" on public.registros for update to authenticated using (public.es_editor()) with check (public.es_editor());
create policy "editores borran"  on public.registros for delete to authenticated using (public.es_editor());

-- 4) Fotos de las personas (carpeta pública para ver, solo editores suben)
insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', true)
on conflict (id) do update set public = true;

drop policy if exists "fotos ver"     on storage.objects;
drop policy if exists "fotos subir"   on storage.objects;
drop policy if exists "fotos cambiar" on storage.objects;
drop policy if exists "fotos borrar"  on storage.objects;

create policy "fotos ver"     on storage.objects for select using (bucket_id = 'fotos');
create policy "fotos subir"   on storage.objects for insert to authenticated with check (bucket_id = 'fotos' and public.es_editor());
create policy "fotos cambiar" on storage.objects for update to authenticated using (bucket_id = 'fotos' and public.es_editor());
create policy "fotos borrar"  on storage.objects for delete to authenticated using (bucket_id = 'fotos' and public.es_editor());

-- 5) CAMBIA ESTE CORREO por el tuyo (y agrega una línea por cada editor)
insert into public.editores (email) values ('tu-correo@ejemplo.com') on conflict do nothing;
