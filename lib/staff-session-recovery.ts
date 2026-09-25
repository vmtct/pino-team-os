export async function clearInvalidStaffPasswordSession(fetcher: typeof fetch = fetch): Promise<void> {
  try {
    await fetcher("/api/staff-auth/logout", { method: "POST", cache: "no-store" });
  } catch {
    // Local cookie cleanup is best-effort here; login will overwrite it on success.
  }
}

export async function recoverInvalidStaffPasswordSession(
  fetcher: typeof fetch = fetch,
  location: Pick<Location, "replace"> | null = typeof window === "undefined" ? null : window.location,
): Promise<void> {
  await clearInvalidStaffPasswordSession(fetcher);
  location?.replace("/staff-login");
}
