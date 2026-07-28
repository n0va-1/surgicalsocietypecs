import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { consumeRateLimit, isSameOriginRequest, isStrongPassword } from "@/lib/security";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  if (!await consumeRateLimit(request, "registration", 5, 3600)) return NextResponse.json({ error: "Too many registration attempts. Please try again later." }, { status: 429 });
  const body = await request.json().catch(() => null) as null | {
    email?: string; fullName?: string; password?: string; code?: string; requestedArea?: "student" | "staff"; privacyAccepted?: boolean;
  };
  const email = body?.email?.trim().toLowerCase();
  const fullName = body?.fullName?.trim();
  const password = body?.password;
  const code = body?.code?.trim();
  const requestedRole = body?.requestedArea === "staff" ? "demonstrator" : "student";

  if (!email || !emailPattern.test(email) || !fullName || fullName.length > 120 || !password || !isStrongPassword(password) || (requestedRole === "student" && !code) || body?.privacyAccepted !== true) {
    return NextResponse.json({ error: "Please check all registration fields." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: existing } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  if (existing) return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  const { data: redemption, error: codeError } = requestedRole === "student"
    ? await admin.rpc("redeem_invite_code", { submitted_code: code, requested_role: "student" })
    : await admin.rpc("redeem_staff_invitation", { requested_email: email });
  const invite = Array.isArray(redemption) ? redemption[0] : redemption;
  if (codeError || !invite?.invite_id) {
    return NextResponse.json({ error: requestedRole === "student" ? "This student code is invalid, expired or full." : "This email has not been approved for staff access, or its approval has expired." }, { status: 403 });
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

  const curriculumEditor = Boolean(invite.curriculum_editor);
  await admin.from("profiles").update({
    role: curriculumEditor ? "student" : requestedRole,
    curriculum_editor: curriculumEditor,
    rank: requestedRole === "student" ? invite.course_level ?? null : null,
    privacy_accepted_at: new Date().toISOString(),
    privacy_version: "2026-07-draft",
  }).eq("id", data.user.id);
  await admin.from("invite_redemptions").insert({ invite_code_id: invite.invite_id, user_id: data.user.id, email });
  return NextResponse.json({ message: `${curriculumEditor ? "Curriculum editor" : "Account"} created. Check your email to confirm it before logging in.` }, { status: 201 });
}
