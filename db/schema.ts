// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
export {};
import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
};

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  authProviderUserId: text("auth_provider_user_id").notNull(),
  email: text("email").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role", { enum: ["student", "demonstrator", "admin"] }).notNull(),
  rank: text("rank", { enum: ["beginner", "intermediate", "advanced"] }),
  eligible: integer("eligible", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
}, table => [
  uniqueIndex("users_auth_provider_id_unique").on(table.authProviderUserId),
  uniqueIndex("users_email_unique").on(table.email),
  index("users_role_idx").on(table.role),
]);

export const inviteCodes = sqliteTable("invite_codes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  codeHash: text("code_hash").notNull(),
  role: text("role", { enum: ["student", "demonstrator"] }).notNull(),
  courseLevel: text("course_level", { enum: ["beginner", "intermediate", "advanced"] }),
  createdBy: integer("created_by").notNull().references(() => users.id),
  maxUses: integer("max_uses").notNull().default(1),
  uses: integer("uses").notNull().default(0),
  expiresAt: text("expires_at").notNull(),
  revokedAt: text("revoked_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [uniqueIndex("invite_codes_hash_unique").on(table.codeHash)]);

export const modules = sqliteTable("modules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  level: text("level", { enum: ["beginner", "intermediate", "advanced"] }).notNull(),
  week: integer("week").notNull(),
  titleEn: text("title_en").notNull(),
  titleHu: text("title_hu").notNull(),
  published: integer("published", { mode: "boolean" }).notNull().default(false),
  ...timestamps,
}, table => [uniqueIndex("modules_level_week_unique").on(table.level, table.week)]);

export const courseSessions = sqliteTable("course_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  level: text("level", { enum: ["beginner", "intermediate", "advanced"] }).notNull(),
  startsAt: text("starts_at").notNull(),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const attendanceRecords = sqliteTable("attendance_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id").notNull().references(() => courseSessions.id),
  studentId: integer("student_id").notNull().references(() => users.id),
  status: text("status", { enum: ["present", "late", "absent"] }).notNull(),
  recordedBy: integer("recorded_by").notNull().references(() => users.id),
  recordedAt: text("recorded_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  correctionNote: text("correction_note"),
}, table => [
  uniqueIndex("attendance_session_student_unique").on(table.sessionId, table.studentId),
  index("attendance_student_idx").on(table.studentId),
]);

export const submissions = sqliteTable("submissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id").notNull().references(() => users.id),
  moduleId: integer("module_id").notNull().references(() => modules.id),
  objectKey: text("object_key").notNull(),
  reflection: text("reflection"),
  status: text("status", { enum: ["pending", "reviewed", "resubmit"] }).notNull().default("pending"),
  score: integer("score"),
  outcome: text("outcome", { enum: ["all_done", "more_practice"] }),
  feedback: text("feedback"),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: text("reviewed_at"),
  deleteAfter: text("delete_after").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [index("submissions_student_idx").on(table.studentId)]);

export const announcements = sqliteTable("announcements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  authorId: integer("author_id").notNull().references(() => users.id),
  titleEn: text("title_en").notNull(),
  titleHu: text("title_hu").notNull(),
  bodyEn: text("body_en").notNull(),
  bodyHu: text("body_hu").notNull(),
  targetLevel: text("target_level", { enum: ["everyone", "beginner", "intermediate", "advanced"] }).notNull(),
  pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
  publishedAt: text("published_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  actorId: integer("actor_id").references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  metadata: text("metadata", { mode: "json" }),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [index("audit_entity_idx").on(table.entityType, table.entityId)]);
