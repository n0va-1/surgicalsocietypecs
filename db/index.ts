import "server-only";
import postgres from "postgres";

export function getDatabase() {
  const url = process.env.POSTGRES_URL;
  if (!url || url === "[SENSITIVE]") throw new Error("The Supabase Postgres connection is unavailable in this environment.");
  return postgres(url, { max: 5, prepare: false });
}
