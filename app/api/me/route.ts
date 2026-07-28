import { NextResponse } from "next/server";
import { getAuthenticatedProfile, getMfaState } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSameOriginRequest } from "@/lib/security";

export async function GET() {
  const profile = await getAuthenticatedProfile();
  if (!profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const avatarEmoji = profile.avatar_path?.startsWith("emoji:") ? profile.avatar_path.slice(6) : null;
  const [{ data }, mfa] = await Promise.all([profile.avatar_path && !avatarEmoji
    ? await createSupabaseAdminClient().storage.from("avatars").createSignedUrl(profile.avatar_path, 3600)
    : Promise.resolve({ data: null }), getMfaState()]);
  return NextResponse.json({ profile: { ...profile, avatarUrl: data?.signedUrl ?? null, avatar_emoji: avatarEmoji }, mfa }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const profile = await getAuthenticatedProfile();
  if (!profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const body = await request.json().catch(() => null) as null | { fullName?: string; language?: "en" | "hu"; avatarEmoji?: string | null };
  const fullName = body?.fullName?.trim();
  const emoji = body?.avatarEmoji?.trim() || null;
  if ((fullName && (fullName.length < 2 || fullName.length > 120)) || (body?.language && !["en", "hu"].includes(body.language)) || (emoji && emoji.length > 16)) {
    return NextResponse.json({ error: "Please check the profile details." }, { status: 400 });
  }
  const updates: Record<string, string | null> = { updated_at: new Date().toISOString() };
  if (fullName) updates.full_name = fullName;
  if (body?.language) updates.preferred_language = body.language;
  if (body && "avatarEmoji" in body) updates.avatar_path = emoji ? `emoji:${emoji}` : profile.avatar_path?.startsWith("emoji:") ? null : profile.avatar_path;
  const { error } = await createSupabaseAdminClient().from("profiles").update(updates).eq("id", profile.id);
  return error ? NextResponse.json({ error: "Profile changes could not be saved." }, { status: 500 }) : NextResponse.json({ ok: true });
}
