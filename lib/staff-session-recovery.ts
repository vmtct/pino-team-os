import {BO_STAGING_RETURN_HOST,boStagingAuthPath} from "./bo-staging-return-to";

export async function clearInvalidStaffPasswordSession(fetcher: typeof fetch = fetch): Promise<void> {
  try {
    await fetcher("/api/staff-auth/logout", { method: "POST", cache: "no-store" });
  } catch {
    // Local cookie cleanup is best-effort here; login will overwrite it on success.
  }
}

export async function recoverInvalidStaffPasswordSession(
  fetcher: typeof fetch = fetch,
  location: (Pick<Location, "replace"> & Partial<Pick<Location,"hostname"|"pathname"|"search">>) | null = typeof window === "undefined" ? null : window.location,
): Promise<void> {
  const target=location?.hostname===BO_STAGING_RETURN_HOST?boStagingAuthPath("/staff-login",(location.pathname??"")+(location.search??"")):"/staff-login";
  await clearInvalidStaffPasswordSession(fetcher);
  location?.replace(target);
}
