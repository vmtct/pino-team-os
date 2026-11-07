import { TddRegistry, type FieldSchema, type TableQuery } from "@/lib/workspace-schema";
import type { ApprovalVerifier } from "@/lib/workspace-schema/registry";
import type { SurfaceDefinition, SurfaceProvider } from "@/lib/workspace-adapters/contracts";
import { BoApiError } from "@/lib/bo-api-error";
import type { ModuleRow } from "@/lib/workspace-schema";
import { readSpecialtyV2List,readSpecialtyV2Detail,readSpecialtyV2PathOptions,type SpecialtyV2Summary,type SpecialtyV2Detail,type SpecialtyV2PathOption } from "@/lib/ho-specialty-v2-reader";

/** PAP-1491 / SPEC-UNLOCK, PAP-1495. Approved V2 geometry; no candidate API integration. */
const permission = "catalog.learning.view";
const read = { display:true, search:true, filter:true, sort:true, group:true, inlineEdit:false } as const;
const specialtyBaseFields = [
  {key:"name",label:"Chuyên đề",type:"text",icon:"Aa",width:240},
  {key:"path",label:"Path",type:"relation",icon:"↗",width:180},
  {key:"status",label:"Trạng thái",type:"select",icon:"◉",width:140,options:["Bản nháp","Đang áp dụng","Đã lưu trữ"]},
  {key:"description",label:"Mô tả",type:"textarea",icon:"≡",width:280},
  {key:"levelCount",label:"Cấp",type:"number",icon:"#",width:100},
  {key:"prerequisiteView",label:"Tiên quyết",type:"multirelation",icon:"↗",width:220},
  {key:"tagView",label:"Tag",type:"multiselect",icon:"⌗",width:180},
  {key:"missionCount",label:"Nhiệm vụ",type:"number",icon:"#",width:110},
  {key:"createdTime",label:"Created Time",type:"text",icon:"◷",width:195},
  {key:"createdBy",label:"Created by (User)",type:"text",icon:"Aa",width:205},
  {key:"lastModifiedTime",label:"Last Modified Time",type:"text",icon:"◷",width:195},
  {key:"lastModifiedBy",label:"Last Modified by (User)",type:"text",icon:"Aa",width:230},
] as const;
export const specialtyFields = Object.freeze(specialtyBaseFields.map(field => ({...field,permission,readOnly:true,capabilities:read}))) satisfies readonly FieldSchema[];
type F = typeof specialtyFields;
const keys = specialtyFields.map(field => field.key);
const sections = [{id:"specialty",label:"Chuyên đề",fields:keys}];
export const specialtyQuery: TableQuery<F> = {
  search:"",filters:{logic:"AND",rules:[]},sort:{field:"name",direction:"asc"},group:null,
  order:["name","path","status","levelCount","prerequisiteView","tagView","missionCount","createdTime","createdBy","lastModifiedTime","lastModifiedBy","description"],
  visible:["name","path","status","levelCount","prerequisiteView","tagView","missionCount","createdTime","createdBy","lastModifiedTime","lastModifiedBy"],page:1,pageSize:15,
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
  }],history:{kind:"unavailable",reason:"Core chưa cung cấp lịch sử thay đổi Chuyên đề được xác minh."}},
} as const satisfies SurfaceDefinition<F>;
export const verifySpecialtyExtension: ApprovalVerifier = (approval,scope) =>
  scope.surface==="HO" && scope.key==="specialties" && scope.extensionId==="ho.learning.specialty-missions" &&
  approval.jira==="PAP-1495" && approval.owner==="HO Runtime" && approval.designAuthority==="Founder" &&
  approval.files.includes("app/ho/learning/specialties/HoSpecialtyMissionsTab.tsx");

/** PAP-1495 / PAP-1491 SPEC-UNLOCK: Core-owned Founder V2 readback only.
 * Summary intentionally leaves levels/prerequisites UNKNOWN rather than 0.
 * Detail resolves real Core levels; create/edit stays separately fail-closed.
 */
