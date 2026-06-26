create table if not exists public.module_libraries (
  id text primary key,
  modules jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.location_models (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  lat double precision not null,
  lon double precision not null,
  zoom integer not null default 18,
  design jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.location_models alter column id drop default;
alter table public.location_models alter column id type text using id::text;
alter table public.location_models alter column id set default gen_random_uuid()::text;

alter table public.module_libraries enable row level security;
alter table public.location_models enable row level security;

drop policy if exists "Public module library read" on public.module_libraries;
create policy "Public module library read"
on public.module_libraries
for select
to anon
using (true);

drop policy if exists "Public module library write" on public.module_libraries;
create policy "Public module library write"
on public.module_libraries
for all
to anon
using (true)
with check (true);

drop policy if exists "Public location model read" on public.location_models;
create policy "Public location model read"
on public.location_models
for select
to anon
using (true);

drop policy if exists "Public location model write" on public.location_models;
create policy "Public location model write"
on public.location_models
for all
to anon
using (true)
with check (true);

insert into storage.buckets (id, name, public)
values ('module-assets', 'module-assets', true)
on conflict (id) do update set public = true;

drop policy if exists "Public module asset read" on storage.objects;
create policy "Public module asset read"
on storage.objects
for select
to anon
using (bucket_id = 'module-assets');

drop policy if exists "Public module asset write" on storage.objects;
create policy "Public module asset write"
on storage.objects
for all
to anon
using (bucket_id = 'module-assets')
with check (bucket_id = 'module-assets');
