import { NextResponse } from "next/server";
import { getAuthenticatedProfile, requireRole } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { consumeRateLimit, isSameOriginRequest } from "@/lib/security";
import { validateStoredFile } from "@/lib/uploads";

export async function GET() {
  const profile = await getAuthenticatedProfile();
  if (!profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (profile.role === "editor") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const admin = createSupabaseAdminClient();
  let query = admin.from("submissions").select("id,student_id,module_id,object_key,reflection,status,score,outcome,feedback,reviewed_by,reviewed_at,created_at").order("created_at", { ascending: false });
  if (profile.role === "student") query = query.eq("student_id", profile.id);
  if (profile.role !== "student") {
    const { data: visibleStudents } = await admin.from("profiles").select("id").eq("role", "student").eq("is_demo", profile.is_demo);
    const ids = (visibleStudents ?? []).map(student => student.id);
    if (!ids.length) return NextResponse.json({ submissions: [] }, { headers: { "Cache-Control": "no-store" } });
    query = query.in("student_id", ids);
  }
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Submissions could not be loaded." }, { status: 500 });
  const moduleIds = [...new Set((data ?? []).map(item => item.module_id))];
  const studentIds = [...new Set((data ?? []).map(item => item.student_id))];
  const [{ data: modules }, { data: students }] = await Promise.all([
    moduleIds.length ? admin.from("modules").select("id,title_en,title_hu,week,level").in("id", moduleIds) : Promise.resolve({ data: [] }),
    profile.role === "student" || !studentIds.length ? Promise.resolve({ data: [] }) : admin.from("profiles").select("id,full_name,rank").in("id", studentIds),
  ]);
  const rows = (data ?? []).map(item => ({ ...item, module: modules?.find(module => module.id === item.module_id) ?? null, student: students?.find(student => student.id === item.student_id) ?? null }));
  return NextResponse.json({ submissions: rows }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const student = await requireRole(["student"]);
  if (!student || !student.eligible) return NextResponse.json({ error: student ? "Attendance eligibility is required." : "Forbidden" }, { status: 403 });
  if (!await consumeRateLimit(request, `submission:${student.id}`, 12, 3600)) return NextResponse.json({ error: "Submission limit reached. Please try again later." }, { status: 429 });
  const body = await request.json().catch(() => null) as null | { moduleId?: string; objectKey?: string; reflection?: string };
  if (!body?.moduleId || !body.objectKey?.startsWith(`${student.id}/`)) return NextResponse.json({ error: "Invalid submission metadata." }, { status: 400 });
  const admin = createSupabaseAdminClient();
  if (!await validateStoredFile("submissions", body.objectKey, "image", 10 * 1024 * 1024)) {
    await admin.storage.from("submissions").remove([body.objectKey]);
    return NextResponse.json({ error: "The uploaded file is not a valid supported image." }, { status: 400 });
  }
  const { data: module } = await admin.from("modules").select("id,level,published").eq("id", body.moduleId).maybeSingle();
  if (!module?.published || module.level !== student.rank) {
    await admin.storage.from("submissions").remove([body.objectKey]);
    return NextResponse.json({ error: "This module is not available for submission." }, { status: 403 });
  }
  const { data, error } = await admin.from("submissions").insert({ student_id: student.id, module_id: body.moduleId, object_key: body.objectKey, reflection: body.reflection?.trim().slice(0, 2000) || null }).select("id").single();
  return error ? NextResponse.json({ error: "The submission could not be saved." }, { status: 500 }) : NextResponse.json({ id: data.id }, { status: 201 });
}
