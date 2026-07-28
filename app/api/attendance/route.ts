import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { consumeRateLimit, isSameOriginRequest } from "@/lib/security";

type AttendanceValue = "present" | "late" | "absent";
const DEFAULT_SEMESTER = "2026-spring";

async function sendAbsenceLimitEmail(email: string, fullName: string, absenceCount: number) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { status: "pending" as const, error: "Email provider is not configured yet." };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.ATTENDANCE_FROM_EMAIL ?? "Surgical Society Pécs <onboarding@resend.dev>",
      to: [email],
      subject: "Attendance limit exceeded · Surgical Society Pécs",
      text: `Dear ${fullName},\n\nOur attendance register now shows ${absenceCount} missed sessions out of 10. The permitted maximum is two. You are therefore no longer eligible to attend further sessions this semester.\n\nIf you believe this is incorrect, please contact the Surgical Society Pécs administration.\n\nSurgical Society Pécs`,
    }),
  });
  const result = await response.json().catch(() => ({})) as { id?: string; message?: string };
  return response.ok
    ? { status: "sent" as const, providerId: result.id }
    : { status: "failed" as const, error: result.message ?? "Email delivery failed." };
}

export async function GET(request: Request) {
  const staff = await requireRole(["demonstrator", "admin"]);
  if (!staff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const admin = createSupabaseAdminClient();
  const requestedSessionId = new URL(request.url).searchParams.get("sessionId");
  let sessionQuery = admin.from("course_sessions").select("id,title,level,starts_at,created_at,semester_key,session_number,is_demo").eq("semester_key", DEFAULT_SEMESTER).order("session_number", { ascending: true }).limit(10);
  sessionQuery = sessionQuery.eq("is_demo", staff.is_demo);
  const { data: sessions, error } = await sessionQuery;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const sessionId = requestedSessionId && sessions?.some(session => session.id === requestedSessionId)
    ? requestedSessionId
    : sessions?.at(-1)?.id;
  const sessionIds = (sessions ?? []).map(session => session.id);
  const { data: records } = sessionIds.length
    ? await admin.from("attendance_records").select("session_id,student_id,status,recorded_at,recorded_by,correction_note").in("session_id", sessionIds)
    : { data: [] };
  const sessionNumbers = new Map((sessions ?? []).map(session => [session.id, session.session_number]));
  return NextResponse.json({ sessions: sessions ?? [], activeSessionId: sessionId ?? null, records: (records ?? []).map(record => ({ ...record, session_number: sessionNumbers.get(record.session_id) ?? null })), totalSessions: 10, absenceLimit: 2 }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const staff = await requireRole(["demonstrator", "admin"]);
  if (!staff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!await consumeRateLimit(request, `attendance:${staff.id}`, 40, 600)) return NextResponse.json({ error: "Too many attendance updates. Please wait and try again." }, { status: 429 });
  const body = await request.json().catch(() => null) as null | {
    sessionId?: string; sessionNumber?: number; semesterKey?: string; title?: string; level?: "beginner" | "intermediate" | "advanced";
    startsAt?: string; records?: Array<{ studentId: string; status: AttendanceValue; correctionNote?: string }>;
  };
  if (!body?.records?.length || body.records.some(item => !item.studentId || !["present", "late", "absent"].includes(item.status))) {
    return NextResponse.json({ error: "Valid attendance records are required." }, { status: 400 });
  }
  const sessionNumber = Number(body.sessionNumber);
  if (!body.sessionId && (!Number.isInteger(sessionNumber) || sessionNumber < 1 || sessionNumber > 10)) {
    return NextResponse.json({ error: "Choose a session number from 1 to 10." }, { status: 400 });
  }
  const admin = createSupabaseAdminClient();
  if (staff.is_demo) {
    const ids = body.records.map(record => record.studentId);
    const { data: permitted } = await admin.from("profiles").select("id").in("id", ids).eq("role", "student").eq("is_demo", true);
    if ((permitted ?? []).length !== new Set(ids).size) return NextResponse.json({ error: "Demo accounts can record demo attendance only." }, { status: 403 });
  }

  const semesterKey = body.semesterKey?.trim() || DEFAULT_SEMESTER;
  let sessionId = body.sessionId;
  if (!sessionId) {
    const { data: session, error } = await admin.from("course_sessions").insert({
      title: body.title?.trim() || `Session ${sessionNumber} of 10`,
      level: body.level ?? "beginner",
      starts_at: body.startsAt ?? new Date().toISOString(),
      semester_key: semesterKey,
      session_number: sessionNumber,
      is_demo: staff.is_demo,
      created_by: staff.id,
    }).select("id").single();
    if (error || !session) return NextResponse.json({ error: error?.message ?? "Session could not be created." }, { status: 500 });
    sessionId = session.id;
  }

  const rows = body.records.map(item => ({
    session_id: sessionId, student_id: item.studentId, status: item.status,
    recorded_by: staff.id, recorded_at: new Date().toISOString(), correction_note: item.correctionNote?.trim() || null,
  }));
  const { error } = await admin.from("attendance_records").upsert(rows, { onConflict: "session_id,student_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let relevantSessionsQuery = admin.from("course_sessions").select("id").eq("semester_key", semesterKey);
  relevantSessionsQuery = relevantSessionsQuery.eq("is_demo", staff.is_demo);
  const { data: relevantSessions } = await relevantSessionsQuery;
  const sessionIds = (relevantSessions ?? []).map(session => session.id);
  const notifications: Array<{ studentId: string; status: string }> = [];

  for (const item of body.records) {
    const { count } = sessionIds.length
      ? await admin.from("attendance_records").select("id", { count: "exact", head: true }).eq("student_id", item.studentId).eq("status", "absent").in("session_id", sessionIds)
      : { count: 0 };
    const absenceCount = count ?? 0;
    await admin.from("profiles").update({ eligible: absenceCount <= 2, updated_at: new Date().toISOString() }).eq("id", item.studentId);

    if (absenceCount > 2) {
      const { data: student } = await admin.from("profiles").select("email,full_name").eq("id", item.studentId).single();
      const { data: existing } = await admin.from("attendance_limit_events").select("id,email_status").eq("student_id", item.studentId).eq("semester_key", semesterKey).maybeSingle();
      const event = existing ?? (await admin.from("attendance_limit_events").insert({ student_id: item.studentId, semester_key: semesterKey, absence_count: absenceCount }).select("id,email_status").single()).data;
      if (event && student && event.email_status !== "sent") {
        const delivery = await sendAbsenceLimitEmail(student.email, student.full_name, absenceCount);
        await admin.from("attendance_limit_events").update({
          absence_count: absenceCount,
          email_status: delivery.status,
          provider_id: "providerId" in delivery ? delivery.providerId ?? null : null,
          error_message: "error" in delivery ? delivery.error : null,
          sent_at: delivery.status === "sent" ? new Date().toISOString() : null,
        }).eq("id", event.id);
        notifications.push({ studentId: item.studentId, status: delivery.status });
      }
    }
  }

  await admin.from("audit_logs").insert({ actor_id: staff.id, action: "attendance.saved", entity_type: "course_session", entity_id: sessionId, metadata: { records: body.records.length, semesterKey, sessionNumber } });
  return NextResponse.json({ sessionId, saved: rows.length, notifications });
}
