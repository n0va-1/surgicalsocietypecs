import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("builds the Ligatura homepage for Surgical Society Pécs", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /title: "Ligatura · Surgical Society Pécs"/i);
  assert.match(page, /Welcome to the Surgical Society\./);
  assert.match(page, /Practice with us and become better bit by bit\./);
  assert.match(page, /Welcome back/);
  assert.match(page, /Choose your area/);
  assert.doesNotMatch(page, /codex-preview|Your site is taking shape/);
});

test("ships the bilingual role-gated interactive prototype", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const schema = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");

  assert.match(page, /type Language = "en" \| "hu"/);
  assert.match(page, /type Role = "student" \| "staff"/);
  assert.match(page, /type AuthMode = "login" \| "register"/);
  assert.match(page, /setAuthenticated\(true\)/);
  assert.match(page, /Staff invitation code/);
  assert.match(page, /Jó napot, Anna/);
  assert.match(page, /Demonstrator overview/);
  assert.match(page, /accept="image\/jpeg,image\/png,image\/webp"/);
  assert.match(page, /data-testid={`nav-\$\{page\}`}/);
  assert.match(page, /src="\/ssp-logo.png"/);
  assert.match(page, /data-testid="registration-name"/);
  assert.match(page, /Surgical Society Pécs/);
  assert.match(page, /function AttendancePage/);
  assert.match(page, /Maximum two missed sessions/);
  assert.match(page, /Add a profile picture/);
  assert.match(page, /\/api\/announcements\/read/);
  assert.doesNotMatch(page, /localStorage|sessionStorage/);
  assert.match(page, /Secure staff sign-in/);
  assert.match(page, /Choose an emoji profile picture/);
  assert.match(page, /total-overview/);
  assert.doesNotMatch(page, /University of Pécs|Medical School/);
  assert.match(page, /function AdminPage/);
  assert.match(page, /Exact approved email address/);
  assert.match(page, /Your student event code/);
  assert.match(layout, /Ligatura · Surgical Society Pécs/);
  assert.match(layout, /icon: "\/ssp-logo.png"/);
  assert.match(css, /data-theme="dark"/);
  assert.match(css, /@media \(max-width:720px\)/);
  assert.match(css, /\.attendance-sheet/);
  assert.match(css, /\.security-grid/);
  assert.match(schema, /export const users/);
  assert.match(schema, /export const attendanceRecords/);
  assert.match(schema, /export const inviteCodes/);
  assert.match(schema, /export const auditLogs/);
  assert.doesNotMatch(schema, /passwordHash|password_hash/);
});
