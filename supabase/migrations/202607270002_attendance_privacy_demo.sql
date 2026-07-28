alter table public.profiles
  add column if not exists is_demo boolean not null default false,
  add column if not exists privacy_accepted_at timestamptz,
  add column if not exists privacy_version text;

alter table public.course_sessions
  add column if not exists semester_key text not null default '2026-spring',
  add column if not exists session_number integer check (session_number between 1 and 10),
  add column if not exists is_demo boolean not null default false;

create unique index if not exists course_sessions_semester_number_idx
  on public.course_sessions(semester_key, level, session_number, is_demo)
  where session_number is not null;

alter table public.announcements
  add column if not exists is_demo boolean not null default false;

create table if not exists public.attendance_limit_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  semester_key text not null,
  absence_count integer not null check (absence_count >= 3),
  email_status text not null default 'pending' check (email_status in ('pending','sent','failed')),
  provider_id text,
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique(student_id, semester_key)
);

alter table public.attendance_limit_events enable row level security;
drop policy if exists "staff read attendance limit events" on public.attendance_limit_events;
create policy "staff read attendance limit events" on public.attendance_limit_events
  for select to authenticated using ((select public.is_staff()));
grant select on public.attendance_limit_events to authenticated;

create or replace function public.create_invite_code(
  plain_code text,
  invite_role public.academy_role,
  invite_level public.academy_level default null,
  invite_max_uses integer default 1,
  invite_expires_at timestamptz default null,
  creator_id uuid default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_id uuid;
begin
  if char_length(plain_code) < 6 or invite_role not in ('student','demonstrator') then
    raise exception 'Invalid invitation code';
  end if;
  if invite_role = 'demonstrator' and plain_code !~ '^[0-9]{6,}$' then
    raise exception 'Staff code must be numeric';
  end if;
  insert into public.invite_codes(code_hash,role,course_level,max_uses,expires_at,created_by)
  values (
    crypt(plain_code, gen_salt('bf', 10)),
    invite_role,
    invite_level,
    invite_max_uses,
    coalesce(invite_expires_at, now() + interval '48 hours'),
    creator_id
  )
  returning id into new_id;
  return new_id;
end; $$;

revoke all on function public.create_invite_code(text,public.academy_role,public.academy_level,integer,timestamptz,uuid) from public, anon, authenticated;
grant execute on function public.create_invite_code(text,public.academy_role,public.academy_level,integer,timestamptz,uuid) to service_role;
