import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { consumeRateLimit, isSameOriginRequest } from "@/lib/security";
import { validateStoredFile } from "@/lib/uploads";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const profile = await requireRole(["admin", "editor"]);
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!await consumeRateLimit(request, `curriculum-asset:${profile.id}`, 40, 3600)) return NextResponse.json({ error: "Upload limit reached. Please try again later." }, { status: 429 });
  const body = await request.json().catch(() => null) as null | { moduleId?: string; objectKey?: string; kind?: "image" | "video"; caption?: string; contentOrigin?: "human" | "ai_assisted" | "ai_generated"; depictsIdentifiablePerson?: boolean; likenessConsentConfirmed?: boolean };
  const objectKey = body?.objectKey?.trim();
  const caption = body?.caption?.trim().slice(0, 300) || null;
  const contentOrigin = body?.contentOrigin ?? "human";
  const depictsIdentifiablePerson = body?.depictsIdentifiablePerson === true;
  const likenessConsentConfirmed = body?.likenessConsentConfirmed === true;
  if (!body?.moduleId || !objectKey?.startsWith(`${profile.id}/`) || !["image", "video"].includes(body?.kind ?? "")) {
    return NextResponse.json({ error: "Invalid curriculum asset." }, { status: 400 });
  }
  if (!["human", "ai_assisted", "ai_generated"].includes(contentOrigin)) return NextResponse.json({ error: "A valid content origin is required." }, { status: 400 });
  if (depictsIdentifiablePerson && !likenessConsentConfirmed) return NextResponse.json({ error: "Consent must be confirmed for media depicting a recognisable person." }, { status: 400 });
  const admin = createSupabaseAdminClient();
  const kind = body.kind === "video" ? "video" : "image";
  if (!await validateStoredFile("curriculum", objectKey, kind, 50 * 1024 * 1024)) {
    await admin.storage.from("curriculum").remove([objectKey]);
    return NextResponse.json({ error: `The uploaded file is not a valid supported ${kind}.` }, { status: 400 });
  }
  const { data: module } = await admin.from("modules").select("id").eq("id", body.moduleId).maybeSingle();
  if (!module) return NextResponse.json({ error: "Chapter not found." }, { status: 404 });
  const { data, error } = await admin.from("module_assets").insert({ module_id: body.moduleId, uploader_id: profile.id, kind: body.kind, object_key: objectKey, caption, content_origin: contentOrigin, depicts_identifiable_person: depictsIdentifiablePerson, likeness_consent_confirmed: likenessConsentConfirmed }).select("id").single();
  if (error) {
    await admin.storage.from("curriculum").remove([objectKey]);
    return NextResponse.json({ error: "The uploaded file could not be attached to the chapter." }, { status: 500 });
  }
  await admin.from("audit_logs").insert({ actor_id: profile.id, action: "curriculum.asset_added", entity_type: "module_asset", entity_id: data.id, metadata: { module_id: body.moduleId, kind: body.kind, content_origin: contentOrigin, depicts_identifiable_person: depictsIdentifiablePerson, likeness_consent_confirmed: likenessConsentConfirmed } });
  return NextResponse.json({ id: data.id }, { status: 201 });
}

export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const profile = await requireRole(["admin", "editor"]);
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Asset id required." }, { status: 400 });
  const admin = createSupabaseAdminClient();
  const { data: asset } = await admin.from("module_assets").select("id,object_key,uploader_id").eq("id", id).maybeSingle();
  if (!asset || (profile.role !== "admin" && asset.uploader_id !== profile.id)) return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  await admin.storage.from("curriculum").remove([asset.object_key]);
  const { error } = await admin.from("module_assets").delete().eq("id", id);
  return error ? NextResponse.json({ error: "The asset could not be removed." }, { status: 500 }) : NextResponse.json({ ok: true });
}
