import { NextResponse } from "next/server";
import { getAuthenticatedProfile, getMfaState } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { consumeRateLimit, isSameOriginRequest } from "@/lib/security";

export async function GET() {
  const profile = await getAuthenticatedProfile();
  if (!profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const [{ data, error }, { data: reads }] = await Promise.all([
    supabase.from("announcements").select("id,title_en,title_hu,body_en,body_hu,target_level,pinned,published_at,is_demo").eq("is_demo", profile.is_demo).order("pinned", { ascending: false }).order("published_at", { ascending: false }).limit(50),
    admin.from("audit_logs").select("entity_id").eq("actor_id", profile.id).eq("action", "announcement.read"),
  ]);
  const readIds = new Set((reads ?? []).map(item => item.entity_id));
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ announcements: (data ?? []).map(item => ({ ...item, read: readIds.has(item.id) })) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const staff = await getAuthenticatedProfile();
  if (!staff) return NextResponse.json({ error: "Please sign in again before publishing an announcement." }, { status: 401 });
  if (staff.role !== "demonstrator" && staff.role !== "admin") {
    return NextResponse.json({ error: "Only demonstrators and administrators can publish announcements." }, { status: 403 });
  }
  const mfa = await getMfaState();
  if (mfa.currentLevel !== "aal2") {
    return NextResponse.json({ error: "Please verify your authenticator before publishing an announcement." }, { status: 403 });
  }
  if (!await consumeRateLimit(request, `announcement:${staff.id}`, 20, 3600)) return NextResponse.json({ error: "Announcement limit reached. Please try again later." }, { status: 429 });
  const body = await request.json().catch(() => null) as null | { title?: string; titleHu?: string; message?: string; messageHu?: string; target?: string; pinned?: boolean };
  const targets = ["everyone", "beginner", "intermediate", "advanced"];
  const target = body?.target?.toLowerCase() ?? "everyone";
  if (!body?.title?.trim() || !body.message?.trim() || !targets.includes(target)) return NextResponse.json({ error: "Title, message and a valid target are required." }, { status: 400 });
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("announcements").insert({
    author_id: staff.id, title_en: body.title.trim(), title_hu: body.titleHu?.trim() || null,
    body_en: body.message.trim(), body_hu: body.messageHu?.trim() || null, target_level: target, pinned: Boolean(body.pinned), is_demo: staff.is_demo,
  }).select("id").single();
  if (!error && data) await admin.from("audit_logs").insert({ actor_id: staff.id, action: "announcement.published", entity_type: "announcement", entity_id: data.id, metadata: { target } });
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ id: data.id }, { status: 201 });
}
