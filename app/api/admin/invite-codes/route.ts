import { NextResponse } from "next/server";
import { getAuthenticatedProfile, getMfaState } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { consumeRateLimit, isSameOriginRequest } from "@/lib/security";

export async function GET() {
  const profile = await getAuthenticatedProfile();
  if (!profile) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Only the administrator can view invitation codes." }, { status: 403 });
  if ((await getMfaState()).currentLevel !== "aal2") return NextResponse.json({ error: "Please verify your authenticator to view invitation codes." }, { status: 403 });
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("invite_codes").select("id,role,course_level,curriculum_editor,allowed_email,max_uses,uses,expires_at,revoked_at,created_at").order("created_at", { ascending: false });
  return error ? NextResponse.json({ error: "Invitation access could not be loaded." }, { status: 500 }) : NextResponse.json({ codes: data });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const profile = await getAuthenticatedProfile();
  if (!profile) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Only the administrator can generate invitation codes." }, { status: 403 });
  if ((await getMfaState()).currentLevel !== "aal2") return NextResponse.json({ error: "Please verify your authenticator before generating an invitation code." }, { status: 403 });
  if (!await consumeRateLimit(request, `invite:${profile.id}`, 30, 3600)) return NextResponse.json({ error: "Code creation limit reached. Please try again later." }, { status: 429 });
  const body = await request.json().catch(() => null) as null | { role?: "student" | "demonstrator" | "editor"; level?: string; maxUses?: number; expiresAt?: string; code?: string; email?: string };
  const code = body?.code?.trim();
  const allowedEmail = body?.email?.trim().toLowerCase();
  const role = body?.role === "student" ? "student" : "demonstrator";
  const curriculumEditor = body?.role === "editor";
  const admin = createSupabaseAdminClient();
  if (role === "demonstrator") {
    if (!allowedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(allowedEmail)) return NextResponse.json({ error: "Enter the exact staff email address to approve." }, { status: 400 });
    await admin.from("invite_codes").update({ revoked_at: new Date().toISOString() }).eq("role", "demonstrator").ilike("allowed_email", allowedEmail).is("revoked_at", null);
    const { data, error } = await admin.from("invite_codes").insert({
      code_hash: null, role: "demonstrator", course_level: null, curriculum_editor: curriculumEditor,
      allowed_email: allowedEmail, max_uses: 1, expires_at: body?.expiresAt ?? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), created_by: profile.id,
    }).select("id").single();
    return error ? NextResponse.json({ error: "The staff email could not be approved." }, { status: 400 }) : NextResponse.json({ id: data.id, allowedEmail }, { status: 201 });
  }
  if (!code || code.length < 6) return NextResponse.json({ error: "Student event codes must contain at least six characters." }, { status: 400 });
  const { data, error } = await admin.rpc("create_invite_code", {
    plain_code: code, invite_role: role, invite_level: body?.level ?? null,
    invite_max_uses: Math.max(1, Math.min(body?.maxUses ?? 1, 200)), invite_expires_at: body?.expiresAt ?? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    creator_id: profile.id,
  });
  if (error) return NextResponse.json({ error: "The student event code could not be created." }, { status: 400 });
  return NextResponse.json({ id: data, code }, { status: 201 });
}

export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const profile = await getAuthenticatedProfile();
  if (!profile) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Only the administrator can revoke invitation codes." }, { status: 403 });
  if ((await getMfaState()).currentLevel !== "aal2") return NextResponse.json({ error: "Please verify your authenticator before revoking an invitation code." }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Code id required" }, { status: 400 });
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("invite_codes").update({ revoked_at: new Date().toISOString() }).eq("id", id);
  return error ? NextResponse.json({ error: "The invitation access could not be revoked." }, { status: 500 }) : NextResponse.json({ ok: true });
}
