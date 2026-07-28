"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Language = "en" | "hu";
type Role = "student" | "staff";
type AuthMode = "login" | "register";
type StudentPage = "overview" | "learning" | "submissions" | "achievements" | "announcements" | "profile";
type StaffPage = "overview" | "students" | "attendance" | "reviews" | "announcements" | "reports" | "curriculum" | "admin" | "profile";
type Modal = "upload" | "lesson" | "feedback" | "forgot" | "notifications" | "certificate" | "review" | "announcement" | "student" | "privacy" | "mfa" | null;
type StudentRow = [name: string, initials: string, level: string, progress: string, technique: string, id?: string, absences?: number, eligible?: boolean, avatarUrl?: string, avatarEmoji?: string];
type AnnouncementRow = { id?: string; date: string; title: string; hu: string; text: string; target: string; pinned: boolean; publishedAt?: string };
type SubmissionRow = { id: string; student_id: string; module_id: string; object_key: string; reflection: string | null; status: string; score: number | null; outcome: string | null; feedback: string | null; created_at: string; module: { id: string; title_en: string; title_hu: string; week: number; level: string } | null; student: { id: string; full_name: string; rank: string } | null };
type AttendanceSession = { id: string; title: string; session_number: number | null; semester_key: string; starts_at: string };
type PortalProfile = { id: string; role: "student" | "demonstrator" | "admin" | "editor"; full_name: string; email: string; avatarUrl?: string | null; avatar_emoji?: string | null };
type AttendanceValue = "Present" | "Late" | "Absent";
type CurriculumAsset = { id: string; module_id: string; kind: "image" | "video"; object_key: string; caption: string | null; url: string | null };
type CurriculumModule = { id: string; level: "beginner" | "intermediate" | "advanced"; week: number; title_en: string; title_hu: string; introduction_en: string | null; introduction_hu: string | null; technique_en: string | null; technique_hu: string | null; application_en: string | null; application_hu: string | null; equipment_en: string | null; equipment_hu: string | null; steps_en: string[]; steps_hu: string[]; video_url: string | null; published: boolean; assets: CurriculumAsset[] };

const ui = {
  en: {
    society: "Surgical Society",
    academy: "Pécs · Skills Academy",
    authEyebrow: "SURGICAL SOCIETY PÉCS",
    authTitle: "Welcome to the Surgical Society.",
    authIntro: "Practice with us and become better bit by bit.",
    privateTitle: "Private learning platform",
    privateText: "Progress, submissions and feedback stay within your permitted area.",
    login: "Log in",
    register: "Register",
    welcome: "Welcome back",
    create: "Create your account",
    loginIntro: "Choose your area, then enter your personal details.",
    registerIntro: "Select your role and use the access code you received from the society.",
    chooseArea: "Choose your area",
    student: "Student",
    staff: "Staff",
    studentRole: "Learn techniques, submit work and follow your own progress.",
    staffRole: "Review all students, give feedback and publish announcements.",
    email: "Email address",
    password: "Password",
    fullName: "Full name",
    accessCode: "Access code",
    eventCode: "Event or invitation code",
    staffCode: "Staff invitation code",
    forgot: "Forgot password?",
    loginStudent: "Enter student academy",
    loginStaff: "Enter staff desk",
    createStudent: "Create student account",
    createStaff: "Create staff account",
    areaPrivacy: "Your role controls which part of the academy you can access.",
    overview: "Overview",
    learning: "Learning path",
    submissions: "My submissions",
    achievements: "Achievements",
    announcements: "Announcements",
    students: "Students",
    attendance: "Attendance",
    administration: "Administration",
    reviews: "Review queue",
    reports: "Reports",
    profile: "Profile",
    studentArea: "Student academy",
    staffArea: "Staff desk",
    signOut: "Sign out",
    semester: "Spring semester · Week 4",
    greeting: "Good afternoon, Anna",
    studentSubtitle: "Here is where your surgical skills journey stands this week.",
    staffTitle: "Demonstrator overview",
    staffSubtitle: "Review progress, respond to submissions and keep every group informed.",
    beginner: "Beginner",
    progress: "Course progress",
    complete: "complete",
    completedTechniques: "Techniques completed",
    awaiting: "Awaiting feedback",
    badges: "Badges earned",
    currentModule: "Your current module",
    continueLearning: "Continue learning",
    due: "Photo due Friday, 18:00",
    module: "Simple interrupted suture",
    moduleDescription: "Build a secure, evenly spaced wound closure with consistent tension.",
    openLesson: "Open week 4 lesson",
    submitWork: "Submit your work",
    latest: "Latest announcements",
    viewAll: "View all",
    recentFeedback: "Recent feedback",
    allDone: "All done",
    newAnnouncement: "New announcement",
    waitingReview: "Waiting for review",
    activeStudents: "Active students",
    morePractice: "Need more practice",
    reviewAll: "Open full queue",
    review: "Review",
    viewStudents: "View students",
    startWriting: "Start writing",
    save: "Save changes",
    cancel: "Cancel",
    close: "Close",
    send: "Send for review",
    publish: "Publish announcement",
    download: "Download certificate",
    generate: "Generate semester report",
    search: "Search students",
  },
  hu: {
    society: "Sebészeti Társaság",
    academy: "Pécs · Készségakadémia",
    authEyebrow: "PÉCSI SEBÉSZETI TÁRSASÁG",
    authTitle: "Üdvözlünk a Sebészeti Társaságban.",
    authIntro: "Gyakorolj velünk, és fejlődj lépésről lépésre.",
    privateTitle: "Privát tanulási platform",
    privateText: "A haladás, a beküldések és a visszajelzések a jogosultsági területeden maradnak.",
    login: "Bejelentkezés",
    register: "Regisztráció",
    welcome: "Üdv újra",
    create: "Fiók létrehozása",
    loginIntro: "Válaszd ki a területedet, majd add meg személyes adataidat.",
    registerIntro: "Válaszd ki a szerepköröd, és használd a társaságtól kapott hozzáférési kódot.",
    chooseArea: "Válaszd ki a területedet",
    student: "Hallgató",
    staff: "Oktató",
    studentRole: "Tanulj technikákat, küldd be munkáidat és kövesd saját haladásodat.",
    staffRole: "Ellenőrizd a hallgatókat, adj visszajelzést és tegyél közzé hirdetményeket.",
    email: "E-mail-cím",
    password: "Jelszó",
    fullName: "Teljes név",
    accessCode: "Hozzáférési kód",
    eventCode: "Esemény- vagy meghívókód",
    staffCode: "Oktatói meghívókód",
    forgot: "Elfelejtetted a jelszavad?",
    loginStudent: "Belépés a hallgatói akadémiára",
    loginStaff: "Belépés az oktatói felületre",
    createStudent: "Hallgatói fiók létrehozása",
    createStaff: "Oktatói fiók létrehozása",
    areaPrivacy: "A szerepköröd határozza meg, melyik akadémiai területhez férsz hozzá.",
    overview: "Áttekintés",
    learning: "Tanulási útvonal",
    submissions: "Beküldéseim",
    achievements: "Eredmények",
    announcements: "Hirdetmények",
    students: "Hallgatók",
    attendance: "Jelenlét",
    administration: "Adminisztráció",
    reviews: "Ellenőrzési sor",
    reports: "Jelentések",
    profile: "Profil",
    studentArea: "Hallgatói akadémia",
    staffArea: "Oktatói felület",
    signOut: "Kijelentkezés",
    semester: "Tavaszi félév · 4. hét",
    greeting: "Jó napot, Anna",
    studentSubtitle: "Itt láthatod, hogyan haladsz ezen a héten a sebészeti készségeiddel.",
    staffTitle: "Oktatói áttekintés",
    staffSubtitle: "Kövesd a haladást, értékeld a munkákat és tájékoztasd a csoportokat.",
    beginner: "Kezdő",
    progress: "Kurzus előrehaladás",
    complete: "teljesítve",
    completedTechniques: "Elvégzett technikák",
    awaiting: "Visszajelzésre vár",
    badges: "Megszerzett jelvények",
    currentModule: "Aktuális modulod",
    continueLearning: "Tanulás folytatása",
    due: "Fotó határideje: péntek 18:00",
    module: "Egyszerű csomós varrat",
    moduleDescription: "Készíts biztonságos, egyenletes sebzárást következetes feszességgel.",
    openLesson: "4. heti lecke megnyitása",
    submitWork: "Munka beküldése",
    latest: "Legfrissebb hirdetmények",
    viewAll: "Összes megtekintése",
    recentFeedback: "Legutóbbi visszajelzés",
    allDone: "Teljesítve",
    newAnnouncement: "Új hirdetmény",
    waitingReview: "Ellenőrzésre vár",
    activeStudents: "Aktív hallgatók",
    morePractice: "További gyakorlás kell",
    reviewAll: "Teljes sor megnyitása",
    review: "Ellenőrzés",
    viewStudents: "Hallgatók megtekintése",
    startWriting: "Írás megkezdése",
    save: "Módosítások mentése",
    cancel: "Mégse",
    close: "Bezárás",
    send: "Küldés ellenőrzésre",
    publish: "Hirdetmény közzététele",
    download: "Tanúsítvány letöltése",
    generate: "Félévi jelentés készítése",
    search: "Hallgatók keresése",
  },
};

const modules = [
  { week: 1, name: "Instrument handling", hu: "Eszközkezelés", level: "Beginner", state: "Completed", score: 5 },
  { week: 2, name: "Two-handed square knot", hu: "Kétkezes laposcsomó", level: "Beginner", state: "Completed", score: 4 },
  { week: 3, name: "Vertical mattress suture", hu: "Vertikális matracöltés", level: "Beginner", state: "Completed", score: 4 },
  { week: 4, name: "Simple interrupted suture", hu: "Egyszerű csomós varrat", level: "Beginner", state: "Current", score: null },
  { week: 5, name: "Horizontal mattress suture", hu: "Horizontális matracöltés", level: "Beginner", state: "Locked", score: null },
  { week: 6, name: "Running suture", hu: "Tovafutó varrat", level: "Beginner", state: "Locked", score: null },
];

const announcementItems: AnnouncementRow[] = [
  { date: "22 APR", title: "Workshop room updated", hu: "Gyakorlati terem változás", text: "Thursday’s practical session will take place in Room 3. Please arrive 10 minutes early.", target: "Everyone", pinned: true },
  { date: "20 APR", title: "Equipment reminder", hu: "Felszerelés emlékeztető", text: "Bring your needle holder and practice pad to this week’s session.", target: "Beginner", pinned: false },
  { date: "16 APR", title: "Intermediate session schedule", hu: "Középhaladó alkalom időpontja", text: "The intermediate group will meet at 17:30 next Tuesday.", target: "Intermediate", pinned: false },
];

const students: StudentRow[] = [
  ["Bence Tóth", "BT", "Beginner", "74%", "Simple interrupted suture"],
  ["Lilla Horváth", "LH", "Intermediate", "68%", "Instrument tie"],
  ["Dávid Kiss", "DK", "Advanced", "82%", "Vertical mattress suture"],
  ["Eszter Varga", "EV", "Beginner", "59%", "Two-handed square knot"],
  ["Máté Szabó", "MS", "Intermediate", "71%", "Running suture"],
];

function Logo({ compact = false, login = false }: { compact?: boolean; login?: boolean }) {
  return <Image className={`official-logo${compact ? " compact" : ""}${login ? " login-logo" : ""}`} src="/ssp-logo.png" width={112} height={112} alt="Surgical Society Pécs crest" priority />;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join("") || "SS";
}

function Avatar({ name, src, emoji, className = "" }: { name: string; src?: string; emoji?: string; className?: string }) {
  return <span className={`avatar ${className} ${src ? "has-photo" : "surgeon-placeholder"}`.trim()} title={name}>{src ? <Image src={src} alt={`${name} profile`} fill sizes="56px" unoptimized /> : <span aria-hidden="true">{emoji || "🧑‍⚕️"}</span>}</span>;
}

