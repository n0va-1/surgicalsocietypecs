import { createBrowserClient } from "@supabase/ssr";

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function getSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url?.startsWith("https://") || !key || key === "[SENSITIVE]") throw new Error("Supabase credentials are available only in the connected Vercel environment. Use the local preview button here.");
  browserClient ??= createBrowserClient(url, key);
  return browserClient;
}
