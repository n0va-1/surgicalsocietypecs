import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secret || !supplied || secret.length !== supplied.length) return false;
  return timingSafeEqual(Buffer.from(secret), Buffer.from(supplied));
}

async function sendSemesterReport(email: string, fullName: string, lines: string[]) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.ATTENDANCE_FROM_EMAIL ?? "Surgical Society Pécs <onboarding@resend.dev>",
      to: [email],
      subject: "Your Surgical Society Pécs semester report",
      text: `Dear ${fullName},\n\nYour semester report is included below. In accordance with our retention policy, the submitted practice photographs listed in this report will now be permanently deleted.\n\n${lines.join("\n")}\n\nSurgical Society Pécs`,
    }),
  });
  return response.ok;
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: "Email is not configured." }, { status: 503 });

  const admin = createSupabaseAdminClient();
  const cutoff = new Date();
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 6);
  const { data: submissions, error } = await admin.from("submissions")
    .select("id,student_id,module_id,object_key,score,outcome,feedback,created_at,report_sent_at,photo_deleted_at")
    .lt("created_at", cutoff.toISOString())
    .is("photo_deleted_at", null)
    .order("created_at")
    .limit(500);
  if (error) return NextResponse.json({ error: "Retention records could not be loaded." }, { status: 500 });
  if (!submissions?.length) return NextResponse.json({ processedStudents: 0, deletedPhotos: 0 });

  const studentIds = [...new Set(submissions.map(item => item.student_id))];
  const moduleIds = [...new Set(submissions.map(item => item.module_id))];
  const [{ data: students }, { data: modules }] = await Promise.all([
    admin.from("profiles").select("id,email,full_name").in("id", studentIds),
    admin.from("modules").select("id,title_en,week").in("id", moduleIds),
  ]);
  let processedStudents = 0;
  let deletedPhotos = 0;

  for (const studentId of studentIds) {
    const student = students?.find(item => item.id === studentId);
    const records = submissions.filter(item => item.student_id === studentId);
    if (!student?.email || !records.length) continue;
    const unsent = records.filter(item => !item.report_sent_at);
    if (unsent.length) {
      const lines = unsent.map(item => {
        const chapter = modules?.find(entry => entry.id === item.module_id);
        const outcome = item.outcome === "all_done" ? "All done" : item.outcome === "more_practice" ? "More practice recommended" : "Awaiting review";
        return `Week ${chapter?.week ?? "-"}: ${chapter?.title_en ?? "Practice submission"} — Score: ${item.score ?? "not scored"}/5 — ${outcome}${item.feedback ? ` — Feedback: ${item.feedback}` : ""}`;
      });
      if (!await sendSemesterReport(student.email, student.full_name, lines)) continue;
      await admin.from("submissions").update({ report_sent_at: new Date().toISOString() }).in("id", unsent.map(item => item.id));
    }

    const objectKeys = records.map(item => item.object_key).filter(Boolean);
    const { error: deletionError } = objectKeys.length ? await admin.storage.from("submissions").remove(objectKeys) : { error: null };
    if (deletionError) continue;
    await admin.from("submissions").update({ photo_deleted_at: new Date().toISOString() }).in("id", records.map(item => item.id));
    await admin.from("audit_logs").insert({
      action: "retention.photos_deleted", entity_type: "profile", entity_id: studentId,
      metadata: { submission_count: records.length, cutoff: cutoff.toISOString() },
    });
    processedStudents += 1;
    deletedPhotos += objectKeys.length;
  }

  return NextResponse.json({ processedStudents, deletedPhotos }, { headers: { "Cache-Control": "no-store" } });
}
