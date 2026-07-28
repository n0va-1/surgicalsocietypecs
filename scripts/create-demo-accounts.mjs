import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase administrator configuration is required.");

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const accounts = [
  { email: "demo.demonstrator@ssp-demo.example", fullName: "Demo Demonstrator", role: "demonstrator", rank: null },
  { email: "demo.student@ssp-demo.example", fullName: "Demo Student", role: "student", rank: "beginner" },
];

async function findUser(email) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const match = data.users.find(user => user.email?.toLowerCase() === email);
    if (match || data.users.length < 100) return match ?? null;
  }
  return null;
}
for (const account of accounts) {
  const password = `Demo-${randomBytes(6).toString("hex")}!7Aa`;
  let user = await findUser(account.email);
  if (user) {
    const { data, error } = await supabase.auth.admin.updateUserById(user.id, { password, email_confirm: true, user_metadata: { full_name: account.fullName } });
    if (error) throw error;
    user = data.user;
  } else {
    const { data, error } = await supabase.auth.admin.createUser({ email: account.email, password, email_confirm: true, user_metadata: { full_name: account.fullName } });
    if (error) throw error;
    user = data.user;
  }
  const { error: profileError } = await supabase.from("profiles").upsert({
    id: user.id,
    email: account.email,
    full_name: account.fullName,
    role: account.role,
    rank: account.rank,
    eligible: true,
    is_demo: true,
    privacy_accepted_at: new Date().toISOString(),
    privacy_version: "2026-07-draft",
  });
  if (profileError) throw profileError;
  console.log(`${account.role.toUpperCase()}|${account.email}|${password}`);
}
