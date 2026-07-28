create extension if not exists pgcrypto;

do $$ begin
  create type public.academy_role as enum ('student', 'demonstrator', 'admin');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.academy_level as enum ('beginner', 'intermediate', 'advanced');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.attendance_status as enum ('present', 'late', 'absent');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.submission_status as enum ('pending', 'reviewed', 'resubmit');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.review_outcome as enum ('all_done', 'more_practice');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null check (char_length(full_name) between 2 and 120),
  role public.academy_role not null default 'student',
  rank public.academy_level,
  eligible boolean not null default true,
  preferred_language text not null default 'en' check (preferred_language in ('en','hu')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists profiles_role_idx on public.profiles(role);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, coalesce(new.email, ''), coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(new.email, 'Member'), '@', 1)), 'student')
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.current_role() returns public.academy_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = (select auth.uid());
$$;
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select role in ('demonstrator','admin') from public.profiles where id = (select auth.uid())), false);
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select role = 'admin' from public.profiles where id = (select auth.uid())), false);
$$;

create table if not exists public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  role public.academy_role not null check (role in ('student','demonstrator')),
  course_level public.academy_level,
  created_by uuid references public.profiles(id),
  max_uses integer not null default 1 check (max_uses between 1 and 200),
  uses integer not null default 0 check (uses >= 0),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists invite_codes_active_idx on public.invite_codes(role, expires_at) where revoked_at is null;

create table if not exists public.invite_redemptions (
  id uuid primary key default gen_random_uuid(),
  invite_code_id uuid not null references public.invite_codes(id),
  user_id uuid not null references public.profiles(id) on delete cascade,
  email text not null,
  redeemed_at timestamptz not null default now(),
  unique(invite_code_id, user_id)
);

create or replace function public.create_invite_code(plain_code text, invite_role public.academy_role, invite_level public.academy_level default null, invite_max_uses integer default 1, invite_expires_at timestamptz default null, creator_id uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_id uuid;
begin
  if char_length(plain_code) < 6 or invite_role not in ('student','demonstrator') then raise exception 'Invalid invitation code'; end if;
  if invite_role = 'demonstrator' and plain_code !~ '^[0-9]{6,}$' then raise exception 'Staff code must be numeric'; end if;
  insert into public.invite_codes(code_hash,role,course_level,max_uses,expires_at,created_by)
  values (crypt(plain_code, gen_salt('bf', 10)), invite_role, invite_level, invite_max_uses, invite_expires_at, creator_id)
  returning id into new_id;
  return new_id;
end; $$;

create or replace function public.redeem_invite_code(submitted_code text, requested_role public.academy_role)
returns table(invite_id uuid, course_level public.academy_level)
language plpgsql security definer set search_path = '' as $$
declare match_id uuid; match_level public.academy_level;
begin
  select id, invite_codes.course_level into match_id, match_level
  from public.invite_codes
  where role = requested_role and revoked_at is null and uses < max_uses
    and (expires_at is null or expires_at > now()) and crypt(submitted_code, code_hash) = code_hash
  order by created_at desc for update skip locked limit 1;
  if match_id is null then return; end if;
  update public.invite_codes set uses = uses + 1 where id = match_id;
  return query select match_id, match_level;
end; $$;

create or replace function public.restore_invite_code(restored_invite_id uuid)
returns void language sql security definer set search_path = '' as $$
  update public.invite_codes set uses = greatest(uses - 1, 0) where id = restored_invite_id;
$$;

create table if not exists public.modules (
  id uuid primary key default gen_random_uuid(), level public.academy_level not null, week integer not null check (week > 0),
  title_en text not null, title_hu text not null, introduction_en text, introduction_hu text, technique_en text, technique_hu text,
  application_en text, application_hu text, equipment_en text, equipment_hu text, steps_en jsonb not null default '[]', steps_hu jsonb not null default '[]', video_url text,
  published boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(level, week)
);

create table if not exists public.course_sessions (
  id uuid primary key default gen_random_uuid(), title text not null, level public.academy_level not null, starts_at timestamptz not null,
  created_by uuid not null references public.profiles(id), created_at timestamptz not null default now()
);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(), session_id uuid not null references public.course_sessions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade, status public.attendance_status not null,
  recorded_by uuid not null references public.profiles(id), recorded_at timestamptz not null default now(), correction_note text,
  unique(session_id, student_id)
);
create index if not exists attendance_student_idx on public.attendance_records(student_id);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references public.profiles(id) on delete cascade,
  module_id uuid not null references public.modules(id), object_key text not null unique, reflection text,
  status public.submission_status not null default 'pending', score integer check (score between 1 and 5), outcome public.review_outcome,
  feedback text, reviewed_by uuid references public.profiles(id), reviewed_at timestamptz,
  delete_after timestamptz not null default (now() + interval '6 months'), created_at timestamptz not null default now()
);
create index if not exists submissions_student_idx on public.submissions(student_id);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(), author_id uuid not null references public.profiles(id),
  title_en text not null, title_hu text, body_en text not null, body_hu text,
  target_level text not null check (target_level in ('everyone','beginner','intermediate','advanced')),
  pinned boolean not null default false, published_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key, actor_id uuid references public.profiles(id), action text not null,
  entity_type text not null, entity_id text not null, metadata jsonb, created_at timestamptz not null default now()
);
create index if not exists audit_entity_idx on public.audit_logs(entity_type, entity_id);

