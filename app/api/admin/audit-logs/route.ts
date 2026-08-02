import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const profile = await requireRole(["admin"]);
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const admin = createSupabaseAdminClient();
  const { data: logs, error } = await admin.from("audit_logs")
    .select("id,actor_id,action,entity_type,entity_id,metadata,created_at")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) return NextResponse.json({ error: "Audit history could not be loaded." }, { status: 500 });
  const actorIds = [...new Set((logs ?? []).flatMap(item => item.actor_id ? [item.actor_id] : []))];
  const { data: actors } = actorIds.length
    ? await admin.from("profiles").select("id,full_name,email").in("id", actorIds)
    : { data: [] };
  return NextResponse.json({
    logs: (logs ?? []).map(item => ({ ...item, actor: actors?.find(actor => actor.id === item.actor_id) ?? null })),
  }, { headers: { "Cache-Control": "no-store" } });
}
