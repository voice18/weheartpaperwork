const KEY = "whp_owner_return_after_login";

export function rememberOwnerReturn(): void {
  if (typeof window === "undefined") return;
  try { window.sessionStorage.setItem(KEY, "1"); } catch { /* Browsing can still continue without session storage. */ }
}

export function hasOwnerReturn(): boolean {
  if (typeof window === "undefined") return false;
  try { return window.sessionStorage.getItem(KEY) === "1"; } catch { return false; }
}

export function clearOwnerReturn(): void {
  if (typeof window === "undefined") return;
  try { window.sessionStorage.removeItem(KEY); } catch { /* No stored destination to clear. */ }
}
