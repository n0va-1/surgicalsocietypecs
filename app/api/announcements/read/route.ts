import { NextResponse } from "next/server";
import { getAuthenticatedProfile } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSameOriginRequest } from "@/lib/security";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const profile = await getAuthenticatedProfile();
  if (!profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const body = await request.json().catch(() => null) as null | { ids?: string[] };
  const ids = [...new Set((body?.ids ?? []).filter(id => /^[0-9a-f-]{36}$/i.test(id)))].slice(0, 50);
  if (!ids.length) return NextResponse.json({ ok: true });
  const admin = createSupabaseAdminClient();
  const { data: visible } = await admin.from("announcements").select("id").in("id", ids).eq("is_demo", profile.is_demo);
  const visibleIds = (visible ?? []).map(item => item.id);
  const { data: existing } = visibleIds.length ? await admin.from("audit_logs").select("entity_id").eq("actor_id", profile.id).eq("action", "announcement.read").in("entity_id", visibleIds) : { data: [] };
  const existingIds = new Set((existing ?? []).map(item => item.entity_id));
  const rows = visibleIds.filter(id => !existingIds.has(id)).map(id => ({ actor_id: profile.id, action: "announcement.read", entity_type: "announcement", entity_id: id }));
  const { error } = rows.length ? await admin.from("audit_logs").insert(rows) : { error: null };
  return error ? NextResponse.json({ error: "Notifications could not be updated." }, { status: 500 }) : NextResponse.json({ ok: true });
}
