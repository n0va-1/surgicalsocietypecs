import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Surgical Society Skills Academy", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Surgical Society Pécs · Skills Academy<\/title>/i);
  assert.match(html, /Welcome to the Surgical Society\./);
  assert.match(html, /Practice with us and become better bit by bit\./);
  assert.match(html, /Welcome back/);
  assert.match(html, /Choose your area/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
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
  assert.match(page, /ssp-read-announcements/);
  assert.doesNotMatch(page, /University of Pécs|Medical School/);
  assert.match(page, /function AdminPage/);
  assert.match(page, /data-testid="admin-code-input"/);
  assert.match(page, /\^\\d\{6,\}\$/);
  assert.match(layout, /Surgical Society Pécs · Skills Academy/);
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
