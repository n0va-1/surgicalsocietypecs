import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { consumeRateLimit, isSameOriginRequest } from "@/lib/security";

export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const administrator = await requireRole(["admin"]);
  if (!administrator) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!await consumeRateLimit(request, `mfa-reset:${administrator.id}`, 10, 3600)) return NextResponse.json({ error: "MFA reset limit reached." }, { status: 429 });
  const body = await request.json().catch(() => null) as null | { email?: string };
  const email = body?.email?.trim().toLowerCase();
  if (!email || email === administrator.email.toLowerCase()) return NextResponse.json({ error: "Enter another staff member's account email." }, { status: 400 });
  const admin = createSupabaseAdminClient();
  const { data: target } = await admin.from("profiles").select("id,role,curriculum_editor").eq("email", email).maybeSingle();
  if (!target || (target.role === "student" && !target.curriculum_editor)) return NextResponse.json({ error: "No staff or curriculum editor account was found." }, { status: 404 });
  const { data: factors, error: factorError } = await admin.auth.admin.mfa.listFactors({ userId: target.id });
  if (factorError) return NextResponse.json({ error: "Authenticator factors could not be checked." }, { status: 500 });
  for (const factor of factors.factors) {
    const { error } = await admin.auth.admin.mfa.deleteFactor({ userId: target.id, id: factor.id });
    if (error) return NextResponse.json({ error: "Authenticator reset could not be completed." }, { status: 500 });
  }
  await admin.from("audit_logs").insert({ actor_id: administrator.id, action: "security.mfa_reset", entity_type: "profile", entity_id: target.id, metadata: { factor_count: factors.factors.length } });
  return NextResponse.json({ message: "Authenticator reset. The user was signed out and will receive a new QR code at the next login." });
}