function ProgressRing({ value, size = "large", label }: { value: number; size?: "large" | "small"; label?: string }) {
  return <div className={`progress-ring ${size}`} style={{ "--progress": `${value * 3.6}deg` } as React.CSSProperties}><div><strong>{value}%</strong>{size === "large" && <span>{label}</span>}</div></div>;
}

export default function Home() {
  const [language, setLanguage] = useState<Language>("en");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [role, setRole] = useState<Role>("student");
  const [accountName, setAccountName] = useState("Anna Nagy");
  const [registrationName, setRegistrationName] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [accountId, setAccountId] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCurriculumEditor, setIsCurriculumEditor] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [studentPage, setStudentPage] = useState<StudentPage>("overview");
  const [staffPage, setStaffPage] = useState<StaffPage>("overview");
  const [modal, setModal] = useState<Modal>(null);
  const [selectedModule, setSelectedModule] = useState(4);
  const [selectedStudent, setSelectedStudent] = useState("Bence Tóth");
  const [selectedFile, setSelectedFile] = useState("");
  const [isLocalPreview, setIsLocalPreview] = useState(false);
  const [studentRecords, setStudentRecords] = useState<StudentRow[]>([]);
  const [announcementRecords, setAnnouncementRecords] = useState<AnnouncementRow[]>([]);
  const [submissionRecords, setSubmissionRecords] = useState<SubmissionRow[]>([]);
  const [accountAvatarUrl, setAccountAvatarUrl] = useState("");
  const [accountAvatarEmoji, setAccountAvatarEmoji] = useState("");
  const [readAnnouncementIds, setReadAnnouncementIds] = useState<string[]>([]);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState("");
  const [reviewImageUrl, setReviewImageUrl] = useState("");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [attendanceSessions, setAttendanceSessions] = useState<AttendanceSession[]>([]);
  const [attendanceOverview, setAttendanceOverview] = useState<Record<string, Partial<Record<number, AttendanceValue>>>>({});
  const [selectedSessionNumber, setSelectedSessionNumber] = useState(1);
  const [dataBusy, setDataBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [announcementTarget, setAnnouncementTarget] = useState("Everyone");
  const [score, setScore] = useState(4);
  const [reviewResult, setReviewResult] = useState("All done");
  const [attendance, setAttendance] = useState<Record<string, AttendanceValue>>({});
  const [pendingProfile, setPendingProfile] = useState<PortalProfile | null>(null);
  const [mfaMode, setMfaMode] = useState<"enroll" | "verify">("verify");
  const [mfaFactorId, setMfaFactorId] = useState("");
  const [mfaFactors, setMfaFactors] = useState<Array<{ id: string; label: string }>>([]);
  const [mfaQrCode, setMfaQrCode] = useState("");
  const [mfaSecret, setMfaSecret] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [inviteRole, setInviteRole] = useState<"student" | "demonstrator" | "editor">("demonstrator");
  const [inviteLevel, setInviteLevel] = useState<"beginner" | "intermediate" | "advanced">("beginner");
  const [inviteMaxUses, setInviteMaxUses] = useState(1);
  const [staffCodes, setStaffCodes] = useState<Array<{ id?: string; code: string; status: string; expires: string }>>([]);
  const [curriculumRecords, setCurriculumRecords] = useState<CurriculumModule[]>([]);
  const [selectedCurriculumId, setSelectedCurriculumId] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const profilePhotoInput = useRef<HTMLInputElement>(null);
  const selectedUpload = useRef<File | null>(null);
  const t = ui[language];
  const activePage = role === "student" ? studentPage : staffPage;
  const reviewedSubmissions = submissionRecords.filter(item => item.status === "reviewed");
  const completedTechniqueCount = new Set(reviewedSubmissions.map(item => item.module_id)).size;
  const courseProgress = Math.min(100, Math.round(completedTechniqueCount / 13 * 100));
  const pendingSubmissionCount = submissionRecords.filter(item => item.status === "pending" || item.status === "resubmit").length;
  const earnedBadgeCount = Math.min(3, Math.floor(completedTechniqueCount / 3));
  const unreadAnnouncements = announcementRecords.filter(item => item.id && !readAnnouncementIds.includes(item.id));

  const finishAuthentication = useCallback((profile: PortalProfile) => {
    const actualRole: Role = profile.role === "student" ? "student" : "staff";
    setRole(actualRole);
    setIsAdmin(profile.role === "admin");
    setIsCurriculumEditor(profile.role === "editor");
    setAccountName(profile.full_name);
    setAccountEmail(profile.email);
    setAccountId(profile.id);
    setAccountAvatarUrl(profile.avatarUrl ?? "");
    setAccountAvatarEmoji(profile.avatar_emoji ?? "");
    setPendingProfile(null);
    setMfaCode("");
    setModal(null);
    setAuthenticated(true);
    setStudentPage("overview");
    setStaffPage(profile.role === "editor" ? "curriculum" : "overview");
  }, []);

  const beginMfa = useCallback(async (profile: PortalProfile) => {
    setPendingProfile(profile);
    const supabase = getSupabaseBrowserClient();
    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError) throw factorsError;
    const verified = factors.totp.filter((factor: { id: string; status?: string }) => factor.status === "verified");
    if (verified.length) {
      setMfaMode("verify");
      setMfaFactors(verified.map((factor: { id: string; friendly_name?: string }, index: number) => ({ id:factor.id, label:factor.friendly_name || `Authenticator ${index + 1}` })));
      setMfaFactorId(verified[0].id);
      setMfaQrCode("");
      setMfaSecret("");
    } else {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Surgical Society Pécs staff" });
      if (error) throw error;
      setMfaMode("enroll"); setMfaFactors([]);
      setMfaFactorId(data.id);
      setMfaQrCode(data.totp.qr_code);
      setMfaSecret(data.totp.secret);
    }
    setModal("mfa");
  }, []);

  async function addBackupAuthenticator() {
    setAuthBusy(true);
    try {
      const currentRole: PortalProfile["role"] = isAdmin ? "admin" : isCurriculumEditor ? "editor" : "demonstrator";
      const profile: PortalProfile = { id: accountId, role: currentRole, full_name: accountName, email: accountEmail, avatarUrl: accountAvatarUrl, avatar_emoji: accountAvatarEmoji };
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Surgical Society Pécs backup" });
      if (error) throw error;
      setPendingProfile(profile); setMfaMode("enroll"); setMfaFactors([]); setMfaFactorId(data.id); setMfaQrCode(data.totp.qr_code); setMfaSecret(data.totp.secret); setMfaCode(""); setModal("mfa");
    } catch { setToast("A backup authenticator could not be started."); }
    finally { setAuthBusy(false); }
  }

  async function verifyMfa(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingProfile || !/^\d{6}$/.test(mfaCode)) { setToast("Enter the six-digit code from your authenticator app."); return; }
    setAuthBusy(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
      if (challengeError) throw challengeError;
      const { error } = await supabase.auth.mfa.verify({ factorId: mfaFactorId, challengeId: challenge.id, code: mfaCode });
      if (error) throw error;
      await supabase.auth.refreshSession();
      const response = await fetch("/api/me", { cache:"no-store" });
      const result = await response.json();
      if (!response.ok || result.mfa?.currentLevel !== "aal2") throw new Error("Staff session was not upgraded.");
      finishAuthentication(result.profile ?? pendingProfile);
    } catch {
      setToast("That verification code was not accepted. Please wait for a new code and try again.");
    } finally { setAuthBusy(false); }
  }

  async function recoverStaffMfa() {
    const response = await fetch("/api/me", { cache:"no-store" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.profile) return false;
    if (result.profile.role !== "student" && result.mfa?.currentLevel !== "aal2") {
      await beginMfa(result.profile);
      setToast("Verify your authenticator, then repeat the protected action.");
      return true;
    }
    return false;
  }

  useEffect(() => {
    let active = true;
    fetch("/api/me", { cache: "no-store" }).then(async response => {
      if (!response.ok) return;
      const { profile, mfa } = await response.json();
      if (!active || !profile) return;
      if (profile.role !== "student" && mfa?.currentLevel !== "aal2") {
        await beginMfa(profile);
        return;
      }
      finishAuthentication(profile);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [beginMfa, finishAuthentication]);

  const refreshPortalData = useCallback(async () => {
    setDataBusy(true);
    try {
      if (role === "student" || isAdmin || isCurriculumEditor) {
        const curriculumResponse = await fetch("/api/curriculum", { cache: "no-store" });
        const curriculumPayload = await curriculumResponse.json().catch(() => ({}));
        setCurriculumRecords(curriculumResponse.ok && curriculumPayload.modules ? curriculumPayload.modules : []);
        if (curriculumResponse.ok && curriculumPayload.modules?.length) setSelectedCurriculumId(current => current || curriculumPayload.modules[0].id);
      }
      if (isCurriculumEditor) {
        setAnnouncementRecords([]); setSubmissionRecords([]); setStudentRecords([]); setAttendance({}); setAttendanceOverview({});
        return;
      }
      const common = [fetch("/api/announcements", { cache: "no-store" }), fetch("/api/submissions", { cache: "no-store" })];
      const extra = role === "staff" ? [fetch("/api/staff/students", { cache: "no-store" }), fetch("/api/attendance", { cache: "no-store" })] : [];
      const responses = await Promise.all([...common, ...extra]);
      const payloads = await Promise.all(responses.map(response => response.json().catch(() => ({}))));
      if (responses[0].ok && payloads[0].announcements) {
        const mappedAnnouncements = payloads[0].announcements.map((item: Record<string, unknown>) => {
        const date = new Date(String(item.published_at));
        return { id:String(item.id), date:date.toLocaleDateString("en-GB",{day:"2-digit",month:"short"}).toUpperCase(), title:String(item.title_en), hu:String(item.title_hu ?? item.title_en), text:String(item.body_en), target:String(item.target_level), pinned:Boolean(item.pinned), publishedAt:String(item.published_at), read:Boolean(item.read) };
        });
        setAnnouncementRecords(mappedAnnouncements);
        setReadAnnouncementIds(mappedAnnouncements.filter((item: AnnouncementRow & { read?: boolean }) => item.read && item.id).map((item: AnnouncementRow) => item.id as string));
      } else setAnnouncementRecords([]);
      if (responses[1].ok && payloads[1].submissions) setSubmissionRecords(payloads[1].submissions); else setSubmissionRecords([]);
      if (role === "staff" && responses[2]?.ok && payloads[2].students) {
        const liveStudents = payloads[2].students.map((item: Record<string, unknown>) => {
          const name = String(item.full_name); const completed = Number(item.completed ?? 0);
          return [name, initials(name), String(item.rank ?? "beginner").replace(/^./, letter => letter.toUpperCase()), `${Math.min(100, Math.round(completed / 13 * 100))}%`, completed ? "Progress recorded" : "Not started", String(item.id), Number(item.absences ?? 0), Boolean(item.eligible), String(item.avatarUrl ?? ""), String(item.avatar_emoji ?? "")] as StudentRow;
        });
        setStudentRecords(liveStudents);
        if (responses[3]?.ok) {
          const byId = new Map<string,string>();
          liveStudents.forEach((row: StudentRow) => { if (row[5]) byId.set(row[5], row[0]); });
          const next: Record<string, AttendanceValue> = {};
          const overview: Record<string, Partial<Record<number, AttendanceValue>>> = {};
          liveStudents.forEach((row: StudentRow) => { next[row[0]] = "Present"; });
          for (const record of payloads[3].records ?? []) {
            const name=byId.get(record.student_id);
            const value=String(record.status).replace(/^./, letter=>letter.toUpperCase()) as AttendanceValue;
            const sessionNumber=Number(record.session_number);
            if (name && Number.isInteger(sessionNumber)) overview[String(record.student_id)] = { ...(overview[String(record.student_id)] ?? {}), [sessionNumber]: value };
          }
          const active = (payloads[3].sessions ?? []).find((session: AttendanceSession) => session.id === payloads[3].activeSessionId)?.session_number ?? 1;
          liveStudents.forEach((row: StudentRow) => { if (row[5]) next[row[0]] = overview[row[5]]?.[active] ?? "Present"; });
          setAttendanceOverview(overview);
          setAttendance(next);
        }
      } else if (role === "staff") { setStudentRecords([]); setAttendance({}); setAttendanceOverview({}); }
      if (role === "staff" && responses[3]?.ok) {
        setActiveSessionId(payloads[3].activeSessionId ?? null);
        setAttendanceSessions(payloads[3].sessions ?? []);
        const selected = (payloads[3].sessions ?? []).find((session: AttendanceSession) => session.id === payloads[3].activeSessionId);
        if (selected?.session_number) setSelectedSessionNumber(selected.session_number);
      }
    } finally { setDataBusy(false); }
  }, [role, isAdmin, isCurriculumEditor]);

  useEffect(() => {
    if (authenticated && !isLocalPreview) {
      queueMicrotask(() => void refreshPortalData());
    }
  }, [authenticated, isLocalPreview, refreshPortalData]);

  const nav = useMemo(() => role === "student" ? [
    ["overview", "⌂", t.overview], ["learning", "◫", t.learning], ["submissions", "↥", t.submissions],
    ["achievements", "◇", t.achievements], ["announcements", "◌", t.announcements],
  ] : isCurriculumEditor ? [
    ["curriculum", "▤", "Curriculum"], ["profile", "◎", t.profile],
  ] : [
    ["overview", "⌂", t.overview], ["students", "◎", t.students], ["attendance", "▦", t.attendance], ["reviews", "✓", t.reviews],
    ["announcements", "◌", t.announcements], ["reports", "□", t.reports], ...(isAdmin ? [["curriculum", "▤", "Curriculum"], ["admin", "⌘", t.administration]] : []),
  ], [role, t, isAdmin, isCurriculumEditor]);

  function navigate(page: string) {
    if (role === "student") setStudentPage(page as StudentPage);
    else setStaffPage(page as StaffPage);
  }

  async function enterPortal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    setAuthBusy(true);
    try {
      if (authMode === "register") {
        const response = await fetch("/api/auth/register", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, fullName: registrationName, password: authPassword, code: authCode, requestedArea: role, privacyAccepted: form.get("privacyAccepted") === "on" }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Registration failed.");
        setAuthMode("login"); setAuthPassword(""); setAuthCode("");
        setToast(result.message);
        return;
      }

      const loginResponse = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: authPassword }) });
      const loginResult = await loginResponse.json();
      if (!loginResponse.ok) throw new Error(loginResult.error ?? "The email or password is incorrect.");
      const response = await fetch("/api/me", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.profile) throw new Error("Your academy profile could not be loaded.");
      const actualArea: Role = result.profile.role === "student" ? "student" : "staff";
      if (actualArea !== role) {
        await getSupabaseBrowserClient().auth.signOut();
        throw new Error(`This account belongs to the ${actualArea} area. Select that area to log in.`);
      }
      if (actualArea === "staff" && result.mfa?.currentLevel !== "aal2") {
        await beginMfa(result.profile);
        return;
      }
      finishAuthentication(result.profile);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function signOut() {
    if (!isLocalPreview) await getSupabaseBrowserClient().auth.signOut();
    setAuthenticated(false); setIsAdmin(false); setIsCurriculumEditor(false); setAccountId(""); setAuthPassword(""); setIsLocalPreview(false); setAccountAvatarUrl(""); setAccountAvatarEmoji("");
  }

  function enterLocalPreview() {
    setAccountName(role === "staff" ? "Local Administrator Preview" : "Anna Nagy");
    setAccountEmail(role === "staff" ? "admin@local.preview" : "student@local.preview");
    setIsAdmin(role === "staff"); setIsLocalPreview(true); setAuthenticated(true); setAccountAvatarUrl(""); setAccountAvatarEmoji("");
    setStudentRecords(role === "staff" ? students : []);
    setAnnouncementRecords(announcementItems);
    setAttendance(role === "staff" ? { "Bence Tóth": "Present", "Lilla Horváth": "Present", "Dávid Kiss": "Absent", "Eszter Varga": "Late", "Máté Szabó": "Present" } : {});
    setStudentPage("overview"); setStaffPage("overview");
  }

  async function sendPasswordReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("resetEmail") ?? "");
    const { error } = await getSupabaseBrowserClient().auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/` });
    completeAction(error ? "The reset email could not be sent." : "If that account exists, a secure reset link has been sent.");
  }

  function completeAction(message: string) {
    setModal(null);
    setToast(message);
  }

  async function markAnnouncementsRead(ids = announcementRecords.flatMap(item => item.id ? [item.id] : [])) {
    const next = [...new Set([...readAnnouncementIds, ...ids])];
    setReadAnnouncementIds(next);
    if (!isLocalPreview && ids.length) {
      const response = await fetch("/api/announcements/read", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ ids }) });
      if (!response.ok) setToast("Notification status could not be saved.");
    }
  }

  async function uploadProfilePhoto(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setToast("Choose a JPG, PNG or WebP profile picture no larger than 5 MB.");
      return;
    }
    if (isLocalPreview) { setAccountAvatarUrl(URL.createObjectURL(file)); setToast("Preview profile picture updated."); return; }
    setDataBusy(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please log in again.");
      const avatarPath = `${user.id}/profile-picture`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(avatarPath, file, { contentType: file.type, upsert: true });
      if (uploadError) throw uploadError;
      const { error: profileError } = await supabase.from("profiles").update({ avatar_path: avatarPath, updated_at: new Date().toISOString() }).eq("id", user.id);
      if (profileError) throw profileError;
      const { data } = await supabase.storage.from("avatars").createSignedUrl(avatarPath, 3600);
      setAccountAvatarUrl(data?.signedUrl ?? "");
      setAccountAvatarEmoji("");
      setToast("Profile picture saved privately.");
    } catch (error) { setToast(error instanceof Error ? error.message : "Profile picture could not be saved."); }
    finally { setDataBusy(false); }
  }

  async function submitPhoto(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = selectedUpload.current;
    if (!file) return;
    if (isLocalPreview) { selectedUpload.current=null; setSelectedFile(""); completeAction("Preview: your photo was sent for private review."); return; }
    if (!["image/jpeg","image/png","image/webp"].includes(file.type) || file.size > 10*1024*1024) { setToast("Use a JPG, PNG or WebP image no larger than 10 MB."); return; }
    setDataBusy(true);
    const supabase = getSupabaseBrowserClient();
    let objectKey = "";
    try {
      const { data:{user} } = await supabase.auth.getUser();
      if (!user) throw new Error("Please log in again.");
      const { data: module, error: moduleError } = await supabase.from("modules").select("id").eq("week",selectedModule).eq("level","beginner").single();
      if (moduleError || !module) throw new Error("This module is not available for submission yet.");
      const extension = file.type.split("/")[1].replace("jpeg","jpg");
      objectKey = `${user.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("submissions").upload(objectKey,file,{contentType:file.type,upsert:false});
      if (uploadError) throw new Error(uploadError.message);
      const reflection = String(new FormData(event.currentTarget).get("reflection")??"");
      const response = await fetch("/api/submissions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({moduleId:module.id,objectKey,reflection})});
      const result=await response.json();
      if(!response.ok) { await supabase.storage.from("submissions").remove([objectKey]); throw new Error(result.error??"Submission could not be saved."); }
      selectedUpload.current=null; setSelectedFile(""); completeAction("Your photo has been stored privately and sent for review.");
      await refreshPortalData();
    } catch(error) { setToast(error instanceof Error?error.message:"Submission failed."); }
    finally { setDataBusy(false); }
  }

  async function openReview(item: SubmissionRow) {
    setSelectedSubmissionId(item.id); setSelectedStudent(item.student?.full_name??"Student"); setReviewImageUrl(""); setModal("review");
    if (isLocalPreview) return;
    const { data } = await getSupabaseBrowserClient().storage.from("submissions").createSignedUrl(item.object_key,300);
    if (data?.signedUrl) setReviewImageUrl(data.signedUrl);
  }

  async function saveReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLocalPreview) { completeAction(`Preview: review for ${selectedStudent} saved.`); return; }
    const feedback=String(new FormData(event.currentTarget).get("feedback")??"");
    const response=await fetch(`/api/submissions/${selectedSubmissionId}/review`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({score,outcome:reviewResult==="All done"?"all_done":"more_practice",feedback})});
    const result=await response.json();
    if(!response.ok){setToast(result.error??"Review could not be saved.");return;}
    completeAction(`Review for ${selectedStudent} has been saved privately.`); await refreshPortalData();
  }

  async function publishAnnouncement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form=new FormData(event.currentTarget);
    if(isLocalPreview){completeAction(`Preview: announcement published to ${announcementTarget}.`);return;}
    const response=await fetch("/api/announcements",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:form.get("title"),message:form.get("message"),target:announcementTarget,pinned:form.get("pinned")==="on"})});
    const result=await response.json();
    if(!response.ok){if(response.status===403&&await recoverStaffMfa())return;setToast(result.error??"Announcement could not be published.");return;}
    completeAction(`Announcement published to ${announcementTarget}.`); await refreshPortalData();
  }

  if (!authenticated) {
    return <div className="auth-shell" data-theme={theme}>
      <section className="auth-intro">
        <div className="auth-brand"><Logo login /><div><strong>{t.society}</strong><span>{t.academy}</span></div></div>
        <div className="auth-message"><span className="eyebrow">{t.authEyebrow}</span><h1>{t.authTitle}</h1><p>{t.authIntro}</p></div>
        <div className="auth-proof"><article><span>○</span><div><strong>{t.privateTitle}</strong><p>{t.privateText}</p></div></article><article><span>HU</span><div><strong>English · Magyar</strong><p>One academy, available in both languages.</p></div></article></div>
        <p className="auth-university">Surgical Society Pécs · Independent skills community</p>
      </section>
      <section className="auth-panel">
        <div className="auth-tools"><button data-testid="auth-language" onClick={() => setLanguage(language === "en" ? "hu" : "en")}>{language.toUpperCase()}</button><button data-testid="auth-theme" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>{theme === "light" ? "☼" : "☾"}</button></div>
        <div className="auth-card">
          <div className="auth-tabs" role="tablist"><button data-testid="login-tab" className={authMode === "login" ? "active" : ""} onClick={() => setAuthMode("login")}>{t.login}</button><button data-testid="register-tab" className={authMode === "register" ? "active" : ""} onClick={() => setAuthMode("register")}>{t.register}</button></div>
          <div className="auth-heading"><span className="eyebrow">{authMode === "login" ? t.login : t.register}</span><h2>{authMode === "login" ? t.welcome : t.create}</h2><p>{authMode === "login" ? t.loginIntro : t.registerIntro}</p></div>
          <form onSubmit={enterPortal}>
            <fieldset className="role-fieldset"><legend>{t.chooseArea}</legend><div className="role-options">
              <label className={role === "student" ? "selected" : ""}><input data-testid="role-student" type="radio" name="role" checked={role === "student"} onChange={() => setRole("student")} /><span className="role-symbol">ST</span><span><strong>{t.student}</strong><small>{t.studentRole}</small></span><i>✓</i></label>
              <label className={role === "staff" ? "selected" : ""}><input data-testid="role-staff" type="radio" name="role" checked={role === "staff"} onChange={() => setRole("staff")} /><span className="role-symbol">SF</span><span><strong>{t.staff}</strong><small>{t.staffRole}</small></span><i>✓</i></label>
            </div></fieldset>
            {authMode === "register" && <label className="form-field"><span>{t.fullName}</span><input data-testid="registration-name" type="text" value={registrationName} onChange={e => setRegistrationName(e.target.value)} placeholder="Anna Nagy" required /></label>}
            <label className="form-field"><span>{t.email}</span><input data-testid="email-input" name="email" type="email" placeholder="anna.nagy@example.com" autoComplete="email" required /></label>
            <label className="form-field"><span>{t.password}</span><input data-testid="password-input" type="password" value={authPassword} onChange={event => setAuthPassword(event.target.value)} placeholder="••••••••••" minLength={authMode === "register" ? 12 : 1} maxLength={128} pattern={authMode === "register" ? "(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9\\s]).{12,128}" : undefined} autoComplete={authMode === "login" ? "current-password" : "new-password"} required />{authMode === "register" && <small className="password-hint">Use at least 12 characters with uppercase, lowercase, a number and a symbol.</small>}</label>
            {authMode === "register" && <label className="form-field code-field"><span>{t.accessCode}</span><input type="text" value={authCode} onChange={event => setAuthCode(event.target.value)} inputMode={role === "staff" ? "numeric" : undefined} pattern={role === "staff" ? "[0-9]{6,}" : undefined} minLength={6} placeholder={role === "student" ? t.eventCode : t.staffCode} required /><small>{role === "student" ? "Use the code from the sign-up event or a personal invitation." : "Staff codes are numeric, single-use and at least 6 digits."}</small></label>}
            {authMode === "register" && <label className="consent-row"><input name="privacyAccepted" type="checkbox" required /><span>I have read the <button type="button" onClick={() => setModal("privacy")}>privacy notice</button> and will upload only personal, non-clinical practice images with no patient information.</span></label>}
            {authMode === "login" && <button className="forgot-link" type="button" onClick={() => setModal("forgot")}>{t.forgot}</button>}
            <button data-testid="auth-submit" className="auth-submit" type="submit" disabled={authBusy}>{authBusy ? "Please wait…" : authMode === "login" ? (role === "student" ? t.loginStudent : t.loginStaff) : (role === "student" ? t.createStudent : t.createStaff)} <span>→</span></button>
            {process.env.NODE_ENV === "development" && <button className="local-preview-button" type="button" onClick={enterLocalPreview}>Preview selected area · local only</button>}
            <p className="access-note">◇ {t.areaPrivacy}</p>
            <button className="privacy-link" type="button" onClick={() => setModal("privacy")}>Privacy, photographs and retention</button>
          </form>
        </div>
      </section>
      {modal === "forgot" && <ModalShell title="Reset your password" onClose={() => setModal(null)}><form onSubmit={sendPasswordReset}><p className="modal-copy">Enter your account email. A secure reset link will be sent if the address belongs to an account.</p><label className="form-field"><span>{t.email}</span><input name="resetEmail" type="email" required placeholder="anna.nagy@example.com" /></label><div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setModal(null)}>{t.cancel}</button><button className="primary-button" type="submit">Send reset link</button></div></form></ModalShell>}
      {modal === "mfa" && <ModalShell title="Secure staff sign-in" onClose={() => void signOut()}><form className="mfa-form" onSubmit={verifyMfa}>{mfaMode === "enroll" ? <><p className="modal-copy">This one-time setup protects student information. It usually takes less than a minute.</p><ol className="mfa-steps"><li><b>1</b><span>Open Google Authenticator, Microsoft Authenticator, 1Password or Apple Passwords on your phone.</span></li><li><b>2</b><span>Press <strong>＋</strong> and choose <strong>Scan QR code</strong>.</span></li><li><b>3</b><span>Scan this square, then enter the six-digit number shown on your phone.</span></li></ol>{mfaQrCode && <Image className="mfa-qr" src={mfaQrCode} width={210} height={210} alt="Authenticator setup QR code" unoptimized />}<details open><summary>Using this website on your phone or unable to scan?</summary><p>Choose “enter setup key” in your authenticator and paste this key:</p><code>{mfaSecret}</code></details></> : <><p className="modal-copy">Open your authenticator app and enter the current six-digit code for Surgical Society Pécs.</p><p className="mfa-help">The number changes every 30 seconds and works without mobile data.</p>{mfaFactors.length>1&&<label className="form-field"><span>Authenticator device</span><select value={mfaFactorId} onChange={event=>setMfaFactorId(event.target.value)}>{mfaFactors.map(factor=><option key={factor.id} value={factor.id}>{factor.label}</option>)}</select></label>}</>}<label className="form-field"><span>Six-digit authenticator code</span><input value={mfaCode} onChange={event => setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" placeholder="000000" required /></label><button className="primary-button full-button" type="submit" disabled={authBusy}>{authBusy ? "Verifying…" : "Verify and continue →"}</button></form></ModalShell>}
      {modal === "privacy" && <ModalShell title="Privacy notice · draft for approval" onClose={() => setModal(null)} wide><PrivacyNotice /></ModalShell>}
      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </div>;
  }

  return <div className="site-shell" data-theme={theme}>
    <aside className="sidebar">
      <div className="brand"><Logo compact /><div><strong>{t.society}</strong><span>{t.academy}</span></div></div>
      <nav aria-label="Primary navigation"><span className="nav-label">{role === "student" ? t.studentArea.toUpperCase() : isCurriculumEditor ? "CURRICULUM EDITOR" : t.staffArea.toUpperCase()}</span>{nav.map(([page, icon, label]) => <button data-testid={`nav-${page}`} className={activePage === page ? "active" : ""} onClick={() => navigate(page)} key={page}><span>{icon}</span>{label}{page === "reviews" && pendingSubmissionCount > 0 && <b>{pendingSubmissionCount}</b>}</button>)}</nav>
      <div className="sidebar-bottom"><button className="profile-link" onClick={() => navigate("profile")}><Avatar name={accountName} src={accountAvatarUrl} emoji={accountAvatarEmoji} /><span><strong>{accountName}</strong><small>{role === "student" ? t.beginner : isAdmin ? "Administrator" : isCurriculumEditor ? "Curriculum editor" : "Demonstrator"}</small></span><i>•••</i></button><p>Surgical Society Pécs<br />Independent skills community</p></div>
    </aside>
    <main>
      <header className="topbar"><div className="mobile-brand"><Logo compact /><strong>Surgical Society Pécs</strong></div><div className="area-label"><span>{role === "student" ? "ST" : isCurriculumEditor ? "CE" : "SF"}</span>{role === "student" ? t.studentArea : isCurriculumEditor ? "Curriculum editor" : t.staffArea}</div><div className="top-actions"><button data-testid="language-toggle" className="language" onClick={() => setLanguage(language === "en" ? "hu" : "en")}>{language.toUpperCase()} <span>⌄</span></button><button data-testid="theme-toggle" className="theme" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>{theme === "light" ? "☼" : "☾"}</button>{!isCurriculumEditor&&<button data-testid="notifications" className="notification" onClick={() => setModal("notifications")} aria-label={`${unreadAnnouncements.length} unread notifications`}>◌{unreadAnnouncements.length > 0 && <i />}</button>}<button data-testid="header-profile" className="header-profile" onClick={() => navigate("profile")} aria-label={t.profile}><Avatar name={accountName} src={accountAvatarUrl} emoji={accountAvatarEmoji} /></button><button data-testid="sign-out" className="sign-out" onClick={signOut}>{t.signOut}</button></div></header>
      {role === "student" ? renderStudentPage() : renderStaffPage()}
    </main>
    {renderModal()}
    {toast && <Toast message={toast} onClose={() => setToast("")} />}
  </div>;

  function renderStudentPage() {
    if (studentPage === "learning") return LearningPage();
    if (studentPage === "submissions") return SubmissionsPage();
    if (studentPage === "achievements") return AchievementsPage();
    if (studentPage === "announcements") return AnnouncementsPage({ staff: false });
    if (studentPage === "profile") return ProfilePage();
    return <div className="page-content"><section className="page-heading"><div><span className="eyebrow">{t.semester}</span><h1>{language === "hu" ? `Jó napot, ${accountName}` : `Good afternoon, ${accountName}`}</h1><p>{t.studentSubtitle}</p></div><div className="rank-chip"><i />{t.beginner}</div></section>
      <section className="stats-grid"><article className="progress-card"><ProgressRing value={courseProgress} label={t.complete} /><div><span>{t.progress}</span><strong>{completedTechniqueCount} <small>/ 13</small></strong><p>{t.completedTechniques}</p></div></article><button className="stat-card" onClick={() => setStudentPage("submissions")}><span className="stat-icon amber">↥</span><div><strong>{pendingSubmissionCount}</strong><p>{t.awaiting}</p></div><i>→</i></button><button className="stat-card" onClick={() => setStudentPage("achievements")}><span className="stat-icon green">◇</span><div><strong>{earnedBadgeCount}</strong><p>{t.badges}</p></div><i>→</i></button></section>
      <section className="section-heading"><div><span className="eyebrow">{t.currentModule}</span><h2>{t.continueLearning}</h2></div><span className="due">{t.due}</span></section>
      <article className="module-card"><div className="module-number"><span>{String(Math.min(completedTechniqueCount + 1, modules.length)).padStart(2,"0")}</span><small>WEEK</small></div><div className="module-copy"><div className="module-meta"><span>{t.beginner.toUpperCase()}</span><i />12 MIN LESSON</div><h3>{modules[Math.min(completedTechniqueCount, modules.length - 1)].name}</h3><p>{completedTechniqueCount === 0 ? "Start with safe instrument handling and build each skill one step at a time." : t.moduleDescription}</p><div className="step-line"><span>1</span><i /><span>2</span><i /><span>3</span><i /><span>4</span></div><small>Introduction · Technique · Step by step · Submission</small></div><div className="module-actions"><button data-testid="open-lesson" className="secondary-button" onClick={() => { setSelectedModule(Math.min(completedTechniqueCount + 1, modules.length)); setModal("lesson"); }}>Open lesson <span>→</span></button><button data-testid="submit-work" className="primary-button" onClick={() => setModal("upload")}>{t.submitWork} <span>↥</span></button></div></article>
      <div className="lower-grid"><section><div className="section-heading compact"><h2>{t.latest}</h2><button onClick={() => setStudentPage("announcements")}>{t.viewAll} →</button></div><AnnouncementList limit={2} /></section><section><div className="section-heading compact"><h2>{t.recentFeedback}</h2></div>{reviewedSubmissions.length ? <article className="feedback-card"><div className="feedback-head"><Avatar name="Demonstrator team" className="staff" /><div><strong>Demonstrator team</strong><small>{reviewedSubmissions[0].module?.title_en ?? "Technique"}</small></div><span className="score">{reviewedSubmissions[0].score ?? "—"}<span>/5</span></span></div><div className="feedback-status"><span>✓</span><strong>{reviewedSubmissions[0].outcome === "more_practice" ? t.morePractice : t.allDone}</strong></div><p>{reviewedSubmissions[0].feedback || "Your review is complete."}</p><button className="text-button" onClick={() => { setSelectedSubmissionId(reviewedSubmissions[0].id); setModal("feedback"); }}>Read full feedback →</button></article> : <div className="empty-state"><span>○</span><h3>No feedback yet</h3><p>Your demonstrator’s comments will appear here after your first submission is reviewed.</p></div>}</section></div>
    </div>;
  }

  function renderStaffPage() {
    if (staffPage === "curriculum" || isCurriculumEditor) return CurriculumPage();
    const levelRows = ["Beginner", "Intermediate", "Advanced"].map(name => {
      const rows = studentRecords.filter(student => student[2] === name);
      const average = rows.length ? Math.round(rows.reduce((sum, student) => sum + Number.parseInt(student[3]), 0) / rows.length) : 0;
      return [name, average, `${rows.length} ${rows.length === 1 ? "student" : "students"}`] as const;
    });
    if (staffPage === "students") return StudentsPage();
    if (staffPage === "attendance") return AttendancePage();
    if (staffPage === "reviews") return ReviewsPage();
    if (staffPage === "announcements") return AnnouncementsPage({ staff: true });
    if (staffPage === "reports") return ReportsPage();
    if (staffPage === "admin" && isAdmin) return AdminPage();
    if (staffPage === "profile") return ProfilePage();
    return <div className="page-content"><section className="page-heading staff-heading"><div><span className="eyebrow">{t.semester}</span><h1>{t.staffTitle}</h1><p>{t.staffSubtitle}</p></div><button className="primary-button" onClick={() => setModal("announcement")}>＋ {t.newAnnouncement}</button></section>
      <section className="staff-stats"><button onClick={() => setStaffPage("reviews")}><ProgressRing value={Math.min(100,pendingSubmissionCount*8)} size="small" /><div><strong>{pendingSubmissionCount}</strong><p>{t.waitingReview}</p></div><span>live queue</span></button><button onClick={() => setStaffPage("students")}><span className="stat-icon burgundy">◎</span><div><strong>{studentRecords.length}</strong><p>{t.activeStudents}</p></div><span>3 levels</span></button><button onClick={() => setStaffPage("reviews")}><span className="stat-icon amber">↻</span><div><strong>{submissionRecords.filter(item=>item.status==="resubmit").length}</strong><p>{t.morePractice}</p></div><span>current</span></button></section>
      <section className="review-panel"><div className="section-heading compact"><div><span className="eyebrow">TODAY</span><h2>{t.reviews}</h2></div><button onClick={() => setStaffPage("reviews")}>{t.reviewAll} →</button></div><ReviewTable limit={4} /></section>
      <div className="staff-lower"><section className="level-progress"><div className="section-heading compact"><h2>Progress by level</h2><button onClick={() => setStaffPage("students")}>{t.viewStudents} →</button></div>{levelRows.map(([name,value,count]) => <div className={`level-row ${String(name).toLowerCase()}`} key={name}><div><strong>{name}</strong><span>{count}</span></div><div className="bar"><i style={{ width:`${value}%` }} /></div><b>{value}%</b></div>)}</section><section className="compose-card"><span className="stat-icon amber">◌</span><h2>{t.newAnnouncement}</h2><p>Share updates with everyone or choose a specific course level.</p><button className="secondary-button" onClick={() => setModal("announcement")}>{t.startWriting} →</button></section></div>
    </div>;
  }

  function LearningPage() {
    const available = curriculumRecords.length ? curriculumRecords : modules.map(module => ({ id:`preview-${module.week}`, level:"beginner" as const, week:module.week, title_en:module.name, title_hu:module.hu }));
    return <PageFrame eyebrow={t.semester} title={t.learning} description="Structured weekly guides, demonstrations and practical submissions."><div className="level-tabs"><button className="active" onClick={() => setToast("Beginner modules selected.")}>Beginner</button><button onClick={() => setToast("Intermediate unlocks after the beginner course.")}>Intermediate</button><button onClick={() => setToast("Advanced unlocks after the intermediate course.")}>Advanced</button></div><div className="module-grid">{available.map((m, index) => { const submission = submissionRecords.find(item => item.module?.week === m.week); const state = submission?.status === "reviewed" ? "Completed" : index === completedTechniqueCount ? "Current" : "Locked"; return <article className={`module-tile ${state.toLowerCase()}`} key={m.id}><div className="tile-top"><span>WEEK {String(m.week).padStart(2,"0")}</span><b>{state}</b></div><h3>{language === "hu" ? m.title_hu : m.title_en}</h3><p>Introduction, application, equipment, step-by-step guide and short video.</p><div className="tile-footer"><span>{submission?.score ? `${submission.score}/5` : state === "Locked" ? "○" : "12 min"}</span><button disabled={state === "Locked"} onClick={() => { setSelectedModule(m.week); setModal("lesson"); }}>{state === "Completed" ? "Review" : state === "Current" ? "Start" : "Locked"} →</button></div></article>; })}</div></PageFrame>;
  }

  function SubmissionsPage() {
    const previewRows = [["Simple interrupted suture","22 Apr","Awaiting review","—"],["Vertical mattress suture","15 Apr","All done","4/5"],["Two-handed square knot","08 Apr","All done","4/5"],["Instrument handling","01 Apr","All done","5/5"]];
    return <PageFrame eyebrow={t.semester} title={t.submissions} description="Only you and the demonstrators can view these submissions."><div className="toolbar"><div className="filter-pills"><button className="active" onClick={() => setToast("Showing all submissions.")}>All</button></div><button className="primary-button" onClick={() => setModal("upload")}>＋ {t.submitWork}</button></div>{dataBusy?<p className="modal-copy">Loading submissions…</p>:isLocalPreview?<div className="data-list">{previewRows.map((row,i) => <article key={row[0]}><span className="list-index">0{4-i}</span><div><strong>{row[0]}</strong><small>Submitted {row[1]}</small></div><b className={row[2] === "Awaiting review" ? "pending" : "approved"}>{row[2]}</b><span className="list-score">{row[3]}</span><button onClick={() => setModal(row[2] === "Awaiting review" ? "upload" : "feedback")}>{row[2] === "Awaiting review" ? "View" : "Feedback"} →</button></article>)}</div>:<div className="data-list">{submissionRecords.length===0?<p className="modal-copy">No work submitted yet.</p>:submissionRecords.map((item,i)=><article key={item.id}><span className="list-index">{String(submissionRecords.length-i).padStart(2,"0")}</span><div><strong>{language==="hu"?(item.module?.title_hu??item.module?.title_en):(item.module?.title_en??"Technique")}</strong><small>Submitted {new Date(item.created_at).toLocaleDateString()}</small></div><b className={item.status==="pending"?"pending":"approved"}>{item.status==="pending"?"Awaiting review":item.outcome==="all_done"?"All done":"More practice"}</b><span className="list-score">{item.score?`${item.score}/5`:"—"}</span><button onClick={()=>{setSelectedSubmissionId(item.id);setModal(item.feedback?"feedback":"upload");}}>{item.feedback?"Feedback":"Pending"} →</button></article>)}</div>}</PageFrame>;
  }

  function AchievementsPage() {
    const badges = [["◇","Secure foundations","Complete the first three modules",completedTechniqueCount>=3],["◎","Consistent practice","Submit work for three consecutive weeks",submissionRecords.length>=3],["✓","Demonstrator approved","Receive three “All done” reviews",reviewedSubmissions.filter(item=>item.outcome==="all_done").length>=3]] as const;
    return <PageFrame eyebrow="YOUR RECORD" title={t.achievements} description="Formal milestones earned through reviewed practical work."><section className="certificate-hero"><Logo /><div><span className="eyebrow">CURRENT MILESTONE</span><h2>Beginner Surgical Skills</h2><p>{completedTechniqueCount === 0 ? "Your record is ready for your first approved technique." : `Complete ${13-completedTechniqueCount} more techniques to earn your first semester certificate.`}</p><div className="certificate-progress"><i style={{width:`${courseProgress}%`}} /></div><small>{completedTechniqueCount} of 13 techniques completed</small></div><button className="secondary-button" disabled={completedTechniqueCount < 13} onClick={() => setModal("certificate")}>{completedTechniqueCount < 13 ? "Not earned yet" : "Certificate preview →"}</button></section><div className="badge-grid">{badges.map(b => <article className={b[3]?"":"locked"} key={b[1]}><span>{b[0]}</span><h3>{b[1]}</h3><p>{b[2]}</p><small>{b[3]?"EARNED":"NOT EARNED"}</small></article>)}</div></PageFrame>;
  }

  function AnnouncementsPage({staff}:{staff:boolean}) {
    return <PageFrame eyebrow={t.semester} title={t.announcements} description={staff ? "Create, target and manage updates for every course level." : "Important updates from the demonstrator team."} action={staff ? <button className="primary-button" onClick={() => setModal("announcement")}>＋ {t.newAnnouncement}</button> : undefined}><div className="toolbar"><div className="filter-pills"><button className="active" onClick={() => setToast("Showing announcements available to this account.")}>Available</button></div></div>{dataBusy?<p className="modal-copy">Loading announcements…</p>:announcementRecords.length===0?<div className="empty-state"><span>○</span><h3>No announcements yet</h3><p>Messages from the demonstrator team will appear here.</p></div>:<div className="announcement-page-list">{announcementRecords.map(a => <article key={a.id??a.title}><div className="date-block"><strong>{a.date.split(" ")[0]}</strong><span>{a.date.split(" ")[1]}</span></div><div><div className="announcement-tags">{a.pinned && <span>PINNED</span>}<span>{a.target.toUpperCase()}</span></div><h3>{language === "hu" ? a.hu : a.title}</h3><p>{a.text}</p></div>{staff ? <button onClick={() => setModal("announcement")}>New →</button> : <button onClick={() => { if(a.id) void markAnnouncementsRead([a.id]); setToast("Announcement marked as read."); }}>{a.id&&readAnnouncementIds.includes(a.id)?"Read ✓":"Mark read"}</button>}</article>)}</div>}</PageFrame>;
  }

  function StudentsPage() {
    return <PageFrame eyebrow={`${studentRecords.length} ACTIVE ${studentRecords.length===1?"MEMBER":"MEMBERS"}`} title={t.students} description="All demonstrators can monitor every enrolled student."><div className="toolbar"><label className="search-field">⌕<input aria-label={t.search} placeholder={t.search} /></label><div className="filter-pills"><button className="active" onClick={() => setToast("Showing all levels.")}>All levels</button><button onClick={() => setToast("Showing beginner students.")}>Beginner</button><button onClick={() => setToast("Showing intermediate students.")}>Intermediate</button></div></div>{dataBusy?<p className="modal-copy">Loading students…</p>:studentRecords.length===0?<div className="empty-state"><span>○</span><h3>No enrolled students yet</h3><p>Students will appear after they register with an active event code.</p></div>:<div className="student-directory">{studentRecords.map(s => <article key={s[5]??s[0]}><Avatar name={s[0]} src={s[8]} emoji={s[9]} /><div><strong>{s[0]}</strong><small>{s[2]} · Individual progress</small></div><div className="mini-progress"><i style={{width:s[3]}} /></div><b>{s[3]}</b><button onClick={() => {setSelectedStudent(s[0]);setModal("student");}}>View profile →</button></article>)}</div>}</PageFrame>;
  }

  function AttendancePage() {
    const present = Object.values(attendance).filter(value => value === "Present").length;
    const late = Object.values(attendance).filter(value => value === "Late").length;
    const absent = Object.values(attendance).filter(value => value === "Absent").length;
    return <PageFrame eyebrow={`SPRING SEMESTER · SESSION ${selectedSessionNumber} OF 10`} title={t.attendance} description="A shared ten-session register available to every demonstrator, with an accountable correction history.">
      <section className="policy-banner"><span>!</span><div><strong>Maximum two missed sessions</strong><p>A student remains eligible after zero, one or two absences. The third recorded absence changes the student to “Not eligible” and creates an email notification. Correcting the register recalculates eligibility.</p></div></section>
      <div className="attendance-summary"><article><strong>{present}</strong><span>Present</span></article><article><strong>{late}</strong><span>Late</span></article><article><strong>{absent}</strong><span>Absent</span></article><label><span>Semester session</span><select aria-label="Attendance session" value={selectedSessionNumber} onChange={event => void selectAttendanceSession(Number(event.target.value))}>{Array.from({length:10},(_,index)=>index+1).map(number=><option key={number} value={number}>Session {number} of 10{attendanceSessions.some(session=>session.session_number===number)?" · recorded":" · not recorded"}</option>)}</select></label></div>
      <section className="attendance-sheet total-overview"><div className="attendance-head"><span>Student</span>{Array.from({length:10},(_,index)=><span key={index}>S{index+1}</span>)}<span>Missed</span><span>Eligibility</span><span>Record session {selectedSessionNumber}</span></div>{studentRecords.map(student => {
        const id = student[5] ?? "";
        const recordedAbsences = Object.values(attendanceOverview[id] ?? {}).filter(value => value === "Absent").length;
        const projectedAbsences = recordedAbsences + ((attendanceOverview[id]?.[selectedSessionNumber] !== "Absent" && attendance[student[0]] === "Absent") ? 1 : 0) - ((attendanceOverview[id]?.[selectedSessionNumber] === "Absent" && attendance[student[0]] !== "Absent") ? 1 : 0);
        const blocked = projectedAbsences > 2;
        const warning = projectedAbsences === 2 && !blocked;
        return <div className={`attendance-row ${blocked ? "blocked-row" : warning ? "warning-row" : ""}`} key={id || student[0]}><span className="student-cell"><Avatar name={student[0]} src={student[8]} emoji={student[9]} /><strong>{student[0]}<small>{student[2]}</small></strong></span>{Array.from({length:10},(_,index)=>index+1).map(number => { const value = number === selectedSessionNumber ? attendance[student[0]] : attendanceOverview[id]?.[number]; return <span className={`attendance-mark ${value?.toLowerCase() ?? "empty"} ${number === selectedSessionNumber ? "selected" : ""}`} title={value ?? "Not recorded"} key={number}>{value ? value[0] : "—"}</span>; })}<strong className={`absence-total ${blocked ? "blocked" : warning ? "warning" : ""}`}>{projectedAbsences}<small>/ 2</small></strong><b className={blocked ? "eligibility blocked" : warning ? "eligibility warning" : "eligibility"}>{blocked ? "Not eligible" : warning ? "Limit reached" : "Eligible"}</b><span className="attendance-controls">{(["Present","Late","Absent"] as const).map(value => <button type="button" aria-label={`${student[0]} ${value} for session ${selectedSessionNumber}`} key={value} className={attendance[student[0]] === value ? `active ${value.toLowerCase()}` : ""} onClick={() => setAttendance(current => ({...current,[student[0]]:value}))}>{value[0]}</button>)}</span></div>;
      })}</section>
      <div className="sheet-actions"><p>Each save is timestamped with the responsible staff account.</p><button className="primary-button" disabled={dataBusy||studentRecords.length===0} onClick={saveAttendance}>Save attendance register →</button></div>
    </PageFrame>;
  }

  async function selectAttendanceSession(sessionNumber: number) {
    setSelectedSessionNumber(sessionNumber);
    const session = attendanceSessions.find(item => item.session_number === sessionNumber);
    setActiveSessionId(session?.id ?? null);
    const next: Record<string, AttendanceValue> = {};
    studentRecords.forEach(student => { next[student[0]] = student[5] ? attendanceOverview[student[5]]?.[sessionNumber] ?? "Present" : "Present"; });
    setAttendance(next);
  }

  async function saveAttendance() {
    if (isLocalPreview) { setToast("Preview: attendance saved and eligibility recalculated."); return; }
    setDataBusy(true);
    try {
      const records = studentRecords.filter(row=>row[5]).map(row=>({studentId:row[5],status:(attendance[row[0]]??"Present").toLowerCase()}));
      const response = await fetch("/api/attendance", {method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:activeSessionId,sessionNumber:selectedSessionNumber,semesterKey:"2026-spring",title:`Session ${selectedSessionNumber} of 10`,level:"beginner",records})});
      const result = await response.json();
      if (!response.ok) throw new Error(result.error??"Attendance could not be saved.");
      setActiveSessionId(result.sessionId); const pending=(result.notifications??[]).filter((item:{status:string})=>item.status!=="sent").length; const sent=(result.notifications??[]).filter((item:{status:string})=>item.status==="sent").length; setToast(`Attendance saved. Eligibility was recalculated.${sent?` ${sent} limit email sent.`:""}${pending?` ${pending} limit email queued until email delivery is configured.`:""}`);
      await refreshPortalData();
    } catch(error) { setToast(error instanceof Error?error.message:"Attendance could not be saved."); }
    finally { setDataBusy(false); }
  }

  function CurriculumPage() {
    const selected = curriculumRecords.find(module => module.id === selectedCurriculumId);

    async function saveChapter(event: React.FormEvent<HTMLFormElement>) {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const payload = {
        id: selected?.id,
        level: form.get("level"), week: Number(form.get("week")),
        title_en: form.get("title_en"), title_hu: form.get("title_hu"),
        introduction_en: form.get("introduction_en"), introduction_hu: form.get("introduction_hu"),
        technique_en: form.get("technique_en"), technique_hu: form.get("technique_hu"),
        application_en: form.get("application_en"), application_hu: form.get("application_hu"),
        equipment_en: form.get("equipment_en"), equipment_hu: form.get("equipment_hu"),
        steps_en: String(form.get("steps_en") ?? "").split("\n").map(step => step.trim()).filter(Boolean),
        steps_hu: String(form.get("steps_hu") ?? "").split("\n").map(step => step.trim()).filter(Boolean),
        video_url: form.get("video_url"), published: isAdmin && form.get("published") === "on",
      };
      setDataBusy(true);
      try {
        const response = await fetch("/api/curriculum", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "The chapter could not be saved.");
        setSelectedCurriculumId(result.id); setToast(result.published ? "Chapter published to students." : "Curriculum draft saved.");
        await refreshPortalData();
      } catch (error) { setToast(error instanceof Error ? error.message : "The chapter could not be saved."); }
      finally { setDataBusy(false); }
    }

    async function uploadAsset(file?: File) {
      if (!file || !selected) return;
      const image = ["image/jpeg","image/png","image/webp"].includes(file.type);
      const video = ["video/mp4","video/webm"].includes(file.type);
      if ((!image && !video) || file.size > (video ? 50 : 10) * 1024 * 1024) { setToast(video ? "Videos must be MP4 or WebM and no larger than 50 MB." : "Images must be JPG, PNG or WebP and no larger than 10 MB."); return; }
      setDataBusy(true);
      const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || (video ? "mp4" : "jpg");
      const objectKey = `${accountId}/${selected.id}/${crypto.randomUUID()}.${extension}`;
      try {
        const supabase = getSupabaseBrowserClient();
        const { error: uploadError } = await supabase.storage.from("curriculum").upload(objectKey, file, { contentType:file.type, upsert:false });
        if (uploadError) throw uploadError;
        const response = await fetch("/api/curriculum/assets", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ moduleId:selected.id, objectKey, kind:video ? "video" : "image", caption:file.name }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "The file could not be attached.");
        setToast(`${video ? "Video" : "Image"} added to the chapter.`); await refreshPortalData();
      } catch (error) { setToast(error instanceof Error ? error.message : "The file could not be uploaded."); }
      finally { setDataBusy(false); }
    }

    async function removeAsset(asset: CurriculumAsset) {
      if (!confirm("Remove this file from the chapter?")) return;
      const response = await fetch(`/api/curriculum/assets?id=${asset.id}`, { method:"DELETE" });
      const result = await response.json().catch(() => ({}));
      setToast(response.ok ? "File removed." : result.error ?? "The file could not be removed.");
      if (response.ok) await refreshPortalData();
    }

    return <PageFrame eyebrow={isAdmin ? "ADMINISTRATOR · PUBLICATION CONTROL" : "CURRICULUM EDITOR · DRAFT ACCESS"} title="Teaching curriculum" description={isAdmin ? "Review chapters, manage teaching media and decide what students can see." : "Write structured teaching chapters and add images or short videos. Only the administrator can publish them."} action={<button className="primary-button" onClick={() => setSelectedCurriculumId("")}>＋ New chapter</button>}>
      <section className="editor-policy"><span>✓</span><div><strong>Focused permissions</strong><p>Curriculum editors cannot access students, attendance, submissions, invitation codes or announcements. New work remains a draft until an administrator publishes it.</p></div></section>
      <div className="curriculum-workspace"><aside className="chapter-list"><div><strong>Chapters</strong><span>{curriculumRecords.length}</span></div>{curriculumRecords.length===0?<p>No chapters yet.</p>:curriculumRecords.map(module=><button type="button" className={selectedCurriculumId===module.id?"active":""} onClick={()=>setSelectedCurriculumId(module.id)} key={module.id}><span>W{module.week}</span><div><strong>{module.title_en}</strong><small>{module.level} · {module.published?"Published":"Draft"}</small></div></button>)}</aside>
        <form className="chapter-editor" key={selected?.id ?? "new"} onSubmit={saveChapter}><div className="chapter-editor-head"><div><span className="eyebrow">{selected ? `WEEK ${selected.week}` : "NEW CHAPTER"}</span><h2>{selected?.title_en ?? "Untitled teaching chapter"}</h2></div>{selected&&<b className={selected.published?"published":"draft"}>{selected.published?"Published":"Draft"}</b>}</div>
          <div className="form-grid"><label className="form-field"><span>Level</span><select name="level" defaultValue={selected?.level??"beginner"}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label><label className="form-field"><span>Week</span><input name="week" type="number" min="1" max="30" defaultValue={selected?.week??curriculumRecords.length+1} required /></label></div>
          <div className="editor-language-grid"><fieldset><legend>English chapter</legend><label className="form-field"><span>Title</span><input name="title_en" maxLength={180} defaultValue={selected?.title_en??""} required /></label><label className="reflection-label">Introduction<textarea name="introduction_en" defaultValue={selected?.introduction_en??""} /></label><label className="reflection-label">Technique<textarea name="technique_en" defaultValue={selected?.technique_en??""} /></label><label className="reflection-label">Application<textarea name="application_en" defaultValue={selected?.application_en??""} /></label><label className="reflection-label">Equipment list<textarea name="equipment_en" defaultValue={selected?.equipment_en??""} /></label><label className="reflection-label">Steps · one per line<textarea name="steps_en" defaultValue={(selected?.steps_en??[]).join("\n")} /></label></fieldset><fieldset><legend>Magyar fejezet</legend><label className="form-field"><span>Cím</span><input name="title_hu" maxLength={180} defaultValue={selected?.title_hu??""} required /></label><label className="reflection-label">Bevezetés<textarea name="introduction_hu" defaultValue={selected?.introduction_hu??""} /></label><label className="reflection-label">Technika<textarea name="technique_hu" defaultValue={selected?.technique_hu??""} /></label><label className="reflection-label">Alkalmazás<textarea name="application_hu" defaultValue={selected?.application_hu??""} /></label><label className="reflection-label">Eszközlista<textarea name="equipment_hu" defaultValue={selected?.equipment_hu??""} /></label><label className="reflection-label">Lépések · soronként egy<textarea name="steps_hu" defaultValue={(selected?.steps_hu??[]).join("\n")} /></label></fieldset></div>
          <label className="form-field"><span>Optional external video link</span><input name="video_url" type="url" defaultValue={selected?.video_url??""} placeholder="https://…" /></label>
          {selected&&<section className="chapter-assets"><div><strong>Chapter media</strong><label className="secondary-button">＋ Upload image or video<input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" hidden onChange={event=>{void uploadAsset(event.target.files?.[0]);event.currentTarget.value="";}} /></label></div>{selected.assets.length===0?<p>No media uploaded yet. Images may be up to 10 MB; MP4/WebM videos up to 50 MB.</p>:<div className="asset-grid">{selected.assets.map(asset=><article key={asset.id}>{asset.kind==="image"&&asset.url?<Image src={asset.url} width={320} height={200} unoptimized alt={asset.caption??"Curriculum image"}/>:asset.url?<video src={asset.url} controls preload="metadata"/>:<span>Media unavailable</span>}<div><small>{asset.kind.toUpperCase()}</small><strong>{asset.caption??"Teaching media"}</strong><button type="button" onClick={()=>void removeAsset(asset)}>Remove</button></div></article>)}</div>}</section>}
          <div className="chapter-save">{isAdmin?<label className="check-row"><input name="published" type="checkbox" defaultChecked={selected?.published??false} /> Publish to students after saving</label>:<p>Saved as a private draft for administrator review.</p>}<button className="primary-button" type="submit" disabled={dataBusy}>{dataBusy?"Saving…":isAdmin?"Save chapter":"Save draft"} →</button></div>
        </form></div>
    </PageFrame>;
  }

  function AdminPage() {
    async function createStaffCode(event: React.FormEvent) {
      event.preventDefault();
      if (isLocalPreview) { const previewCode=String(crypto.getRandomValues(new Uint32Array(1))[0]).padStart(10,"0").slice(0,8); setStaffCodes(current=>[{code:previewCode,status:"Preview",expires:`${inviteRole} · ${inviteMaxUses} use(s)`},...current]); setToast("A secure preview code was generated."); return; }
      const response = await fetch("/api/admin/invite-codes", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({role:inviteRole,level:inviteRole==="student"?inviteLevel:null,maxUses:inviteRole==="student"?inviteMaxUses:1}) });
      const result = await response.json();
      if (!response.ok) { if (response.status===403&&await recoverStaffMfa()) return; setToast(result.error ?? "The code could not be created."); return; }
      setStaffCodes(current => [{id:result.id,code:result.code,status:"Active",expires:inviteRole==="student"?`${inviteLevel} · ${inviteMaxUses} uses · expires in 48 hours`:`${inviteRole === "editor" ? "Curriculum editor" : "Demonstrator"} · single use · expires in 48 hours`},...current]);
      setToast(`A new ${inviteRole === "student" ? "student event" : inviteRole === "editor" ? "single-use curriculum editor" : "single-use demonstrator"} code was created. It expires in 48 hours. Copy it now; only its secure hash is stored.`);
    }
    async function resetStaffMfa(event: React.FormEvent<HTMLFormElement>) {
      event.preventDefault();
      const email = String(new FormData(event.currentTarget).get("staffEmail") ?? "").trim();
      if (!confirm(`Reset the authenticator for ${email}? This signs the account out on every device.`)) return;
      const response = await fetch("/api/admin/mfa-reset", { method:"DELETE", headers:{"Content-Type":"application/json"}, body:JSON.stringify({email}) });
      const result = await response.json().catch(() => ({}));
      setToast(response.ok ? result.message : result.error ?? "Authenticator reset failed.");
      if (response.ok) event.currentTarget.reset();
    }
    return <PageFrame eyebrow="ADMINISTRATOR ONLY" title={t.administration} description="Manage demonstrator access, review safeguards and keep responsibility with one named administrator.">
      <div className="admin-grid"><section className="admin-identity"><span className="avatar large">{initials(accountName)}</span><div><span className="eyebrow">PRIMARY ADMINISTRATOR</span><h2>{accountName}</h2><p>Can issue and revoke demonstrator codes, correct attendance and review the audit history.</p></div><b>Protected role</b></section>
      <section className="code-panel"><div><span className="eyebrow">CONTROLLED ACCESS</span><h2>Invitation codes</h2><p>Choose the account type and the website will generate a secure eight-digit code for you. Only its secure hash is stored.</p></div><form onSubmit={createStaffCode}><fieldset className="target-field"><legend>Code type</legend><div><button type="button" className={inviteRole==="student"?"active":""} onClick={()=>setInviteRole("student")}>Student event</button><button type="button" className={inviteRole==="demonstrator"?"active":""} onClick={()=>setInviteRole("demonstrator")}>Demonstrator</button><button type="button" className={inviteRole==="editor"?"active":""} onClick={()=>setInviteRole("editor")}>Curriculum editor</button></div></fieldset>{inviteRole==="student"&&<div className="form-grid"><label className="form-field"><span>Course level</span><select value={inviteLevel} onChange={e=>setInviteLevel(e.target.value as typeof inviteLevel)}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label><label className="form-field"><span>Available places</span><input type="number" min="1" max="200" value={inviteMaxUses} onChange={e=>setInviteMaxUses(Number(e.target.value))}/></label></div>}<div className="generated-code-note"><span>8 digits</span><p>No code to invent or type—the secure code appears below after creation.</p></div><button className="primary-button" type="submit">Generate code →</button></form><div className="code-list">{staffCodes.length === 0 && <p className="modal-copy">Generated codes appear here once, immediately after creation.</p>}{staffCodes.map(item => <article key={item.code}><code>{item.code}</code><div><strong>{item.status}</strong><small>{item.expires}</small></div><button onClick={async () => { if (item.status !== "Active" || !item.id) { setToast("This code is no longer active."); return; } const response=await fetch(`/api/admin/invite-codes?id=${item.id}`,{method:"DELETE"}); if(response.ok) setStaffCodes(current=>current.map(code=>code.id===item.id?{...code,status:"Revoked",expires:"Revoked by administrator"}:code)); else setToast("The code could not be revoked."); }}>{item.status === "Active" ? "Revoke" : "Closed"}</button></article>)}</div></section></div>
      <section className="mfa-recovery"><div><span className="eyebrow">ACCOUNT RECOVERY</span><h2>Lost authenticator phone</h2><p>Reset a demonstrator or curriculum editor only after confirming their identity in person. The account is signed out everywhere and receives a fresh QR code at the next login.</p></div><form onSubmit={resetStaffMfa}><label className="form-field"><span>Staff account email</span><input name="staffEmail" type="email" placeholder="name@example.com" required /></label><button className="secondary-button" type="submit">Reset authenticator →</button></form></section>
      <section className="security-section"><div className="section-heading"><div><span className="eyebrow">LAUNCH SAFEGUARDS</span><h2>Security & data responsibilities</h2></div><button className="secondary-button" onClick={() => setToast("Security checklist marked for the launch review.")}>Review checklist</button></div><div className="security-grid"><article><span>01</span><h3>Identity & roles</h3><p>Managed password authentication, verified email, staff MFA and server-side checks for student, demonstrator and administrator permissions.</p></article><article><span>02</span><h3>Structured records</h3><p>The database separates accounts, codes, modules, attendance, submissions, announcements and audit events.</p></article><article><span>03</span><h3>Private photo storage</h3><p>Uploads use private object storage with short-lived links, file validation and the agreed six-month retention period.</p></article><article><span>04</span><h3>Accountability</h3><p>Code creation, attendance changes and submission reviews are timestamped with the responsible staff account.</p></article></div></section>
    </PageFrame>;
  }

  function ReviewsPage() {
    return <PageFrame eyebrow={`${submissionRecords.filter(item=>item.status!=="reviewed").length} PENDING`} title={t.reviews} description="Open a submission, assess the technique and return private feedback."><div className="toolbar"><div className="filter-pills"><button className="active" onClick={() => setToast("Showing new and resubmitted work.")}>Pending</button><button onClick={() => setToast("Reviewed work remains in the private record.")}>Completed</button></div></div><section className="review-panel"><ReviewTable /></section></PageFrame>;
  }

  function ReportsPage() {
    return <PageFrame eyebrow="PLANNED BEFORE SEMESTER CLOSE" title={t.reports} description="The report workflow is being prepared and is not active yet."><section className="report-hero"><div><span className="stat-icon burgundy">□</span><h2>Semester progress reports</h2><p>The final system will generate each student’s completed techniques, scores, attendance and private feedback before any submission photograph becomes eligible for deletion.</p></div><button className="primary-button" disabled>Not active yet</button></section><div className="report-grid"><article><span>01</span><h3>Generate</h3><p>Create a private report from verified course records.</p></article><article><span>02</span><h3>Deliver</h3><p>Email the report to the student and record successful delivery.</p></article><article><span>03</span><h3>Delete safely</h3><p>Only then may six-month-old photographs enter the deletion queue. No automatic photo deletion is active today.</p></article></div></PageFrame>;
  }

  function ProfilePage() {
    const emojiChoices = ["🧑‍⚕️", "👩‍⚕️", "👨‍⚕️", "🩺", "🧵", "🪡", "🫀", "✨"];
    return <PageFrame eyebrow={role === "student" ? t.studentArea : t.staffArea} title={t.profile} description="Manage your personal details, profile picture, language and notification preferences.">
      <form className="profile-form" onSubmit={async event => {
        event.preventDefault();
        if (isLocalPreview) { completeAction("Preview: profile changes saved locally."); return; }
        const response = await fetch("/api/me", { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ fullName:accountName, language, avatarEmoji:accountAvatarEmoji || null }) });
        const result = await response.json().catch(() => ({}));
        completeAction(response.ok ? "Profile changes saved." : result.error ?? "Profile changes could not be saved.");
      }}>
        <div className="profile-identity"><Avatar name={accountName} src={accountAvatarUrl} emoji={accountAvatarEmoji} className="large" /><div><h2>{accountName}</h2><p>{role === "student" ? t.beginner : isAdmin ? "Administrator" : isCurriculumEditor ? "Curriculum editor" : "Demonstrator"}</p><button className="profile-photo-button" type="button" disabled={dataBusy} onClick={() => profilePhotoInput.current?.click()}>{accountAvatarUrl ? "Change profile picture" : "Add a profile picture"}</button><small>Upload a private photo or choose an emoji. Otherwise, we show a surgeon placeholder.</small><input ref={profilePhotoInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={event => void uploadProfilePhoto(event.target.files?.[0])} /></div></div>
        <fieldset className="emoji-picker"><legend>Choose an emoji profile picture</legend><div>{emojiChoices.map(emoji => <button type="button" className={accountAvatarEmoji === emoji && !accountAvatarUrl ? "selected" : ""} key={emoji} onClick={() => { setAccountAvatarEmoji(emoji); setAccountAvatarUrl(""); }} aria-label={`Use ${emoji} as profile picture`}>{emoji}</button>)}</div><label><span>Or paste another emoji</span><input value={accountAvatarEmoji} maxLength={16} onChange={event => { setAccountAvatarEmoji(event.target.value); setAccountAvatarUrl(""); }} placeholder="🙂" /></label></fieldset>
        <div className="form-grid"><label className="form-field"><span>{t.fullName}</span><input value={accountName} minLength={2} maxLength={120} onChange={event => setAccountName(event.target.value)} required /></label><label className="form-field"><span>{t.email}</span><input value={accountEmail} readOnly /></label><label className="form-field"><span>Interface language</span><select value={language} onChange={event => setLanguage(event.target.value as Language)}><option value="en">English</option><option value="hu">Magyar</option></select></label><label className="form-field"><span>Email notifications</span><select defaultValue="important"><option value="important">Important updates and feedback</option><option value="all">All activity</option><option value="none">None</option></select></label></div>
        {role === "staff"&&<section className="backup-authenticator"><div><strong>Authenticator recovery</strong><p>Add the same account to a second trusted phone or password manager. Supabase supports multiple authenticator factors instead of recovery codes.</p></div><button className="secondary-button" type="button" disabled={authBusy} onClick={()=>void addBackupAuthenticator()}>Add backup authenticator →</button></section>}
        <div className="form-actions"><button className="secondary-button" type="button" onClick={() => setToast("No profile changes were made.")}>{t.cancel}</button><button className="primary-button" type="submit">{t.save}</button></div>
      </form>
    </PageFrame>;
  }

  function AnnouncementList({limit}:{limit?:number}) {
    return announcementRecords.length ? <div className="announcement-list">{announcementRecords.slice(0,limit).map(a => <article key={a.id??a.title}><div className="date-block"><strong>{a.date.split(" ")[0]}</strong><span>{a.date.split(" ")[1]}</span></div><div>{a.pinned && <span className="pin">PINNED</span>}<h3>{language === "hu" ? a.hu : a.title}</h3><p>{a.text}</p></div></article>)}</div> : <div className="empty-state compact"><span>○</span><h3>No announcements yet</h3><p>New demonstrator messages will appear here.</p></div>;
  }

  function ReviewTable({limit}:{limit?:number}) {
    if (!isLocalPreview) {
      const rows=submissionRecords.filter(item=>item.status!=="reviewed").slice(0,limit);
      return <div className="review-table"><div className="table-row table-head"><span>{t.student}</span><span>Technique</span><span>Submitted</span><span>Status</span><span /></div>{rows.length===0?<p className="modal-copy">No submissions are waiting for review.</p>:rows.map(item=><div className="table-row" key={item.id}><span className="student-cell"><i className="avatar">{initials(item.student?.full_name??"Student")}</i><strong>{item.student?.full_name??"Student"}</strong></span><span>{item.module?.title_en??"Technique"}</span><span>{new Date(item.created_at).toLocaleDateString()}</span><span><b className={item.status==="resubmit"?"resubmitted":"new"}>{item.status==="resubmit"?"Resubmitted":"New"}</b></span><span><button onClick={()=>void openReview(item)}>{t.review} →</button></span></div>)}</div>;
    }
    const rows = studentRecords.slice(0,limit);
    return <div className="review-table"><div className="table-row table-head"><span>{t.student}</span><span>Technique</span><span>Submitted</span><span>Status</span><span /></div>{rows.map((s,i) => <div className="table-row" key={s[0]}><span className="student-cell"><i className="avatar">{s[1]}</i><strong>{s[0]}</strong></span><span>{s[4]}</span><span>{i < 2 ? "Today" : "Yesterday"}</span><span><b className={i === 2 ? "resubmitted" : "new"}>{i === 2 ? "Resubmitted" : "New"}</b></span><span><button onClick={() => {setSelectedStudent(s[0]);setModal("review");}}>{t.review} →</button></span></div>)}</div>;
  }

  function renderModal() {
    if (!modal) return null;
    if (modal === "privacy") return <ModalShell title="Privacy notice · draft for approval" onClose={() => setModal(null)} wide><PrivacyNotice /></ModalShell>;
    if (modal === "notifications") return <ModalShell title="Notifications" onClose={() => setModal(null)}>{announcementRecords.length ? <div className="notification-list">{announcementRecords.slice(0,8).map(item => <article key={item.id??item.title} className={item.id&&readAnnouncementIds.includes(item.id)?"read":""}><span>●</span><div><strong>{item.title}</strong><p>{item.text}</p></div></article>)}</div> : <div className="empty-state compact"><span>○</span><h3>You are all caught up</h3><p>Demonstrator announcements will appear in this inbox.</p></div>}<button className="secondary-button full-button" disabled={unreadAnnouncements.length===0} onClick={() => {void markAnnouncementsRead();completeAction("All notifications marked as read.");}}>Mark all as read</button></ModalShell>;
    if (modal === "lesson") { const live=curriculumRecords.find(x=>x.week===selectedModule); const fallback=modules.find(x=>x.week===selectedModule) || modules[3]; const video=live?.assets.find(asset=>asset.kind==="video"&&asset.url); const images=live?.assets.filter(asset=>asset.kind==="image"&&asset.url)??[]; const title=live?(language==="hu"?live.title_hu:live.title_en):(language==="hu"?fallback.hu:fallback.name); const equipment=live?(language==="hu"?live.equipment_hu:live.equipment_en):"Use a needle holder, toothed forceps, scissors, 3-0 practice suture and a synthetic pad."; const technique=live?(language==="hu"?live.technique_hu:live.technique_en):"Follow each step slowly and maintain consistent tissue handling."; const steps=live?(language==="hu"?live.steps_hu:live.steps_en):["Enter the tissue at a 90° angle.","Follow the natural curve of the needle.","Mirror the bite on the opposite side.","Tie a secure square knot without excess tension."]; return <ModalShell title={title} onClose={() => setModal(null)} wide><div className="lesson-layout"><div className="lesson-media">{video?.url?<video src={video.url} controls preload="metadata"/>:images[0]?.url?<Image src={images[0].url} width={720} height={480} unoptimized alt={images[0].caption??title}/>:<div className="lesson-video"><span>▶</span><small>TEACHING MEDIA</small></div>}{live?.video_url&&<a href={live.video_url} target="_blank" rel="noreferrer">Open external teaching video ↗</a>}{images.length>1&&<div className="lesson-image-strip">{images.slice(1).map(image=><Image key={image.id} src={image.url!} width={180} height={120} unoptimized alt={image.caption??title}/>)}</div>}</div><div><span className="eyebrow">WEEK {String(live?.week??fallback.week).padStart(2,"0")} · {live?.level??fallback.level}</span><h3>{language==="hu"?"Technikai útmutató":"Technique guide"}</h3>{live&&(language==="hu"?live.introduction_hu:live.introduction_en)&&<p>{language==="hu"?live.introduction_hu:live.introduction_en}</p>}<p>{technique}</p><h4>{language==="hu"?"Eszközök":"Equipment"}</h4><p>{equipment}</p><ol>{steps.map((step,index)=><li key={`${index}-${step}`}>{step}</li>)}</ol>{live&&(language==="hu"?live.application_hu:live.application_en)&&<><h4>{language==="hu"?"Alkalmazás":"Application"}</h4><p>{language==="hu"?live.application_hu:live.application_en}</p></>}<div className="modal-actions"><button className="secondary-button" onClick={() => completeAction("Lesson marked for later.")}>Save for later</button><button className="primary-button" onClick={() => setModal("upload")}>{t.submitWork} →</button></div></div></div></ModalShell>; }
    if (modal === "upload") return <ModalShell title={t.submitWork} onClose={() => {setModal(null);setSelectedFile("");selectedUpload.current=null;}}><form onSubmit={submitPhoto}><p className="modal-copy">Upload one clear JPG, PNG or WebP photo, up to 10 MB. It remains private between you and the demonstrator team.</p><button type="button" className={`dropzone ${selectedFile ? "has-file" : ""}`} onClick={() => fileInput.current?.click()}><span>{selectedFile ? "✓" : "↥"}</span><strong>{selectedFile || "Choose photo"}</strong></button><input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => {selectedUpload.current=e.target.files?.[0]??null;setSelectedFile(e.target.files?.[0]?.name || "");}} /><label className="reflection-label">Optional reflection<textarea name="reflection" maxLength={1000} placeholder="What felt easy or difficult?" /></label><div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setModal(null)}>{t.cancel}</button><button className="primary-button" type="submit" disabled={!selectedFile||dataBusy}>{dataBusy?"Uploading…":t.send}</button></div></form></ModalShell>;
    if (modal === "feedback") {const item=submissionRecords.find(entry=>entry.id===selectedSubmissionId);return <ModalShell title="Demonstrator feedback" onClose={() => setModal(null)}><div className="feedback-detail"><div className="feedback-head"><span className="avatar staff">SF</span><div><strong>Demonstrator team</strong><small>{item?.module?.title_en??"Technique"}</small></div><span className="score">{item?.score??4}<span>/5</span></span></div><div className="feedback-status"><span>✓</span><strong>{item?.outcome==="more_practice"?"A little more practice":t.allDone}</strong></div><blockquote>{item?.feedback??"Good needle angles and consistent spacing. Continue practising consistent tension."}</blockquote></div><button className="primary-button full-button" onClick={() => setModal(null)}>{t.close}</button></ModalShell>;}
    if (modal === "certificate") return <ModalShell title="Certificate preview" onClose={() => setModal(null)}><div className="certificate-preview"><Logo /><span>SURGICAL SOCIETY PÉCS</span><h3>Certificate of Completion</h3><p>This certifies that <strong>Anna Nagy</strong> has successfully completed the Beginner Surgical Skills programme.</p><small>Preview · issued after all 13 techniques are approved</small></div><button className="primary-button full-button" onClick={() => completeAction("Certificate preview downloaded.")}>{t.download}</button></ModalShell>;
    if (modal === "review") return <ModalShell title={`Review · ${selectedStudent}`} onClose={() => setModal(null)} wide><div className="review-workspace"><div className="submission-preview"><span>STUDENT SUBMISSION</span>{reviewImageUrl?<Image src={reviewImageUrl} width={720} height={540} unoptimized alt={`Private submission by ${selectedStudent}`}/>:<div>{isLocalPreview?"Photo preview":"Loading private photo…"}</div>}<small>{submissionRecords.find(item=>item.id===selectedSubmissionId)?.module?.title_en??"Simple interrupted suture"} · private link expires in 5 minutes</small></div><form onSubmit={saveReview}><label>Score</label><div className="score-buttons">{[1,2,3,4,5].map(n=><button type="button" className={score===n?"active":""} onClick={()=>setScore(n)} key={n}>{n}</button>)}</div><label>Outcome</label><div className="outcome-buttons"><button type="button" className={reviewResult==="All done"?"active":""} onClick={()=>setReviewResult("All done")}>All done</button><button type="button" className={reviewResult!=="All done"?"active":""} onClick={()=>setReviewResult("A little more practice")}>A little more practice</button></div><label className="reflection-label">Optional feedback<textarea name="feedback" maxLength={2000} placeholder="Add clear, encouraging feedback…" /></label><button className="primary-button full-button" type="submit">Save and return feedback</button></form></div></ModalShell>;
    if (modal === "announcement") return <ModalShell title={t.newAnnouncement} onClose={() => setModal(null)}><form onSubmit={publishAnnouncement}><label className="form-field"><span>Title</span><input name="title" maxLength={160} required placeholder="Announcement title" /></label><label className="reflection-label">Message<textarea name="message" maxLength={4000} required placeholder="Write the announcement…" /></label><fieldset className="target-field"><legend>Target group</legend><div>{["Everyone","Beginner","Intermediate","Advanced"].map(x=><button type="button" className={announcementTarget===x?"active":""} onClick={()=>setAnnouncementTarget(x)} key={x}>{x}</button>)}</div></fieldset><label className="check-row"><input name="pinned" type="checkbox" /> Pin this announcement</label><div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setModal(null)}>{t.cancel}</button><button className="primary-button" type="submit">{t.publish}</button></div></form></ModalShell>;
    if (modal === "student") return <ModalShell title={selectedStudent} onClose={() => setModal(null)}><div className="student-detail"><Avatar name={selectedStudent} src={studentRecords.find(s=>s[0]===selectedStudent)?.[8]} emoji={studentRecords.find(s=>s[0]===selectedStudent)?.[9]} className="large" /><h3>{selectedStudent}</h3><p>{studentRecords.find(s=>s[0]===selectedStudent)?.[2]} · {studentRecords.find(s=>s[0]===selectedStudent)?.[3]} complete</p><div className="detail-stats"><span><strong>{submissionRecords.filter(item=>item.student?.full_name===selectedStudent&&item.status==="reviewed").length}</strong>Completed</span><span><strong>{submissionRecords.filter(item=>item.student?.full_name===selectedStudent&&item.status==="pending").length}</strong>Pending</span></div><button className="secondary-button full-button" onClick={() => {setModal(null);setStaffPage("reviews");}}>Open submissions →</button></div></ModalShell>;
    return null;
  }
}

