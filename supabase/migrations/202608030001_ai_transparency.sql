-- EU AI Act Article 50 transparency and editorial-accountability safeguards.
-- The application remains human-led: these fields record provenance, review,
-- consent for recognisable likenesses, and genuine student work.

alter table public.modules
  add column if not exists content_origin text not null default 'human'
    check (content_origin in ('human', 'ai_assisted', 'ai_generated')),
  add column if not exists editorial_review_confirmed boolean not null default false,
  add column if not exists reviewed_by uuid references public.profiles(id),
  add column if not exists reviewed_at timestamptz;

alter table public.module_assets
  add column if not exists content_origin text not null default 'human'
    check (content_origin in ('human', 'ai_assisted', 'ai_generated')),
  add column if not exists depicts_identifiable_person boolean not null default false,
  add column if not exists likeness_consent_confirmed boolean not null default false;

alter table public.module_assets drop constraint if exists module_assets_likeness_consent_check;
alter table public.module_assets add constraint module_assets_likeness_consent_check check (
  depicts_identifiable_person = false or likeness_consent_confirmed = true
);

alter table public.announcements
  add column if not exists content_origin text not null default 'human'
    check (content_origin in ('human', 'ai_assisted', 'ai_generated')),
  add column if not exists editorial_review_confirmed boolean not null default false;

alter table public.submissions
  add column if not exists authenticity_confirmed boolean not null default false;

-- Existing material predates this workflow. Keep it available while marking it
-- as human-origin content that still needs a fresh review before republishing.
update public.modules
set editorial_review_confirmed = true,
    reviewed_by = coalesce(reviewed_by, (select id from public.profiles where role = 'admin' order by created_at limit 1)),
    reviewed_at = coalesce(reviewed_at, updated_at, created_at)
where published = true and reviewed_by is null;

alter table public.modules drop constraint if exists modules_publication_review_check;
alter table public.modules add constraint modules_publication_review_check check (
  published = false or (
    editorial_review_confirmed = true and
    reviewed_by is not null and
    reviewed_at is not null
  )
);

-- Restrict direct database access to the same roles and course level enforced
-- by the server routes.
drop policy if exists "staff manage modules" on public.modules;
drop policy if exists "curriculum modules visible" on public.modules;
create policy "curriculum modules visible" on public.modules for select to authenticated
using (
  (published and level = (select rank from public.profiles where id = (select auth.uid())))
  or (select public.is_admin())
  or (select public.is_curriculum_editor())
);

drop policy if exists "admin manages modules" on public.modules;
create policy "admin manages modules" on public.modules for all to authenticated
using ((select public.is_admin()))
with check (
  (select public.is_admin()) and
  (published = false or (
    editorial_review_confirmed = true and
    reviewed_by = (select auth.uid()) and
    reviewed_at is not null
  ))
);

drop policy if exists "curriculum assets visible" on public.module_assets;
create policy "curriculum assets visible" on public.module_assets for select to authenticated
using (
  (select public.is_admin())
  or (select public.is_curriculum_editor())
  or exists (
    select 1 from public.modules
    where modules.id = module_assets.module_id
      and modules.published
      and modules.level = (select rank from public.profiles where id = (select auth.uid()))
  )
);

drop policy if exists "student creates own submission" on public.submissions;
create policy "student creates own submission" on public.submissions for insert to authenticated
with check (
  student_id = (select auth.uid())
  and (select public.current_role()) = 'student'
  and not (select public.is_curriculum_editor())
  and authenticity_confirmed = true
);

drop policy if exists "staff manage announcements" on public.announcements;
create policy "staff manage announcements" on public.announcements for all to authenticated
using ((select public.is_staff()))
with check ((select public.is_staff()) and editorial_review_confirmed = true);

comment on column public.modules.content_origin is 'Human-created, AI-assisted, or AI-generated/manipulated teaching text.';
comment on column public.module_assets.content_origin is 'Origin of the attached image or video for contextual disclosure.';
comment on column public.announcements.editorial_review_confirmed is 'Named staff author accepts human editorial responsibility before publication.';
comment on column public.submissions.authenticity_confirmed is 'Student confirmation that the image is genuine personal practice work and not AI-generated or materially altered.';
