import { NextResponse } from "next/server";
import { getAuthenticatedProfile } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const profile = await getAuthenticatedProfile();
  if (!profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { data } = profile.avatar_path
    ? await createSupabaseAdminClient().storage.from("avatars").createSignedUrl(profile.avatar_path, 3600)
    : { data: null };
  return NextResponse.json({ profile: { ...profile, avatarUrl: data?.signedUrl ?? null } }, { headers: { "Cache-Control": "no-store" } });
}
