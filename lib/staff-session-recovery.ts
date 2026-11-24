import {BO_STAGING_RETURN_HOST,boStagingAuthPath} from "./bo-staging-return-to";
import {hoStagingAuthPath} from "./ho-routes";

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
  const raw=(location?.pathname??"")+(location?.search??"");
  const target=location?.hostname===BO_STAGING_RETURN_HOST?boStagingAuthPath("/staff-login",raw):
    location?.hostname==="ho.staging.pinohouse.art"?hoStagingAuthPath("/staff-login",raw):"/staff-login";
  await clearInvalidStaffPasswordSession(fetcher);
  location?.replace(target);
}
