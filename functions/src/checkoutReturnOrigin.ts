/** Keep Stripe on the same approved site where the customer began checkout. */
export function approvedCheckoutReturnBaseUrl(candidate: unknown, projectId: string): string {
  const staging = projectId === "weheartpaperwork-staging";
  const fallback = staging ? "https://weheartpaperwork-staging.web.app" : "https://weheartpaperwork.com";
  if (typeof candidate !== "string" || !candidate.trim()) return fallback;
  try {
    const url = new URL(candidate);
    if (url.origin === fallback) return fallback;
    if (staging && (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
        (url.protocol === "http:" || url.protocol === "https:")) return url.origin;
    if (staging && url.protocol === "https:" && !url.port &&
        /^weheartpaperwork-staging--[a-z0-9-]+\.web\.app$/.test(url.hostname)) return url.origin;
  } catch { /* An invalid or unapproved origin uses the project's main site. */ }
  return fallback;
}
