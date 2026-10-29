/**
 * PAP-1033 Founder A: Subscription Saved Views are organization-global metadata.
 * A BO context permission-key list does not carry the role's effective scope.
 * Defer to the authenticated Core read gate before creating a persistent
 * Shared Views runtime; CENTER-only managers keep the ordinary local grid.
 *
 * Other existing modules retain their current admission behavior.
 */
export async function canLoadAuthorizedBoPublicView(
  moduleKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (moduleKey !== "subscriptions") return true;
  try {
    const response = await fetchImpl("/api/bo/views/subscriptions", {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
    });
    return response.ok;
  } catch {
    // Network or authorization ambiguity cannot grant global metadata access.
    return false;
  }
}
