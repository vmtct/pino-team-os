import { HO_STAGING_HOSTNAME } from "@/lib/host-boundary";
import { staffExpectedPrincipalHeader, validExpectedStaffPrincipal } from "@/lib/ho-manual-staff-create-client";

const origin = "https://" + HO_STAGING_HOSTNAME;
const directory = origin + "/api/ho/staff/directory";

/**
 * Start only the canonical list GET while the adapter initializes. The BFF
 * independently admits the cookie and checks the page principal. Hand the
 * response back through the existing session transport exactly once, so its
 * 401 revocation, before/after context verifications and schema projection
 * are unchanged. No data is rendered or cached by this helper.
 */
export function initialStaffDirectoryFetch(pageOrigin: string, principalId: string, lifetime: AbortSignal, fetcher: typeof fetch = fetch): typeof fetch {
  if (pageOrigin !== origin || !validExpectedStaffPrincipal(principalId) || lifetime.aborted) return fetcher;
  const headers = { [staffExpectedPrincipalHeader]: principalId };
  let pending: Promise<{ response: Response } | { error: unknown }> | null = fetcher(directory, {
    method: "GET", headers, credentials: "same-origin", cache: "no-store", redirect: "error", signal: lifetime,
  }).then(response => ({ response }), error => ({ error }));
  const discard = () => { pending = null; };
  lifetime.addEventListener("abort", discard, { once: true });

  return async (input, init) => {
    if (input !== directory || init?.method !== "GET") return fetcher(input, init);
    lifetime.throwIfAborted();
    init.signal?.throwIfAborted();
    const entry = pending;
    if (!entry) {
      const nextHeaders = new Headers(init.headers);
      nextHeaders.set(staffExpectedPrincipalHeader, principalId);
      return fetcher(input, { ...init, headers: nextHeaders });
    }
    pending = null;
    lifetime.removeEventListener("abort", discard);
    const result = await entry;
    lifetime.throwIfAborted();
    init.signal?.throwIfAborted();
    if ("error" in result) throw result.error;
    return result.response;
  };
}
