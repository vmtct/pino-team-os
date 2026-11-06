import { TddRegistry, type FieldSchema, type TableQuery } from "@/lib/workspace-schema";
import type { ApprovalVerifier } from "@/lib/workspace-schema/registry";
import type { SurfaceDefinition, SurfaceProvider } from "@/lib/workspace-adapters/contracts";
import { BoApiError } from "@/lib/bo-api-error";

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

/** No fabricated empty Catalog, speculative RPC, V1 purchase source or writer.
 * Replace only after PAP-1493's Founder V2 reader and FE contract are serving. */
export const specialtyProvider: SurfaceProvider<F> = {
  pagination:"local-ui",
  async list(_query,scope,_fetcher,signal) {
    signal.throwIfAborted();
    if(scope.surface!=="HO")throw new BoApiError(403,"Không có quyền xem Chuyên đề.",null);
    throw new BoApiError(503,"Chưa tải được danh mục Chuyên đề.",null);
  },
  async detail(_id,scope,_fetcher,signal) {
    signal.throwIfAborted();
    if(scope.surface!=="HO")throw new BoApiError(403,"Không có quyền xem Chuyên đề.",null);
    throw new BoApiError(503,"Chưa tải được chi tiết Chuyên đề.",null);
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
