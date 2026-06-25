create table if not exists public.module_libraries (
  id text primary key,
  modules jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.module_libraries enable row level security;

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
