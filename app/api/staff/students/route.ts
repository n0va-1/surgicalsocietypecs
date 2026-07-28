import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const staff = await requireRole(["demonstrator", "admin"]);
  if (!staff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const admin = createSupabaseAdminClient();
  const profileQuery = admin.from("profiles").select("id,full_name,email,rank,eligible,is_demo,avatar_path,created_at").eq("role", "student").eq("is_demo", staff.is_demo).order("full_name");
  const [{ data: profiles, error }, { data: submissions }, { data: attendance }] = await Promise.all([
    profileQuery,
    admin.from("submissions").select("student_id,status,score,created_at"),
    admin.from("attendance_records").select("student_id,status,recorded_at"),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const students = await Promise.all((profiles ?? []).map(async profile => {
    const work = (submissions ?? []).filter(item => item.student_id === profile.id);
    const records = (attendance ?? []).filter(item => item.student_id === profile.id);
    const reviewed = work.filter(item => item.status === "reviewed");
    const { data: avatar } = profile.avatar_path ? await admin.storage.from("avatars").createSignedUrl(profile.avatar_path, 3600) : { data: null };
    return {
      ...profile,
      avatarUrl: avatar?.signedUrl ?? null,
      completed: reviewed.length,
      pending: work.filter(item => item.status === "pending").length,
      averageScore: reviewed.length ? reviewed.reduce((sum, item) => sum + (item.score ?? 0), 0) / reviewed.length : null,
      absences: records.filter(item => item.status === "absent").length,
      lastActivity: [...work.map(item => item.created_at), ...records.map(item => item.recorded_at)].sort().at(-1) ?? profile.created_at,
    };
  }));
  return NextResponse.json({ students }, { headers: { "Cache-Control": "no-store" } });
}
