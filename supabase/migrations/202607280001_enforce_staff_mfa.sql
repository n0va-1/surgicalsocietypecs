-- Defense in depth: staff and administrator RLS policies that call these
-- helpers require an AAL2 session in addition to the correct stored role.
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select role in ('demonstrator','admin') from public.profiles where id = (select auth.uid())),
    false
  ) and coalesce((select auth.jwt()->>'aal' = 'aal2'), false);
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = (select auth.uid())),
    false
  ) and coalesce((select auth.jwt()->>'aal' = 'aal2'), false);
$$;
