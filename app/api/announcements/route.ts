import { NextResponse } from "next/server";
import { getAuthenticatedProfile, requireRole } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const profile = await getAuthenticatedProfile();
  if (!profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("announcements").select("id,title_en,title_hu,body_en,body_hu,target_level,pinned,published_at,is_demo").eq("is_demo", profile.is_demo).order("pinned", { ascending: false }).order("published_at", { ascending: false }).limit(50);
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ announcements: data }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const staff = await requireRole(["demonstrator", "admin"]);
  if (!staff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
