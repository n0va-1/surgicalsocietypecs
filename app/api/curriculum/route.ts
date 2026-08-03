import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { consumeRateLimit, isSameOriginRequest } from "@/lib/security";

type CurriculumBody = {
  id?: string;
  level?: "beginner" | "intermediate" | "advanced";
  week?: number;
  title_en?: string;
  title_hu?: string;
  introduction_en?: string;
  introduction_hu?: string;
  technique_en?: string;
  technique_hu?: string;
  application_en?: string;
  application_hu?: string;
  equipment_en?: string;
  equipment_hu?: string;
  steps_en?: string[];
  steps_hu?: string[];
  video_url?: string;
  content_origin?: "human" | "ai_assisted" | "ai_generated";
  editorial_review_confirmed?: boolean;
  published?: boolean;
};

function cleanText(value: unknown, max = 8000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanExternalUrl(value: unknown) {
  const candidate = cleanText(value, 1000);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const profile = await requireRole(["student", "admin", "editor"]);
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const admin = createSupabaseAdminClient();
  let query = admin.from("modules").select("*").order("level").order("week");
  if (profile.role === "student") query = query.eq("published", true).eq("level", profile.rank ?? "beginner");
  const { data: modules, error } = await query;
  if (error) return NextResponse.json({ error: "Curriculum could not be loaded." }, { status: 500 });
  const moduleIds = (modules ?? []).map(module => module.id);
  const reviewerIds = [...new Set((modules ?? []).flatMap(module => module.reviewed_by ? [module.reviewed_by] : []))];
  const assetsRequest = moduleIds.length
    ? admin.from("module_assets").select("id,module_id,kind,object_key,caption,content_origin,depicts_identifiable_person,likeness_consent_confirmed,created_at").in("module_id", moduleIds).order("created_at")
    : Promise.resolve({ data: [] });
  const reviewersRequest = reviewerIds.length
    ? admin.from("profiles").select("id,full_name").in("id", reviewerIds)
    : Promise.resolve({ data: [] });
  const [{ data: assets }, { data: reviewers }] = await Promise.all([assetsRequest, reviewersRequest]);
  const signedAssets = await Promise.all((assets ?? []).map(async asset => {
    const { data } = await admin.storage.from("curriculum").createSignedUrl(asset.object_key, 3600);
    return { ...asset, url: data?.signedUrl ?? null };
  }));
  return NextResponse.json({ modules: (modules ?? []).map(module => ({ ...module, reviewer_name: reviewers?.find(reviewer => reviewer.id === module.reviewed_by)?.full_name ?? null, assets: signedAssets.filter(asset => asset.module_id === module.id) })) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const profile = await requireRole(["admin", "editor"]);
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!await consumeRateLimit(request, `curriculum:${profile.id}`, 80, 3600)) return NextResponse.json({ error: "Too many curriculum changes. Please try again later." }, { status: 429 });
  const body = await request.json().catch(() => null) as CurriculumBody | null;
  const level = body?.level;
  const week = Number(body?.week);
  const titleEn = cleanText(body?.title_en, 180);
  const titleHu = cleanText(body?.title_hu, 180);
  const contentOrigin = body?.content_origin ?? "human";
  if (!level || !["beginner", "intermediate", "advanced"].includes(level) || !Number.isInteger(week) || week < 1 || week > 30 || !titleEn || !titleHu) {
    return NextResponse.json({ error: "Level, week and both chapter titles are required." }, { status: 400 });
  }
  if (!["human", "ai_assisted", "ai_generated"].includes(contentOrigin)) return NextResponse.json({ error: "A valid content origin is required." }, { status: 400 });
  const published = profile.role === "admin" && body?.published === true;
  const editorialReviewConfirmed = profile.role === "admin" && body?.editorial_review_confirmed === true;
  if (published && !editorialReviewConfirmed) return NextResponse.json({ error: "Complete the human medical and editorial review before publishing." }, { status: 400 });
  const record = {
    level, week, title_en: titleEn, title_hu: titleHu,
    introduction_en: cleanText(body?.introduction_en), introduction_hu: cleanText(body?.introduction_hu),
    technique_en: cleanText(body?.technique_en), technique_hu: cleanText(body?.technique_hu),
    application_en: cleanText(body?.application_en), application_hu: cleanText(body?.application_hu),
    equipment_en: cleanText(body?.equipment_en, 3000), equipment_hu: cleanText(body?.equipment_hu, 3000),
    steps_en: Array.isArray(body?.steps_en) ? body.steps_en.map(step => cleanText(step, 1000)).filter(Boolean).slice(0, 30) : [],
    steps_hu: Array.isArray(body?.steps_hu) ? body.steps_hu.map(step => cleanText(step, 1000)).filter(Boolean).slice(0, 30) : [],
    video_url: cleanExternalUrl(body?.video_url), content_origin: contentOrigin, published,
    editorial_review_confirmed: editorialReviewConfirmed,
    reviewed_by: editorialReviewConfirmed ? profile.id : null,
    reviewed_at: editorialReviewConfirmed ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  const admin = createSupabaseAdminClient();
  if (body?.id && profile.role === "editor") {
    const { data: existing } = await admin.from("modules").select("published").eq("id", body.id).maybeSingle();
    if (!existing || existing.published) return NextResponse.json({ error: "Published chapters are read-only for curriculum editors. Ask the administrator to return it to draft first." }, { status: 403 });
  }
  const operation = body?.id
    ? admin.from("modules").update(record).eq("id", body.id).select("id").single()
    : admin.from("modules").insert(record).select("id").single();
  const { data, error } = await operation;
  if (error) return NextResponse.json({ error: error.code === "23505" ? "A chapter already uses that level and week." : "The chapter could not be saved." }, { status: 400 });
  await admin.from("audit_logs").insert({ actor_id: profile.id, action: body?.id ? "curriculum.updated" : "curriculum.created", entity_type: "module", entity_id: data.id, metadata: { published, content_origin: contentOrigin, editorial_review_confirmed: editorialReviewConfirmed } });
  return NextResponse.json({ id: data.id, published }, { status: body?.id ? 200 : 201 });
}
