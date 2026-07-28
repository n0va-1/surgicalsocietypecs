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

export async function consumeRateLimit(request: Request, scope: string, maxRequests: number, windowSeconds: number) {
  const secret = process.env.RATE_LIMIT_SECRET ?? process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return false;
  const digest = createHmac("sha256", secret).update(`${scope}:${rateLimitIdentity(request)}`).digest("hex");
  const admin = createSupabaseAdminClient();
  const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();
  const { count, error } = await admin.from("audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("action", "security.rate_limit")
    .contains("metadata", { bucket: digest })
    .gte("created_at", windowStart);
  if (error || (count ?? maxRequests) >= maxRequests) return false;
  const { error: insertError } = await admin.from("audit_logs").insert({
    action: "security.rate_limit",
    entity_type: scope.slice(0, 80),
    metadata: { bucket: digest },
  });
  return !insertError;
}
