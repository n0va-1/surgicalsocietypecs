import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as null | {
    email?: string; fullName?: string; password?: string; code?: string; requestedArea?: "student" | "staff"; privacyAccepted?: boolean;
  };
  const email = body?.email?.trim().toLowerCase();
  const fullName = body?.fullName?.trim();
  const password = body?.password;
  const code = body?.code?.trim();
  const requestedRole = body?.requestedArea === "staff" ? "demonstrator" : "student";

  if (!email || !emailPattern.test(email) || !fullName || fullName.length > 120 || !password || password.length < 8 || !code || body?.privacyAccepted !== true) {
    return NextResponse.json({ error: "Please check all registration fields." }, { status: 400 });
  }
  if (requestedRole === "demonstrator" && !/^\d{6,}$/.test(code)) {
    return NextResponse.json({ error: "Staff codes must contain at least six digits." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: existing } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  if (existing) return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  const { data: redemption, error: codeError } = await admin.rpc("redeem_invite_code", {
    submitted_code: code,
    requested_role: requestedRole,
  });
  const invite = Array.isArray(redemption) ? redemption[0] : redemption;
  if (codeError || !invite?.invite_id) {
    return NextResponse.json({ error: "This access code is invalid, expired or already used." }, { status: 403 });
  }

  const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!publicUrl || !publicKey) return NextResponse.json({ error: "Authentication is not configured." }, { status: 500 });
  const signupClient = createClient(publicUrl, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await signupClient.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error || !data.user) {
    await admin.rpc("restore_invite_code", { restored_invite_id: invite.invite_id });
    const duplicate = error?.message.toLowerCase().includes("already") || error?.message.toLowerCase().includes("registered");
    return NextResponse.json({ error: duplicate ? "An account with this email already exists." : "The account could not be created." }, { status: duplicate ? 409 : 500 });
  }

  await admin.from("profiles").update({
    role: requestedRole,
    rank: invite.course_level ?? null,
    privacy_accepted_at: new Date().toISOString(),
    privacy_version: "2026-07-draft",
  }).eq("id", data.user.id);
  await admin.from("invite_redemptions").insert({ invite_code_id: invite.invite_id, user_id: data.user.id, email });
  return NextResponse.json({ message: "Account created. Check your email to confirm it before logging in." }, { status: 201 });
}
