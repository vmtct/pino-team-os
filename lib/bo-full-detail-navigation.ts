/** PAP-882: preserve the authorized BO table context through Full Detail. */
const SAFE_BO_PATH = /^\/bo(?:\/[a-z0-9-]+)*\/?$/;
const SAFE_TAB = /^[a-z][a-z0-9-]{0,63}$/;

export function safeBoTableReturn(raw: string | null | undefined, fallback = "/bo"): string {
  if (!raw || raw.length > 2048 || /[\r\n\\]/.test(raw)) return fallback;
  try {
    const url = new URL(raw, "https://bo.invalid");
    if (url.origin !== "https://bo.invalid" || !SAFE_BO_PATH.test(url.pathname)) return fallback;
    if (url.username || url.password || url.hash) return fallback;
    return url.pathname + url.search;
  } catch { return fallback; }
}

export function detailHref(detailPath: string, tableContext: string, tab?: string): string {
  if (!SAFE_BO_PATH.test(detailPath)) throw new Error("Invalid BO detail path");
  const url = new URL(detailPath, "https://bo.invalid");
  url.searchParams.set("returnTo", safeBoTableReturn(tableContext));
  if (tab !== undefined) {
    if (!SAFE_TAB.test(tab)) throw new Error("Invalid BO detail tab");
    url.searchParams.set("tab", tab);
  }
  return url.pathname + url.search;
}

export function detailTabHref(currentDetail: string, tab: string): string {
  if (!SAFE_TAB.test(tab)) throw new Error("Invalid BO detail tab");
  const url = new URL(currentDetail, "https://bo.invalid");
  if (url.origin !== "https://bo.invalid" || !SAFE_BO_PATH.test(url.pathname)) throw new Error("Invalid BO detail location");
  url.searchParams.set("tab", tab);
  return url.pathname + url.search;
}
