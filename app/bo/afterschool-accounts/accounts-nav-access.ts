/** PAP-1886 · BO Users TDD: menu visibility follows the actual selected-Center read. */
const centerIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function canOpenAfterschoolAccounts(centerId: string, signal: AbortSignal, fetcher: typeof fetch = fetch) {
  if (!centerIdPattern.test(centerId) || signal.aborted) return false;
  try {
    const query = new URLSearchParams({ centerId, limit: "1" });
    const response = await fetcher("/api/bo/identity/afterschool-users?" + query, {
      credentials: "same-origin", cache: "no-store", redirect: "error", signal,
    });
    if (!response.ok) return false;
    const payload = await response.json() as { data?: { scopeCenterId?: unknown } } | null;
    return !signal.aborted && payload?.data?.scopeCenterId === centerId;
  } catch {
    return false;
  }
}