function PageFrame({eyebrow,title,description,action,children}:{eyebrow:string;title:string;description:string;action?:React.ReactNode;children:React.ReactNode}) {
  return <div className="page-content"><section className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</section>{children}</div>;
}

function ModalShell({title,onClose,wide=false,children}:{title:string;onClose:()=>void;wide?:boolean;children:React.ReactNode}) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><section className={`upload-modal ${wide?"wide":""}`} role="dialog" aria-modal="true" aria-label={title}><div className="modal-head"><h2>{title}</h2><button aria-label="Close dialog" onClick={onClose}>×</button></div>{children}</section></div>;
}

function PrivacyNotice() {
  return <div className="privacy-notice">
    <p className="privacy-warning"><strong>Approval required before real student onboarding.</strong> The official data-controller name, postal address and privacy contact must still be confirmed by the Surgical Society Pécs.</p>
    <section><h3>Purpose and data collected</h3><p>The platform supports non-clinical surgical-skills teaching. It stores account details, course level, attendance, announcements, submitted practice photographs, optional reflections, scores and demonstrator feedback.</p></section>
    <section><h3>Who can access the information</h3><p>Students can access only their own learning record. Authorised demonstrators can access enrolled students for teaching, attendance and assessment. The named administrator manages access. Supabase and Vercel process encrypted system data as technical providers.</p></section>
    <section><h3>Photographs</h3><p>Only personal practice work may be uploaded. No patient, clinical image, identifying document or third-party personal information is permitted. Submission photographs remain private and are accessed through short-lived links.</p></section>
    <section><h3>Retention and reports</h3><p>The intended retention period is six months. Automatic deletion and semester-report delivery are not active yet; photographs will not be deleted until the report workflow and a report-before-deletion safeguard have been completed and approved.</p></section>
    <section><h3>Attendance</h3><p>There are ten sessions per semester. A maximum of two may be missed. A third recorded absence makes the student ineligible for further attendance and triggers an email notice once email delivery is configured.</p></section>
    <section><h3>Your choices and rights</h3><p>Students may request access, correction or deletion where applicable and may challenge an attendance record. Requests should be directed through the Surgical Society Pécs official contact channel until a dedicated privacy address is approved.</p></section>
  </div>;
}

function Toast({message,onClose}:{message:string;onClose:()=>void}) {
  return <div className="toast" role="status"><span>✓</span><p>{message}</p><button aria-label="Dismiss message" onClick={onClose}>×</button></div>;
}
