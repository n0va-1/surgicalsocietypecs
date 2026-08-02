import "server-only";

import { createHmac } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const strongPasswordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{12,128}$/;

export function isStrongPassword(password: string) {
  return strongPasswordPattern.test(password);
}

export function isSameOriginRequest(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function rateLimitIdentity(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

function rateLimitBucket(request: Request, scope: string, subject = "") {
  const secret = process.env.RATE_LIMIT_SECRET ?? process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return null;
  return createHmac("sha256", secret)
    .update(`${scope}:${rateLimitIdentity(request)}:${subject.trim().toLowerCase()}`)
    .digest("hex");
}

export async function isFailedAttemptRateLimited(request: Request, scope: string, maxFailures: number, windowSeconds: number, subject = "") {
  const bucket = rateLimitBucket(request, scope, subject);
  if (!bucket) return true;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("security_rate_limit_reached", {
    requested_bucket: bucket, maximum_requests: maxFailures, window_seconds: windowSeconds,
  });
  return Boolean(error) || data !== false;
}

export async function recordFailedAttempt(request: Request, scope: string, subject = "") {
  const bucket = rateLimitBucket(request, scope, subject);
  if (!bucket) return;
  const admin = createSupabaseAdminClient();
  await admin.rpc("consume_security_rate_limit", {
    requested_bucket: bucket, maximum_requests: 2_147_483_647, window_seconds: 600,
  });
}

export async function consumeRateLimit(request: Request, scope: string, maxRequests: number, windowSeconds: number) {
  const secret = process.env.RATE_LIMIT_SECRET ?? process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return false;
  const digest = createHmac("sha256", secret).update(`${scope}:${rateLimitIdentity(request)}`).digest("hex");
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("consume_security_rate_limit", {
    requested_bucket: digest, maximum_requests: maxRequests, window_seconds: windowSeconds,
  });
  return !error && data === true;
}
