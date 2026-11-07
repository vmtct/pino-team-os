import { TddRegistry, type FieldSchema, type TableQuery } from "@/lib/workspace-schema";
import type { ApprovalVerifier } from "@/lib/workspace-schema/registry";
import type { SurfaceDefinition, SurfaceProvider } from "@/lib/workspace-adapters/contracts";
import { BoApiError } from "@/lib/bo-api-error";
import type { ModuleRow } from "@/lib/workspace-schema";
import { readSpecialtyV2List,readSpecialtyV2Detail,type SpecialtyV2Summary,type SpecialtyV2Detail } from "@/lib/ho-specialty-v2-reader";

/** PAP-1491 / SPEC-UNLOCK, PAP-1495. Approved V2 geometry; no candidate API integration. */
const permission = "catalog.learning.view";
const read = { display:true, search:true, filter:true, sort:true, group:true, inlineEdit:false } as const;
const specialtyBaseFields = [
  {key:"name",label:"Chuyên đề",type:"text",icon:"Aa",width:240},
  {key:"path",label:"Path",type:"text",icon:"▣",width:180},
  {key:"status",label:"Trạng thái",type:"text",icon:"◉",width:140},
  {key:"description",label:"Mô tả",type:"text",icon:"≡",width:280},
  {key:"levelCount",label:"Cấp",type:"number",icon:"#",width:100},
  {key:"prerequisiteView",label:"Tiên quyết",type:"text",icon:"↗",width:220},
  {key:"tagView",label:"Tag",type:"text",icon:"#",width:180},
  {key:"missionCount",label:"Nhiệm vụ",type:"number",icon:"#",width:110},
] as const;
export const specialtyFields = Object.freeze(specialtyBaseFields.map(field => ({...field,permission,readOnly:true,capabilities:read}))) satisfies readonly FieldSchema[];
type F = typeof specialtyFields;
const keys = specialtyFields.map(field => field.key);
const sections = [{id:"specialty",label:"Chuyên đề",fields:keys}];
export const specialtyQuery: TableQuery<F> = {
  search:"",filters:{logic:"AND",rules:[]},sort:{field:"name",direction:"asc"},group:null,
  order:keys,visible:["name","path","status","levelCount","prerequisiteView","tagView","missionCount"],page:1,pageSize:15,
};
export const specialtyDefinition = {
  version:1,classification:"TDD_DEFAULT",surface:"HO",key:"specialties",label:"Chuyên đề",group:"Learning",
  fields:specialtyFields,capabilities:{read:permission},
  table:{
    identity:{field:"name",pinned:"left",hideable:false,reorderable:false},
    columns:specialtyFields.map(field=>({field:field.key,visible:field.key!=="description"})),
    search:{fields:["name","path","description"],normalization:"vi-diacritic-insensitive"},
    filters:{fields:["path","status","tagView"],mode:"flat",logic:"AND"},
    sort:{fields:["name","levelCount","missionCount"],mode:"single",nulls:"last",tieBreak:"record-id"},
    group:{fields:["path","status"],mode:"single"},
    views:{builtIn:[],saved:{kind:"local-ui"},actions:["add","apply","rename","delete","reorder"]},
    pagination:{sizes:[8,15,30],defaultSize:15,mode:"local-ui"},
    inlineEdit:{enabled:false,fields:[]},
    interaction:{settings:["properties","grouping","filters","quick-views"],quickView:"separate-opener",keyboard:"canonical",undo:"local-ui-only"},
  },
  drawer:{density:"one-column",sections,actions:[]},
  detail:{overview:{sections},businessTabs:[{
    id:"missions",label:"Nhiệm vụ",kind:"approved-extension",
    source:{adapter:"ho-specialty-missions-readonly",permission},extensionId:"ho.learning.specialty-missions",
    approval:{jira:"PAP-1495",owner:"HO Runtime",designAuthority:"Founder",
      files:["app/ho/learning/specialties/HoSpecialtyMissionsTab.tsx"],
      tests:["lib/specialty-interim-shell.test.ts"],reviewBy:"2026-11-30T00:00:00+07:00"},
  }],history:{kind:"unavailable",reason:"Chưa tải được lịch sử Chuyên đề."}},
} as const satisfies SurfaceDefinition<F>;
export const verifySpecialtyExtension: ApprovalVerifier = (approval,scope) =>
  scope.surface==="HO" && scope.key==="specialties" && scope.extensionId==="ho.learning.specialty-missions" &&
  approval.jira==="PAP-1495" && approval.owner==="HO Runtime" && approval.designAuthority==="Founder" &&
  approval.files.includes("app/ho/learning/specialties/HoSpecialtyMissionsTab.tsx");

/** PAP-1495 / PAP-1491 SPEC-UNLOCK: Core-owned Founder V2 readback only.
 * Summary intentionally leaves levels/prerequisites UNKNOWN rather than 0.
 * Detail resolves real Core levels; create/edit stays separately fail-closed.
 */
const summaryRow=(s:SpecialtyV2Summary):ModuleRow<F>=>({
 id:s.id,name:s.name,path:s.pathProgramId,status:s.status,
 description:s.description,levelCount:null,prerequisiteView:null,
 tagView:s.tags.join(", "),missionCount:s.missionCountDistinct,
});
const detailRow=(s:SpecialtyV2Detail):ModuleRow<F>=>({
 ...summaryRow(s),levelCount:s.levels.length,
 prerequisiteView:s.prerequisiteIds.join(", "),
});
export const specialtyProvider: SurfaceProvider<F> = {
  pagination:"local-ui",
  async list(_query,scope,fetcher,signal) {
    signal.throwIfAborted();
    if(scope.surface!=="HO")throw new BoApiError(403,"Không có quyền xem Chuyên đề.",null);
    const records=await readSpecialtyV2List(fetcher,signal);
    return {records:records.map(s=>({row:summaryRow(s),version:String(s.version)})),total:records.length};
  },
  async detail(id,scope,fetcher,signal) {
    signal.throwIfAborted();
    if(scope.surface!=="HO")throw new BoApiError(403,"Không có quyền xem Chuyên đề.",null);
    const s=await readSpecialtyV2Detail(id,fetcher,signal);
    return {row:detailRow(s),version:String(s.version)};
  },
};

/** PAP-1495: explicit route admission schema; runtime uses authenticated adapter. */
const specialtyRegistry = new TddRegistry(verifySpecialtyExtension);
export const specialtySchema = specialtyRegistry.register({ ...specialtyDefinition, data: {
  id: "ho-v2-specialty-reader-unavailable",
  list: async () => { throw new Error("SPECIALTY_V2_READER_UNAVAILABLE"); },
  detail: async () => { throw new Error("SPECIALTY_V2_READER_UNAVAILABLE"); },
}});
export const specialtyVisualPaths = Object.freeze([
  { code: "art-foundation", label: "Art Foundation" },
  { code: "piano-foundation", label: "Piano Foundation" },
]);
export type SpecialtyDraft = { name: string; pathCode: string; description: string };
export function validateSpecialtyDraft(draft: SpecialtyDraft): string | null {
  if (draft.name.trim().length < 3 || draft.name.trim().length > 160) return "Tên chuyên đề phải có từ 3 đến 160 ký tự.";
  if (!specialtyVisualPaths.some(path => path.code === draft.pathCode)) return "Chọn Path hợp lệ.";
  if (draft.description.length > 4000) return "Mô tả không được quá 4.000 ký tự.";
  return null;
}
