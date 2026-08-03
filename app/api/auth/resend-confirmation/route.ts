import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { consumeRateLimit, isSameOriginRequest } from "@/lib/security";
import { getSiteUrl } from "@/lib/site-url";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  if (!await consumeRateLimit(request, "confirmation-resend", 3, 3600)) {
    return NextResponse.json({ error: "Too many confirmation requests. Please try again later." }, { status: 429 });
  }
  const body = await request.json().catch(() => null) as null | { email?: string };
  const email = body?.email?.trim().toLowerCase();
  if (!email || !emailPattern.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ error: "Authentication is not configured." }, { status: 500 });
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${getSiteUrl(request)}/?emailConfirmed=1` },
  });

  return NextResponse.json({ message: "If the account still needs confirmation, a new email has been sent." }, { headers: { "Cache-Control": "no-store" } });
}