insert into public.modules (level, week, title_en, title_hu, published) values
('beginner',1,'Instrument handling','Eszközkezelés',true),
('beginner',2,'Two-handed square knot','Kétkezes laposcsomó',true),
('beginner',3,'Vertical mattress suture','Vertikális matracöltés',true),
('beginner',4,'Simple interrupted suture','Egyszerű csomós varrat',true),
('beginner',5,'Horizontal mattress suture','Horizontális matracöltés',true),
('beginner',6,'Running suture','Tovafutó varrat',true)
on conflict (level,week) do nothing;

create or replace function public.bootstrap_first_admin(admin_email text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare admin_id uuid;
begin
  if exists (select 1 from public.profiles where role = 'admin') then raise exception 'An administrator already exists'; end if;
  update public.profiles set role='admin', rank=null, updated_at=now() where lower(email)=lower(admin_email) returning id into admin_id;
  if admin_id is null then raise exception 'Create and confirm this user in Authentication first'; end if;
  return admin_id;
end; $$;

alter table public.profiles enable row level security;
alter table public.invite_codes enable row level security;
alter table public.invite_redemptions enable row level security;
alter table public.modules enable row level security;
alter table public.course_sessions enable row level security;
alter table public.attendance_records enable row level security;
alter table public.submissions enable row level security;
alter table public.announcements enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "profile own or staff read" on public.profiles;
create policy "profile own or staff read" on public.profiles for select to authenticated using ((select auth.uid()) = id or (select public.is_staff()));
drop policy if exists "profile own update" on public.profiles;
create policy "profile own update" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
drop policy if exists "admin invite codes" on public.invite_codes;
create policy "admin invite codes" on public.invite_codes for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "admin redemptions" on public.invite_redemptions;
create policy "admin redemptions" on public.invite_redemptions for select to authenticated using ((select public.is_admin()));
drop policy if exists "published modules or staff" on public.modules;
create policy "published modules or staff" on public.modules for select to authenticated using (published or (select public.is_staff()));
drop policy if exists "staff manage modules" on public.modules;
create policy "staff manage modules" on public.modules for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
drop policy if exists "sessions visible" on public.course_sessions;
create policy "sessions visible" on public.course_sessions for select to authenticated using (true);
drop policy if exists "staff manage sessions" on public.course_sessions;
create policy "staff manage sessions" on public.course_sessions for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
drop policy if exists "attendance own or staff read" on public.attendance_records;
create policy "attendance own or staff read" on public.attendance_records for select to authenticated using (student_id = (select auth.uid()) or (select public.is_staff()));
drop policy if exists "staff manage attendance" on public.attendance_records;
create policy "staff manage attendance" on public.attendance_records for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
drop policy if exists "submission own or staff read" on public.submissions;
create policy "submission own or staff read" on public.submissions for select to authenticated using (student_id = (select auth.uid()) or (select public.is_staff()));
drop policy if exists "student creates own submission" on public.submissions;
create policy "student creates own submission" on public.submissions for insert to authenticated with check (student_id = (select auth.uid()) and (select public.current_role()) = 'student');
drop policy if exists "staff review submissions" on public.submissions;
create policy "staff review submissions" on public.submissions for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
drop policy if exists "targeted announcements read" on public.announcements;
create policy "targeted announcements read" on public.announcements for select to authenticated using ((select public.is_staff()) or target_level = 'everyone' or target_level = (select rank::text from public.profiles where id = (select auth.uid())));
drop policy if exists "staff manage announcements" on public.announcements;
create policy "staff manage announcements" on public.announcements for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
drop policy if exists "admin audit read" on public.audit_logs;
create policy "admin audit read" on public.audit_logs for select to authenticated using ((select public.is_admin()));

revoke all on all tables in schema public from anon;
grant select on public.profiles, public.modules, public.course_sessions, public.attendance_records, public.submissions, public.announcements to authenticated;
grant update(full_name,preferred_language,updated_at) on public.profiles to authenticated;
grant insert,update,delete on public.modules,public.course_sessions,public.attendance_records,public.submissions,public.announcements to authenticated;
grant select on public.audit_logs to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('submissions','submissions',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "student upload own submissions" on storage.objects;
create policy "student upload own submissions" on storage.objects for insert to authenticated with check (bucket_id='submissions' and (storage.foldername(name))[1] = (select auth.uid())::text and (select public.current_role())='student');
drop policy if exists "submission owner or staff reads" on storage.objects;
create policy "submission owner or staff reads" on storage.objects for select to authenticated using (bucket_id='submissions' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_staff())));
drop policy if exists "student deletes own submission" on storage.objects;
create policy "student deletes own submission" on storage.objects for delete to authenticated using (bucket_id='submissions' and (storage.foldername(name))[1] = (select auth.uid())::text);

revoke all on function public.create_invite_code(text,public.academy_role,public.academy_level,integer,timestamptz,uuid) from public, anon, authenticated;
revoke all on function public.redeem_invite_code(text,public.academy_role) from public, anon, authenticated;
revoke all on function public.restore_invite_code(uuid) from public, anon, authenticated;
revoke all on function public.bootstrap_first_admin(text) from public, anon, authenticated;
grant execute on function public.create_invite_code(text,public.academy_role,public.academy_level,integer,timestamptz,uuid) to service_role;
grant execute on function public.redeem_invite_code(text,public.academy_role) to service_role;
grant execute on function public.restore_invite_code(uuid) to service_role;
grant execute on function public.bootstrap_first_admin(text) to service_role;
