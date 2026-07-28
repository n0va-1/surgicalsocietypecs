import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { requireRole } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { consumeRateLimit, isSameOriginRequest } from "@/lib/security";

export async function GET() {
  if (!await requireRole(["admin"])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("invite_codes").select("id,role,course_level,curriculum_editor,max_uses,uses,expires_at,revoked_at,created_at").order("created_at", { ascending: false });
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ codes: data });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const profile = await requireRole(["admin"]);
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!await consumeRateLimit(request, `invite:${profile.id}`, 30, 3600)) return NextResponse.json({ error: "Code creation limit reached. Please try again later." }, { status: 429 });
  const body = await request.json().catch(() => null) as null | { role?: "student" | "demonstrator" | "editor"; level?: string; maxUses?: number; expiresAt?: string };
  const code = randomInt(10_000_000, 100_000_000).toString();
  const role = body?.role === "student" ? "student" : "demonstrator";
  const curriculumEditor = body?.role === "editor";
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("create_invite_code", {
    plain_code: code, invite_role: role, invite_level: body?.level ?? null,
    invite_max_uses: Math.max(1, Math.min(body?.maxUses ?? 1, 200)), invite_expires_at: body?.expiresAt ?? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    creator_id: profile.id,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (curriculumEditor) {
    const { error: editorError } = await admin.from("invite_codes").update({ curriculum_editor: true }).eq("id", data);
    if (editorError) return NextResponse.json({ error: "The editor permission could not be attached to this code." }, { status: 500 });
  }
  return NextResponse.json({ id: data, code }, { status: 201 });
}

export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const profile = await requireRole(["admin"]);
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Code id required" }, { status: 400 });
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("invite_codes").update({ revoked_at: new Date().toISOString() }).eq("id", id);
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true });
}
