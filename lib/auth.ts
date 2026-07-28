import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AcademyRole = "student" | "demonstrator" | "admin" | "editor";
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
  curriculum_editor: boolean;
};

export async function getAuthenticatedProfile() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data: storedProfile } = await supabase
    .from("profiles")
    .select("id,email,full_name,role,rank,eligible,is_demo,avatar_path,curriculum_editor")
    .eq("id", user.id)
    .single<Omit<AcademyProfile, "role"> & { role: Exclude<AcademyRole, "editor"> }>();
  if (!storedProfile) return null;
  return { ...storedProfile, role: storedProfile.curriculum_editor ? "editor" : storedProfile.role } as AcademyProfile;
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
