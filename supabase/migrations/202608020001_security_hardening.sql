create table if not exists public.security_rate_limits (
  bucket text not null,
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  expires_at timestamptz not null,
  primary key (bucket, window_start)
);

alter table public.security_rate_limits enable row level security;
revoke all on public.security_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on public.security_rate_limits to service_role;

create or replace function public.consume_security_rate_limit(
  requested_bucket text,
  maximum_requests integer,
  window_seconds integer
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  active_window timestamptz;
  current_count integer;
begin
  if requested_bucket is null or length(requested_bucket) < 16 or maximum_requests < 1 or window_seconds < 1 then
    return false;
  end if;
  active_window := to_timestamp(floor(extract(epoch from clock_timestamp()) / window_seconds) * window_seconds);
  delete from public.security_rate_limits where expires_at < clock_timestamp();
  insert into public.security_rate_limits (bucket, window_start, request_count, expires_at)
  values (requested_bucket, active_window, 1, active_window + make_interval(secs => window_seconds * 2))
  on conflict (bucket, window_start) do update
    set request_count = public.security_rate_limits.request_count + 1
  returning request_count into current_count;
  return current_count <= maximum_requests;
end;
$$;

create or replace function public.security_rate_limit_reached(
  requested_bucket text,
  maximum_requests integer,
  window_seconds integer
) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select request_count >= maximum_requests
    from public.security_rate_limits
    where bucket = requested_bucket
      and window_start = to_timestamp(floor(extract(epoch from clock_timestamp()) / window_seconds) * window_seconds)
  ), false)
$$;

revoke all on function public.consume_security_rate_limit(text,integer,integer) from public, anon, authenticated;
revoke all on function public.security_rate_limit_reached(text,integer,integer) from public, anon, authenticated;
grant execute on function public.consume_security_rate_limit(text,integer,integer) to service_role;
grant execute on function public.security_rate_limit_reached(text,integer,integer) to service_role;

drop policy if exists "editor manages curriculum assets" on public.module_assets;
create policy "editor manages own curriculum assets" on public.module_assets for all to authenticated
using ((select public.is_admin()) or ((select public.is_curriculum_editor()) and uploader_id = (select auth.uid())))
with check (((select public.is_admin()) or (select public.is_curriculum_editor())) and uploader_id = (select auth.uid()));

alter table public.submissions add column if not exists report_sent_at timestamptz;
alter table public.submissions add column if not exists photo_deleted_at timestamptz;
create index if not exists submissions_retention_idx on public.submissions(created_at)
  where photo_deleted_at is null;

revoke update on public.profiles from authenticated;
grant update (full_name, preferred_language, avatar_path, updated_at) on public.profiles to authenticated;
