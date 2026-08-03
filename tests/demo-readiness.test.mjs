import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("password recovery exchanges the secure code and lets the member choose a new password", async () => {
  const page = await read("app/reset-password/page.tsx");
  const callback = await read("app/auth/callback/route.ts");
  const homepage = await read("app/page.tsx");
  assert.match(callback, /exchangeCodeForSession/);
  assert.match(callback, /safeNextPath/);
  assert.match(page, /auth\.updateUser\(\{ password \}\)/);
  assert.match(page, /password !== confirmation/);
  assert.match(homepage, /auth\/callback\?next=\/reset-password/);
});

test("registration confirmation returns to the live academy instead of localhost", async () => {
  const registration = await read("app/api/auth/register/route.ts");
  const resend = await read("app/api/auth/resend-confirmation/route.ts");
  const siteUrl = await read("lib/site-url.ts");
  const homepage = await read("app/page.tsx");
  assert.match(registration, /emailRedirectTo: `\$\{getSiteUrl\(request\)\}\/\?emailConfirmed=1`/);
  assert.match(resend, /auth\.resend/);
  assert.match(resend, /consumeRateLimit\(request, "confirmation-resend", 3, 3600\)/);
  assert.match(siteUrl, /https:\/\/ligatura-ke8\.vercel\.app/);
  assert.match(homepage, /Your email address is confirmed\. You can now sign in\./);
  assert.match(homepage, /Resend confirmation email/);
});

test("demonstrators cannot retrieve unpublished curriculum through the API", async () => {
  const route = await read("app/api/curriculum/route.ts");
  assert.match(route, /requireRole\(\["student", "admin", "editor"\]\)/);
  assert.doesNotMatch(route, /"student", "demonstrator", "admin", "editor"/);
});

test("attendance starts unrecorded and only submits deliberately marked students", async () => {
  const page = await read("app/page.tsx");
  assert.match(page, /"Not recorded"/);
  assert.match(page, /Mark everyone present/);
  assert.match(page, /attendance\[row\[0\]\]!=="Not recorded"/);
  assert.doesNotMatch(page, /status:\(attendance\[row\[0\]\]\?\?"Present"\)/);
});

test("administrator readiness and audit endpoints remain server-authorized", async () => {
  const status = await read("app/api/admin/system-status/route.ts");
  const audit = await read("app/api/admin/audit-logs/route.ts");
  assert.match(status, /requireRole\(\["admin"\]\)/);
  assert.match(audit, /requireRole\(\["admin"\]\)/);
  assert.doesNotMatch(status, /RESEND_API_KEY[^\n]*:/);
});
