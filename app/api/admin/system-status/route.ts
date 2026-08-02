import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const profile = await requireRole(["admin"]);
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { error } = await createSupabaseAdminClient().from("profiles").select("id", { head: true, count: "exact" });
  return NextResponse.json({
    database: !error,
    email: Boolean(process.env.RESEND_API_KEY),
    sender: Boolean(process.env.ATTENDANCE_FROM_EMAIL),
    retentionSchedule: Boolean(process.env.CRON_SECRET),
    staffMfa: true,
  }, { headers: { "Cache-Control": "no-store" } });
}
