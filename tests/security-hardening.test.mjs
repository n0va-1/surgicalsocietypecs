import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("keeps curriculum editors out of private student submissions", async () => {
  const route = await read("app/api/submissions/route.ts");
  assert.match(route, /profile\.role === "editor".*status: 403/);
});

test("prevents members from changing privileged profile columns", async () => {
  const migration = await read("supabase/migrations/202608020001_security_hardening.sql");
  assert.match(migration, /revoke update on public\.profiles from authenticated/);
  assert.match(migration, /grant update \(full_name, preferred_language, avatar_path, updated_at\)/);
  assert.doesNotMatch(migration, /grant update \([^)]*role/);
});

test("emails the report before deleting retained photographs", async () => {
  const route = await read("app/api/cron/retention/route.ts");
  const report = route.indexOf("sendSemesterReport");
  const removal = route.indexOf('storage.from("submissions").remove');
  assert.ok(report >= 0 && removal > report);
  assert.match(route, /if \(!await sendSemesterReport[\s\S]*?\)\) continue/);
});

test("uses a nonce-based script policy and atomic database rate limits", async () => {
  const proxy = await read("proxy.ts");
  const layout = await read("app/layout.tsx");
  const security = await read("lib/security.ts");
  assert.match(proxy, /script-src 'self' 'nonce-\$\{nonce\}' 'strict-dynamic'/);
  assert.doesNotMatch(proxy, /script-src[^\n]*unsafe-inline/);
  assert.match(layout, /import \{ connection \} from "next\/server"/);
  assert.match(layout, /await connection\(\)/);
  assert.match(security, /consume_security_rate_limit/);
});

test("does not return raw database error messages from API routes", async () => {
  const routes = await Promise.all([
    "app/api/admin/invite-codes/route.ts",
    "app/api/announcements/route.ts",
    "app/api/attendance/route.ts",
    "app/api/submissions/route.ts",
    "app/api/staff/students/route.ts",
  ].map(read));
  for (const route of routes) assert.doesNotMatch(route, /error\??\.message/);
});
