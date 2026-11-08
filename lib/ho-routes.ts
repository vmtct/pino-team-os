/** Single public-page manifest for the staging Head Office surface. No BO or production routes. */
export const HO_PAGE_PATHS = {
  bills: "/ho/billing/bills",
  centers: "/ho/centers",
  walkinPasses: "/ho/open-studio/walkin",
  termWeeks: "/ho/workforce/term-weeks",
  globalTerms: "/ho/operating-cycle/global-terms",
  shiftTemplates: "/ho/workforce/shift-templates",
  staffs: "/ho/staff",
  staffLinks: "/ho/workforce/staff-links",
  paths: "/ho/learning/paths",
  syllabi: "/ho/learning/syllabi",
  missions: "/ho/learning/missions",
  specialties: "/ho/learning/specialties",
  classroomDiaries: "/ho/learning/diaries",
  worlds: "/ho/pinoria/worlds",
  wardrobe: "/ho/pinoria/wardrobe",
  wardrobeSets: "/ho/pinoria/wardrobe-sets",
  effects: "/ho/pinoria/effects",
  tvPolicies: "/ho/pinoria/tv-policies",
  users: "/ho/system/users",
  roles: "/ho/system/roles",
  audits: "/ho/system/audit",
  tddReference: "/ho/system/tdd-reference",
  languageMappings: "/ho/language-mappings",
} as const;
export const HO_HOME_PATH = HO_PAGE_PATHS.centers;
const approved = new Set<string>(["/ho",...Object.values(HO_PAGE_PATHS)]);
const recordId = /^[A-Za-z0-9_-]{1,100}$/;
/** Analytics parameters are untrusted input, never part of the post-login return destination. */
const ignoredTrackingKeys = new Set(["utm_source","utm_medium","utm_campaign","utm_term","utm_content"]);
/** Prevent cross-host navigation, encoded path tricks and auth/callback loops. */
export function safeHoReturnTo(raw: string | null | undefined): string | null {
  if (!raw || raw.length > 512 || !raw.startsWith("/") || raw.startsWith("//") || /[\\\x00-\x1f]/.test(raw)) return null;
  try {
    const parsed = new URL(raw, "https://ho.staging.pinohouse.art");
    if (parsed.origin !== "https://ho.staging.pinohouse.art" || !approved.has(parsed.pathname) || parsed.hash) return null;
    // PAP-1645 / PAP-1491: strip harmless campaign metadata before validating
    // returnTo, without allowing arbitrary query keys or an off-host target.
    const functionalKeys = [...parsed.searchParams.keys()].filter(key => !ignoredTrackingKeys.has(key));
    if (functionalKeys.length && (functionalKeys.length !== 1 || functionalKeys[0] !== "record" || parsed.pathname === "/ho" ||
        !recordId.test(parsed.searchParams.get("record") ?? ""))) return null;
    const record = parsed.searchParams.get("record");
    return parsed.pathname + (functionalKeys.length ? "?record=" + encodeURIComponent(record ?? "") : "");
  } catch { return null; }
}
export function hoRecordId(raw: string | null): string | null {
  return raw && recordId.test(raw) ? raw : null;
}
