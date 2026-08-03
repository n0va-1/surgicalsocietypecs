const productionSiteUrl = "https://ligatura-ke8.vercel.app";

function normalizeSiteUrl(value: string) {
  const withProtocol = value.startsWith("http://") || value.startsWith("https://") ? value : `https://${value}`;
  const url = new URL(withProtocol);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Invalid site URL protocol.");
  return url.origin;
}

export function getSiteUrl(request?: Request) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (configured) return normalizeSiteUrl(configured);
  if (process.env.NODE_ENV !== "production" && request) return new URL(request.url).origin;
  return productionSiteUrl;
}
