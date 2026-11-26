import {parseLiveSpaceQuery} from "./ho-learning-space-contract";
import {readWishDetailRoute,wishDetailUrl} from "./pls-wish-detail-route";
import {validateAttributeDirectoryParams} from "./pap1841-attribute-directory-query";
import {attributeModule} from "./ho-attribute-model";
/** Single public-page manifest for the staging Head Office surface. No BO or production routes. */
export const HO_PAGE_PATHS = {
  bills: "/ho/billing/bills",
  productPlans: "/ho/billing/product-plans",
  learningSpaces: "/ho/learning-spaces",
  centers: "/ho/centers",
  walkinPasses: "/ho/open-studio/walkin",
  mytimeWorkshops: "/ho/mytime-workshops",
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
  postApproval: "/ho/content/post-approval",
  worlds: "/ho/pinoria/worlds",
  wardrobe: "/ho/pinoria/wardrobe",
  wardrobeSets: "/ho/pinoria/wardrobe-sets",
  starterSets: "/ho/pinoria/starter-sets",
  wishPolicies: "/ho/pinoria/wish-policies",
  wishBanners: "/ho/pinoria/wish-banners",
  effects: "/ho/pinoria/effects",
  tvPolicies: "/ho/pinoria/tv-policies",
 customAttributes: "/ho/system/custom-attributes",
  people: "/ho/system/people",
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
    // PAP-2353: normalize the retired Staff M1 review marker, never grant admission here.
    if (parsed.pathname === HO_PAGE_PATHS.staffs && parsed.searchParams.has("m1Preview")) {
      const markers = parsed.searchParams.getAll("m1Preview");
      const records = parsed.searchParams.getAll("record");
      if (markers.length !== 1 || markers[0] !== "1" || records.length > 1 || (records.length === 1 && !/^STAFF-MOCK-[0-9]{3,}$/.test(records[0]!))) return null;
      parsed.searchParams.delete("m1Preview");
    }
    // PAP-2371: canonical real record state, independently authorized by the page.
    if(parsed.pathname===HO_PAGE_PATHS.learningSpaces){
      const state=parseLiveSpaceQuery(parsed.searchParams);
      if(!state)return null;
      return parsed.pathname+(state.record?"?record="+encodeURIComponent(state.record):"");
    }
    // PAP-2183: Product Plan preview return path is synthetic-only until M4.
    if(parsed.pathname===HO_PAGE_PATHS.productPlans){
      const p=parsed.searchParams;
      const keys=[...p.keys()].filter(k=>!ignoredTrackingKeys.has(k));
      if(keys.some(k=>!["m1Preview","record"].includes(k))||p.getAll("m1Preview").length>1||(p.has("m1Preview")&&p.get("m1Preview")!=="1")||p.getAll("record").length>1)return null;
      const record=p.get("record");
      if(record!==null&&record!=="PRODUCT-PLAN-MOCK-001")return null;
      const q=new URLSearchParams();
      // Valid legacy selector normalizes to the canonical route.
      if(record)q.set("record",record);
      return parsed.pathname+(q.size?"?"+q.toString():"");
    }
    // PAP-2359: Role uses the explicit preview marker to distinguish review
    // from a live-list fallback. Preserve it so the server can enforce review ACL.
    if(parsed.pathname===HO_PAGE_PATHS.roles && parsed.searchParams.has("m1Preview")){
      const p=parsed.searchParams;
      const keys=[...p.keys()].filter(k=>!ignoredTrackingKeys.has(k));
      if(keys.some(k=>!["m1Preview","record"].includes(k))||p.getAll("m1Preview").length!==1||p.get("m1Preview")!=="1"||p.getAll("record").length>1)return null;
      const record=p.get("record");
      if(record!==null&&!/^ROLE-MOCK-[0-9]{3,}$/.test(record))return null;
      return parsed.pathname+"?m1Preview=1"+(record!==null?"&record="+encodeURIComponent(record):"");
    }
    const functionalKeys = [...parsed.searchParams.keys()].filter(key => !ignoredTrackingKeys.has(key));
    // PAP-2359: validate the existing HO Custom Attributes table's shareable URL state.
    if(parsed.pathname===HO_PAGE_PATHS.customAttributes && functionalKeys.some(k=>k!=="record")){
      const q=new URLSearchParams();
      for(const k of functionalKeys){
        const value=parsed.searchParams.get(k)!;
        if(!["search","sort","order","entityType","status","scope","centerId","size","page","columns"].includes(k)||q.has(k)||!value||value.length>256||/[\x00-\x1f\x7f\\]/.test(value))return null;
        q.set(k,value);
      }
      const coreQuery=new URLSearchParams(q);
      const size=q.get("size"),page=q.get("page"),columns=q.get("columns");
      for(const key of ["size","page","columns"])coreQuery.delete(key);
      if(size!==null&&!["8","15","30"].includes(size))return null;
      if(page!==null&&(!/^[1-9]\d{0,4}$/.test(page)||(Number(page)-1)*Number(size??15)>10000))return null;
      if(columns!==null){
        const fields=columns.split(",");
        if(new Set(fields).size!==fields.length||fields.some(k=>!attributeModule.fields.some(f=>f.key===k)))return null;
      }
      if(!validateAttributeDirectoryParams(coreQuery))return null;
      return parsed.pathname+"?"+q.toString();
    }
    if(parsed.pathname===HO_PAGE_PATHS.wishPolicies||parsed.pathname===HO_PAGE_PATHS.wishBanners){
      if(functionalKeys.some(k=>!["record","tab","wishSelection","wishRevision"].includes(k)))return null;
      const kind=parsed.pathname===HO_PAGE_PATHS.wishPolicies?"policy":"banner";
      const route=readWishDetailRoute(parsed.search,kind);
      return wishDetailUrl(parsed.origin+parsed.pathname,kind,route);
    }
    if([HO_PAGE_PATHS.starterSets,HO_PAGE_PATHS.worlds].some(path=>path===parsed.pathname) && functionalKeys.length===2 && functionalKeys.includes("record") && functionalKeys.includes("tab")){
      const record=parsed.searchParams.get("record")??"",tab=parsed.searchParams.get("tab")??"";
      const tabs=parsed.pathname===HO_PAGE_PATHS.worlds?["overview","scenes","preview","history"]:["overview","members","history"];
      if(!recordId.test(record)||!tabs.includes(tab))return null;
      return parsed.pathname+"?record="+encodeURIComponent(record)+"&tab="+tab;
    }
    if (functionalKeys.length && (functionalKeys.length !== 1 || functionalKeys[0] !== "record" || parsed.pathname === "/ho" ||
        !recordId.test(parsed.searchParams.get("record") ?? ""))) return null;
    const record = parsed.searchParams.get("record");
    return parsed.pathname + (functionalKeys.length ? "?record=" + encodeURIComponent(record ?? "") : "");
  } catch { return null; }
}
/** PAP-2359: preserve a single validated HO return target during password/session recovery. */
export function hoStagingReturnFromSearch(search:string):string|null{
  const values=new URLSearchParams(search).getAll("returnTo");
  return values.length===1?safeHoReturnTo(values[0]):null;
}
export function hoStagingAuthPath(path:"/staff-login"|"/staff-password/change",raw:string|null|undefined):string{
  const ret=safeHoReturnTo(raw);
  return ret?path+"?"+new URLSearchParams({returnTo:ret}).toString():path;
}
export function hoRecordId(raw: string | null): string | null {
  return raw && recordId.test(raw) ? raw : null;
}