export function formatSpecialtyAuditTime(value:string|null|undefined):string{
 if(!value)return '—';
 const when=new Date(value);
 if(!Number.isFinite(when.valueOf()))return '—';
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Ho_Chi_Minh',hourCycle:'h23',
  year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).formatToParts(when);
 const part=(key:Intl.DateTimeFormatPartTypes)=>parts.find(p=>p.type===key)?.value??'';
 return part('day')+'/'+part('month')+'/'+part('year')+' · '+part('hour')+':'+part('minute');
}
export function specialtyPathLabel(id:string,paths:readonly SpecialtyV2PathOption[]):string{
 const option=paths.find(path=>path.id===id);
 if(!option)throw new BoApiError(502,'Core trả Path Chuyên đề không hợp lệ.',null);
 return option.label;
}
/** PAP-1495 S3: UI labels never replace Core lifecycle codes in DTOs. */
export const specialtyStatusLabel = (status:SpecialtyV2Summary["status"]):string => ({DRAFT:"Bản nháp",ACTIVE:"Đang áp dụng",ARCHIVED:"Đã lưu trữ"})[status];
const summaryRow=(s:SpecialtyV2Summary,paths:readonly SpecialtyV2PathOption[]):ModuleRow<F>=>({
 id:s.id,name:s.name,path:specialtyPathLabel(s.pathProgramId,paths),status:specialtyStatusLabel(s.status),
 description:s.description,levelCount:null,prerequisiteView:null,
 tagView:s.tags,missionCount:s.missionCountDistinct,
 createdTime:formatSpecialtyAuditTime(s.createdAt),createdBy:s.createdByVerifiedLegalName??'—',
 lastModifiedTime:formatSpecialtyAuditTime(s.updatedAt),lastModifiedBy:s.updatedByVerifiedLegalName??'—',
});
export function specialtyPrerequisiteLabels(ids:readonly string[],catalog:readonly SpecialtyV2Summary[]):string[]{
 const byId=new Map(catalog.map(s=>[s.id,s.name]));
 return ids.map(id=>{
  const name=byId.get(id);
  if(!name)throw new BoApiError(502,"Core trả tiên quyết Chuyên đề không thể xác minh.",null);
  return name;
 });
}
const detailRow=(s:SpecialtyV2Detail,paths:readonly SpecialtyV2PathOption[],prerequisites:readonly SpecialtyV2Summary[]):ModuleRow<F>=>({
 ...summaryRow(s,paths),levelCount:s.levels.length,
 prerequisiteView:specialtyPrerequisiteLabels(s.prerequisiteIds,prerequisites),
});
export const specialtyProvider: SurfaceProvider<F> = {
  pagination:"local-ui",
  async list(_query,scope,fetcher,signal) {
    signal.throwIfAborted();
    if(scope.surface!=="HO")throw new BoApiError(403,"Không có quyền xem Chuyên đề.",null);
    const [records,paths]=await Promise.all([readSpecialtyV2List(fetcher,signal),readSpecialtyV2PathOptions(fetcher,signal)]);
    return {records:records.map(s=>({row:summaryRow(s,paths),version:String(s.version)})),total:records.length};
  },
  async detail(id,scope,fetcher,signal) {
    signal.throwIfAborted();
    if(scope.surface!=="HO")throw new BoApiError(403,"Không có quyền xem Chuyên đề.",null);
    const [s,paths]=await Promise.all([readSpecialtyV2Detail(id,fetcher,signal),readSpecialtyV2PathOptions(fetcher,signal)]);
    const prerequisites=s.prerequisiteIds.length?await readSpecialtyV2List(fetcher,signal):[];
    return {row:detailRow(s,paths,prerequisites),version:String(s.version)};
  },
};

/** PAP-1495: explicit route admission schema; runtime uses authenticated adapter. */
const specialtyRegistry = new TddRegistry(verifySpecialtyExtension);
export const specialtySchema = specialtyRegistry.register({ ...specialtyDefinition, data: {
  id: "ho-v2-specialty-reader-unavailable",
  list: async () => { throw new Error("SPECIALTY_V2_READER_UNAVAILABLE"); },
  detail: async () => { throw new Error("SPECIALTY_V2_READER_UNAVAILABLE"); },
}});
/** PAP-1495 / PAP-1491: display only 4 Founder-approved canonical codes.
 * Actual UUIDs must be fetched from Core (never hardcode staging Path IDs).
 */
export const specialtyVisualPaths = Object.freeze([
  { code: "little-piner-art", label: "Little Piner Art" },
  { code: "little-piner-piano", label: "Little Piner Piano" },
  { code: "artchitect", label: "Artchitect" },
  { code: "pianohouse", label: "PianoHouse" },
]);
export type SpecialtyDraft = { name: string; pathCode: string; description: string };
export function validateSpecialtyDraft(draft: SpecialtyDraft): string | null {
  if (draft.name.trim().length < 3 || draft.name.trim().length > 160) return "Tên chuyên đề phải có từ 3 đến 160 ký tự.";
  if (!specialtyVisualPaths.some(path => path.code === draft.pathCode)) return "Chọn Path hợp lệ.";
  if (draft.description.length > 4000) return "Mô tả không được quá 4.000 ký tự.";
  return null;
}
