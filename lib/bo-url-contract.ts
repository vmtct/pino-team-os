/** PAP-1089 / PAP-1088 E — approved target URLs. No route admission or redirects here. */
export const BO_LEGACY_QUERY_MODULES = [
  "students", "classes", "subscriptions", "enrollments", "visits", "staffs",
  "timekeeping", "salaryPeriods", "audits", "parents", "missions",
] as const;
type LegacyKey = (typeof BO_LEGACY_QUERY_MODULES)[number];
type Target = Readonly<{ key: string; path: string; tabs: readonly string[]; legacyModule?: LegacyKey }>;
export const BO_TARGET_ROUTES = [
  { key: "missions", path: "/bo/missions", tabs: ["overview", "results", "diary", "history"], legacyModule: "missions" },
  { key: "students", path: "/bo/students", tabs: ["overview", "subscriptions", "history"], legacyModule: "students" },
  { key: "parents", path: "/bo/parents", tabs: ["overview", "students", "contacts", "history"], legacyModule: "parents" },
  { key: "subscriptions", path: "/bo/subscriptions", tabs: ["overview", "enrollment", "history"], legacyModule: "subscriptions" },
  { key: "running-classes", path: "/bo/running-classes", tabs: ["overview", "enrollment", "history"] },
  { key: "workforce-shift-plans", path: "/bo/workforce-shift-plans", tabs: ["overview", "history"] },
  { key: "workforce-availability", path: "/bo/workforce-availability", tabs: ["overview", "history"] },
  { key: "workforce-assignments", path: "/bo/workforce-assignments", tabs: ["overview", "history"] },
  { key: "payroll-periods", path: "/bo/payroll-periods", tabs: ["overview", "history"] },
  { key: "pinoria-avatars", path: "/bo/pinoria-avatars", tabs: ["overview", "history"] },
  { key: "open-studio-passes", path: "/bo/open-studio-passes", tabs: ["overview", "history"] },
  { key: "classroom-diaries", path: "/bo/classroom-diaries", tabs: ["overview", "history"] },
  { key: "tvs", path: "/bo/tvs", tabs: ["overview", "space", "history"] },
] as const satisfies readonly Target[];
export type BoTargetModule = (typeof BO_TARGET_ROUTES)[number]["key"];
export type BoUrlSurface = "table" | "drawer" | "detail";
export type BoUrlState = Readonly<{moduleKey: BoTargetModule; surface: BoUrlSurface; recordId?: string; tab?: string; query?: Readonly<Record<string,string>>}>;
const idValid = (id: string) => /^[A-Za-z0-9_-]{1,128}$/.test(id);
const legalQuery = new Set(["view","search","sort","filter","page","cursor","centerId","from","to"]);
const queryValid = (v: string) => v.length <= 256 && !/[\u0000-\u001f\u007f]/.test(v);
const getRoute = (key: string): Target | undefined => BO_TARGET_ROUTES.find(route=>route.key===key);
export function assertBoTargetRegistry(): void {
  const keys=new Set<string>(), paths=new Set<string>(), aliases=new Set<string>();
  for (const r of BO_TARGET_ROUTES) {
    if (!/^\/bo\/[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(r.path) || keys.has(r.key) || paths.has(r.path))
      throw new Error("Invalid BO target path/key");
    if (r.tabs[0]!=="overview" || r.tabs.at(-1)!=="history" || new Set(r.tabs).size!==r.tabs.length)
      throw new Error("Invalid BO system tabs");
    if ("legacyModule" in r && r.legacyModule) {
      if (aliases.has(r.legacyModule)) throw new Error("Ambiguous BO legacy alias");
      aliases.add(r.legacyModule);
    }
    keys.add(r.key); paths.add(r.path);
  }
}
assertBoTargetRegistry();
/** Behavior preserving bridge for the currently served query/path hybrid. */
/** PAP-1158: explicit legacy route retirement, not an implicit domain identity alias. */
export function retiredSalaryPeriodRedirectUrl(query: Readonly<Record<string,string|string[]|undefined>>): string {
  const params=new URLSearchParams();
  const canonicalId=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  for(const key of ["record","centerId"] as const) {
    const value=query[key];
    if(typeof value==="string" && canonicalId.test(value)) params.set(key,value);
  }
  return "/bo/payroll-periods"+(params.size?"?"+params.toString():"");
}
export function currentBoModuleHref(key: string, admitted: Readonly<Record<string,string>>): string {
  if (key==="salaryPeriods") return "/bo/payroll-periods";
  if (Object.prototype.hasOwnProperty.call(admitted,key)) return admitted[key];
  return key==="students"?"/bo":"/bo?module="+encodeURIComponent(key);
}
/** Never infer classes=running-classes, staffs=staff or salaryPeriods=payroll-periods. */
export function targetForLegacyModule(key: string): BoTargetModule|null {
  return BO_TARGET_ROUTES.find(r=>"legacyModule" in r && r.legacyModule===key)?.key??null;
}
export function buildBoTargetUrl(state: BoUrlState): string {
  const route=getRoute(state.moduleKey);
  if (!route || !["table","drawer","detail"].includes(state.surface)) throw new Error("Unknown BO URL module/surface");
  if (state.surface==="table" ? state.recordId!==undefined : !state.recordId || !idValid(state.recordId))
    throw new Error("Invalid BO record identity");
  if (state.tab && (state.surface!=="detail" || !route.tabs.includes(state.tab))) throw new Error("Invalid BO tab");
  const params=new URLSearchParams();
  for (const [key,value] of Object.entries(state.query??{})) {
    if (!legalQuery.has(key) || typeof value!=="string" || !queryValid(value)) throw new Error("Invalid BO query state");
    params.set(key,value);
  }
  if (state.surface==="drawer") params.set("record",state.recordId!);
  if (state.tab) params.set("tab",state.tab);
  const path=state.surface==="detail"?route.path+"/"+encodeURIComponent(state.recordId!):route.path;
  return path+(params.size?"?"+params.toString():"");
}
export function parseBoTargetUrl(pathname: string, search=""): BoUrlState|null {
  const clean=pathname.length>1?pathname.replace(/\/$/,""):pathname;
  const direct=BO_TARGET_ROUTES.find(r=>r.path===clean);
  const route:Target|undefined=direct??BO_TARGET_ROUTES.find(r=>clean.startsWith(r.path+"/"));
  if (!route) return null;
  let id:string|undefined;
  if (!direct) {
    try { id=decodeURIComponent(clean.slice(route.path.length+1)); } catch { return null; }
    if (!id || !idValid(id)) return null;
  }
  const params=new URLSearchParams(search.startsWith("?")?search.slice(1):search);
  for (const [key,val] of params) {
    if ((!legalQuery.has(key) && key!=="record" && key!=="tab") || params.getAll(key).length!==1 || !queryValid(val)) return null;
  }
  const selected=params.get("record"), tab=params.get("tab");
  if ((id && selected) || (selected!==null && (!direct || !idValid(selected)))) return null;
  const surface:BoUrlSurface=id?"detail":selected?"drawer":"table";
  if (tab && (surface!=="detail" || !route.tabs.includes(tab))) return null;
  const query:Record<string,string>={};
  for (const key of legalQuery) {const val=params.get(key);if(val!==null)query[key]=val;}
  return {moduleKey:route.key as BoTargetModule,surface,
    ...(id||selected?{recordId:id||selected!}:{}),...(tab?{tab}:{}),
    ...(Object.keys(query).length?{query}:{})};
}
