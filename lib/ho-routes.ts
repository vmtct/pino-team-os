/** Single public-page manifest for the staging Head Office surface. No BO or production routes. */
export const HO_PAGE_PATHS = {
  centers: "/ho/centers",
  walkinPasses: "/ho/open-studio/walkin",
  termWeeks: "/ho/workforce/term-weeks",
  staffs: "/ho/staff",
  syllabi: "/ho/learning/syllabi",
  missions: "/ho/learning/missions",
  worlds: "/ho/pinoria/worlds",
  wardrobe: "/ho/pinoria/wardrobe",
  wardrobeSets: "/ho/pinoria/wardrobe-sets",
  effects: "/ho/pinoria/effects",
  users: "/ho/system/users",
  roles: "/ho/system/roles",
  audits: "/ho/system/audit",
} as const;
export const HO_HOME_PATH = HO_PAGE_PATHS.centers;
const approved = new Set<string>(["/ho",...Object.values(HO_PAGE_PATHS)]);
const recordId = /^[A-Za-z0-9_-]{1,100}$/;
/** Prevent cross-host navigation, encoded path tricks and auth/callback loops. */
export function safeHoReturnTo(raw: string | null | undefined): string | null {
  if (!raw || raw.length > 512 || !raw.startsWith("/") || raw.startsWith("//") || /[\\\x00-\x1f]/.test(raw)) return null;
  try {
    const parsed = new URL(raw, "https://ho.staging.pinohouse.art");
    if (parsed.origin !== "https://ho.staging.pinohouse.art" || !approved.has(parsed.pathname) || parsed.hash) return null;
    const keys = [...parsed.searchParams.keys()];
    if (keys.length && (keys.length !== 1 || keys[0] !== "record" || parsed.pathname === "/ho" ||
        !recordId.test(parsed.searchParams.get("record") ?? ""))) return null;
    return parsed.pathname + parsed.search;
  } catch { return null; }
}
export function hoRecordId(raw: string | null): string | null {
  return raw && recordId.test(raw) ? raw : null;
}
