/**
 * PAP-1507 / PLT-ACCESS-PLATFORM-ACL: presentation only, never an ACL grant.
 * Prefer future explicit catalog metadata. The existing Team OS catalog
 * surfaceApplicability can faithfully distinguish BO, TOS and BOTH, not HO.
 * Unknown/missing classifications remain visible in "Tất cả".
 */
export type Platform = "HO" | "BO" | "TOS";
export type PlatformFilter = Platform | "all";
export interface PermissionPlatformMetadata {
  surfaceApplicability?: "BO" | "TOS" | "BOTH" | string | null;
  applicablePlatforms?: readonly Platform[] | null;
}
const valid = (x: unknown): x is Platform => x==="HO"||x==="BO"||x==="TOS";
export function permissionPlatforms(p: PermissionPlatformMetadata): readonly Platform[] {
  if ("applicablePlatforms" in p) {
    if(!Array.isArray(p.applicablePlatforms))return [];
    return [...new Set((p.applicablePlatforms as readonly unknown[]).filter(valid))];
  }
  switch(p.surfaceApplicability) {
    case "BO": return ["BO"];
    case "TOS": return ["TOS"];
    case "BOTH": return ["BO","TOS"];
    default: return [];
  }
}
export function matchesPlatform(p: PermissionPlatformMetadata, platform: PlatformFilter): boolean {
  return platform==="all"||permissionPlatforms(p).includes(platform);
}
export function permissionPlatformCounts<T extends PermissionPlatformMetadata>(permissions:readonly T[]): Record<PlatformFilter,number> {
  return {
    all:permissions.length,
    HO:permissions.filter(p=>matchesPlatform(p,"HO")).length,
    BO:permissions.filter(p=>matchesPlatform(p,"BO")).length,
    TOS:permissions.filter(p=>matchesPlatform(p,"TOS")).length,
  };
}
