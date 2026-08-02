import { NextResponse } from "next/server";
import { getAuthenticatedProfile } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { consumeRateLimit, isSameOriginRequest } from "@/lib/security";
import { validateStoredFile } from "@/lib/uploads";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const profile = await getAuthenticatedProfile();
  if (!profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!await consumeRateLimit(request, `avatar:${profile.id}`, 10, 3600)) return NextResponse.json({ error: "Profile-picture limit reached." }, { status: 429 });
  const body = await request.json().catch(() => null) as null | { objectKey?: string };
  const objectKey = body?.objectKey?.trim();
  if (!objectKey || objectKey !== `${profile.id}/profile-picture`) return NextResponse.json({ error: "Invalid profile picture." }, { status: 400 });
  const admin = createSupabaseAdminClient();
  if (!await validateStoredFile("avatars", objectKey, "image", 5 * 1024 * 1024)) {
    await admin.storage.from("avatars").remove([objectKey]);
    return NextResponse.json({ error: "The uploaded file is not a valid supported image." }, { status: 400 });
  }
  const { error } = await admin.from("profiles").update({ avatar_path: objectKey, updated_at: new Date().toISOString() }).eq("id", profile.id);
  return error ? NextResponse.json({ error: "The profile picture could not be saved." }, { status: 500 }) : NextResponse.json({ ok: true });
}
