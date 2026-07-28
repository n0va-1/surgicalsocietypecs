import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AcademyRole = "student" | "demonstrator" | "admin";
export type AcademyLevel = "beginner" | "intermediate" | "advanced";

export type AcademyProfile = {
  id: string;
  email: string;
  full_name: string;
  role: AcademyRole;
  rank: AcademyLevel | null;
  eligible: boolean;
  is_demo: boolean;
  avatar_path: string | null;
};

export async function getAuthenticatedProfile() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,email,full_name,role,rank,eligible,is_demo,avatar_path")
    .eq("id", user.id)
    .single<AcademyProfile>();
  return profile ?? null;
}

export async function requireRole(allowed: AcademyRole[]) {
  const profile = await getAuthenticatedProfile();
  if (!profile || !allowed.includes(profile.role)) return null;
  if (profile.role !== "student") {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (data?.currentLevel !== "aal2") return null;
  }
  return profile;
}

export async function getMfaState() {
  const supabase = await createSupabaseServerClient();
  const [{ data: assurance }, { data: factors }] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
  ]);
  return {
    currentLevel: assurance?.currentLevel ?? null,
    nextLevel: assurance?.nextLevel ?? null,
    enrolled: Boolean(factors?.totp.some(factor => factor.status === "verified")),
  };
}
