import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const staff = await requireRole(["demonstrator", "admin"]);
  if (!staff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await context.params;
  const body = await request.json().catch(() => null) as null | { score?: number; outcome?: "all_done" | "more_practice"; feedback?: string };
  if (!Number.isInteger(body?.score) || (body?.score ?? 0) < 1 || (body?.score ?? 0) > 5 || !["all_done", "more_practice"].includes(body?.outcome ?? "")) {
    return NextResponse.json({ error: "A score from 1–5 and outcome are required." }, { status: 400 });
  }
  const admin = createSupabaseAdminClient();
  if (staff.is_demo) {
    const { data: submission } = await admin.from("submissions").select("student_id").eq("id", id).maybeSingle();
    const { data: student } = submission
      ? await admin.from("profiles").select("is_demo").eq("id", submission.student_id).maybeSingle()
      : { data: null };
    if (!student?.is_demo) return NextResponse.json({ error: "Demo accounts can review demo records only." }, { status: 403 });
  }
  const status = body?.outcome === "all_done" ? "reviewed" : "resubmit";
  const { error } = await admin.from("submissions").update({ score: body?.score, outcome: body?.outcome, feedback: body?.feedback?.trim() || null, status, reviewed_by: staff.id, reviewed_at: new Date().toISOString() }).eq("id", id);
  if (!error) await admin.from("audit_logs").insert({ actor_id: staff.id, action: "submission.reviewed", entity_type: "submission", entity_id: id, metadata: { score: body?.score, outcome: body?.outcome } });
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true });
}
