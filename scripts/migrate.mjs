import { readFile, readdir } from "node:fs/promises";
import postgres from "postgres";

const url = process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;
if (!url) throw new Error("POSTGRES_URL_NON_POOLING or POSTGRES_URL is required.");

const sql = postgres(url, { max: 1, ssl: "require", idle_timeout: 5 });
try {
  const directory = new URL("../supabase/migrations/", import.meta.url);
  const files = (await readdir(directory)).filter(file => file.endsWith(".sql")).sort();
  for (const file of files) {
    const migration = await readFile(new URL(file, directory), "utf8");
    await sql.unsafe(migration);
    console.log(`Applied ${file}`);
  }
  console.log("Supabase academy schema is up to date.");
} finally {
  await sql.end();
}
