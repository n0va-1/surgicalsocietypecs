import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type StoredFileKind = "image" | "video";

const signatures: Record<StoredFileKind, Array<(bytes: Uint8Array) => boolean>> = {
  image: [
    bytes => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
    bytes => bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a,
    bytes => bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP",
  ],
  video: [
    bytes => bytes.length >= 12 && new TextDecoder().decode(bytes.slice(4, 8)) === "ftyp",
    bytes => bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3,
  ],
};

export async function validateStoredFile(bucket: string, objectKey: string, kind: StoredFileKind, maximumBytes: number) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(objectKey, 60);
  if (error || !data?.signedUrl) return false;

  const response = await fetch(data.signedUrl, {
    headers: { Range: "bytes=0-511" },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!response || !response.ok) return false;

  const contentRange = response.headers.get("content-range");
  const totalBytes = contentRange ? Number(contentRange.split("/").at(-1)) : Number(response.headers.get("content-length"));
  if (!Number.isFinite(totalBytes) || totalBytes < 1 || totalBytes > maximumBytes) return false;

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > 1024) return false;
  return signatures[kind].some(check => check(bytes));
}
