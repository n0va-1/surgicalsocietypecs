-- A curriculum editor is deliberately not a demonstrator. The underlying
-- profile remains a student role with an explicit, narrowly-scoped permission.
alter table public.profiles add column if not exists curriculum_editor boolean not null default false;
alter table public.invite_codes add column if not exists curriculum_editor boolean not null default false;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select role in ('demonstrator','admin') from public.profiles where id = (select auth.uid())), false)
    and coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2';
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select role = 'admin' from public.profiles where id = (select auth.uid())), false)
    and coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2';
$$;

create or replace function public.is_curriculum_editor() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select curriculum_editor from public.profiles where id = (select auth.uid())), false)
    and coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2';
$$;

drop function if exists public.redeem_invite_code(text, public.academy_role);
create function public.redeem_invite_code(submitted_code text, requested_role public.academy_role)
returns table(invite_id uuid, course_level public.academy_level, curriculum_editor boolean)
language plpgsql security definer set search_path = '' as $$
declare match_id uuid; match_level public.academy_level; match_editor boolean;
begin
  select id, invite_codes.course_level, invite_codes.curriculum_editor
    into match_id, match_level, match_editor
  from public.invite_codes
  where role = requested_role and revoked_at is null and uses < max_uses
    and (expires_at is null or expires_at > now()) and crypt(submitted_code, code_hash) = code_hash
  order by created_at desc for update skip locked limit 1;
  if match_id is null then return; end if;
  update public.invite_codes set uses = uses + 1 where id = match_id;
  return query select match_id, match_level, match_editor;
end; $$;

create table if not exists public.module_assets (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('image','video')),
  object_key text not null unique,
  caption text check (char_length(caption) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists module_assets_module_idx on public.module_assets(module_id, created_at);
alter table public.module_assets enable row level security;

drop policy if exists "curriculum modules visible" on public.modules;
drop policy if exists "published modules or staff" on public.modules;
create policy "curriculum modules visible" on public.modules for select to authenticated
using (published or (select public.is_staff()) or (select public.is_curriculum_editor()));
drop policy if exists "editor creates draft modules" on public.modules;
create policy "editor creates draft modules" on public.modules for insert to authenticated
with check ((select public.is_curriculum_editor()) and published = false);
drop policy if exists "editor updates draft modules" on public.modules;
create policy "editor updates draft modules" on public.modules for update to authenticated
using ((select public.is_curriculum_editor()) and published = false)
with check ((select public.is_curriculum_editor()) and published = false);

drop policy if exists "curriculum assets visible" on public.module_assets;
create policy "curriculum assets visible" on public.module_assets for select to authenticated
using ((select public.is_staff()) or (select public.is_curriculum_editor()) or exists (
  select 1 from public.modules where modules.id = module_assets.module_id and modules.published
));
drop policy if exists "editor manages curriculum assets" on public.module_assets;
create policy "editor manages curriculum assets" on public.module_assets for all to authenticated
using ((select public.is_curriculum_editor()) or (select public.is_admin()))
with check (((select public.is_curriculum_editor()) or (select public.is_admin())) and uploader_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('curriculum','curriculum',false,52428800,array['image/jpeg','image/png','image/webp','video/mp4','video/webm'])
on conflict (id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "curriculum editors upload assets" on storage.objects;
create policy "curriculum editors upload assets" on storage.objects for insert to authenticated
with check (bucket_id='curriculum' and (storage.foldername(name))[1] = (select auth.uid())::text and ((select public.is_curriculum_editor()) or (select public.is_admin())));
drop policy if exists "curriculum readers view assets" on storage.objects;
create policy "curriculum readers view assets" on storage.objects for select to authenticated
using (bucket_id='curriculum' and ((select public.is_staff()) or (select public.is_curriculum_editor()) or exists (
  select 1 from public.module_assets join public.modules on modules.id = module_assets.module_id
  where module_assets.object_key = storage.objects.name and modules.published
)));
drop policy if exists "curriculum editors delete assets" on storage.objects;
create policy "curriculum editors delete assets" on storage.objects for delete to authenticated
using (bucket_id='curriculum' and (storage.foldername(name))[1] = (select auth.uid())::text and ((select public.is_curriculum_editor()) or (select public.is_admin())));

grant select on public.module_assets to authenticated;
grant insert,update,delete on public.module_assets to authenticated;
grant execute on function public.is_curriculum_editor() to authenticated;
revoke all on function public.redeem_invite_code(text,public.academy_role) from public, anon, authenticated;
grant execute on function public.redeem_invite_code(text,public.academy_role) to service_role;

-- Editors are stored under the student enum for compatibility, but may not use
-- student submission privileges or appear as course participants.
drop policy if exists "student creates own submission" on public.submissions;
create policy "student creates own submission" on public.submissions for insert to authenticated
with check (student_id = (select auth.uid()) and (select public.current_role()) = 'student' and not (select public.is_curriculum_editor()));
