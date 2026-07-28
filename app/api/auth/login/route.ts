import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isFailedAttemptRateLimited, isSameOriginRequest, recordFailedAttempt } from "@/lib/security";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const body = await request.json().catch(() => null) as null | { email?: string; password?: string };
  const email = body?.email?.trim().toLowerCase();
  if (!email || !body?.password || body.password.length > 128) {
    return NextResponse.json({ error: "The email or password is incorrect." }, { status: 400 });
  }
  if (await isFailedAttemptRateLimited(request, "password-login", 8, 600, email)) {
    return NextResponse.json({ error: "Too many unsuccessful login attempts. Please wait ten minutes and try again." }, { status: 429 });
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password: body.password });
  if (error) {
    await recordFailedAttempt(request, "password-login", email);
    return NextResponse.json({ error: "The email or password is incorrect, or the email is not confirmed yet." }, { status: 401 });
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
