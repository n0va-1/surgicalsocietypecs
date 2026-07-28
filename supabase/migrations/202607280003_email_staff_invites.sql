-- Staff access is granted to a named email address. Student access continues
-- to use an event code chosen by the administrator.
alter table public.invite_codes add column if not exists allowed_email text;
alter table public.invite_codes alter column code_hash drop not null;

create index if not exists invite_codes_allowed_email_idx
  on public.invite_codes (lower(allowed_email), expires_at)
  where allowed_email is not null and revoked_at is null;

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
  if char_length(plain_code) < 6 or invite_role <> 'student' then
    raise exception 'Invalid student invitation code';
  end if;
  insert into public.invite_codes(code_hash,role,course_level,max_uses,expires_at,created_by)
  values (
    extensions.crypt(plain_code, extensions.gen_salt('bf')),
    'student', invite_level, invite_max_uses,
    coalesce(invite_expires_at, now() + interval '48 hours'), creator_id
  ) returning id into new_id;
  return new_id;
end; $$;

create or replace function public.redeem_invite_code(submitted_code text, requested_role public.academy_role)
returns table(invite_id uuid, course_level public.academy_level, curriculum_editor boolean)
language plpgsql security definer set search_path = '' as $$
declare match_id uuid; match_level public.academy_level;
begin
  if requested_role <> 'student' then return; end if;
  select id, invite_codes.course_level into match_id, match_level
  from public.invite_codes
  where role = 'student' and code_hash is not null and revoked_at is null and uses < max_uses
    and (expires_at is null or expires_at > now())
    and extensions.crypt(submitted_code, code_hash) = code_hash
  order by created_at desc for update skip locked limit 1;
  if match_id is null then return; end if;
  update public.invite_codes set uses = uses + 1 where id = match_id;
  return query select match_id, match_level, false;
end; $$;

create or replace function public.redeem_staff_invitation(requested_email text)
returns table(invite_id uuid, curriculum_editor boolean)
language plpgsql security definer set search_path = '' as $$
declare match_id uuid; match_editor boolean;
begin
  select id, invite_codes.curriculum_editor into match_id, match_editor
  from public.invite_codes
  where role = 'demonstrator' and allowed_email is not null
    and lower(allowed_email) = lower(trim(requested_email))
    and revoked_at is null and uses < max_uses
    and (expires_at is null or expires_at > now())
  order by created_at desc for update skip locked limit 1;
  if match_id is null then return; end if;
  update public.invite_codes set uses = uses + 1 where id = match_id;
  return query select match_id, coalesce(match_editor, false);
end; $$;

revoke all on function public.create_invite_code(text,public.academy_role,public.academy_level,integer,timestamptz,uuid) from public, anon, authenticated;
revoke all on function public.redeem_invite_code(text,public.academy_role) from public, anon, authenticated;
revoke all on function public.redeem_staff_invitation(text) from public, anon, authenticated;
grant execute on function public.create_invite_code(text,public.academy_role,public.academy_level,integer,timestamptz,uuid) to service_role;
grant execute on function public.redeem_invite_code(text,public.academy_role) to service_role;
grant execute on function public.redeem_staff_invitation(text) to service_role;
