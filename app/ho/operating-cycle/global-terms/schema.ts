import { TddRegistry, type FieldSchema, type TableQuery } from "@/lib/workspace-schema";
import type { SurfaceDefinition, SurfaceProvider } from "@/lib/workspace-adapters/contracts";
import type { ApprovalVerifier } from "@/lib/workspace-schema/registry";
import { GLOBAL_TERMS_PERMISSION } from "@/lib/ho-global-terms-contract";
import { loadGlobalTerm, loadGlobalTerms } from "@/lib/ho-global-terms-client";
import { BoApiError } from "@/lib/bo-api-error";

const read = { display:true, search:true, filter:true, sort:true, group:true, inlineEdit:false } as const;
const permission = GLOBAL_TERMS_PERMISSION;
export const globalTermFields = [
  {key:"name",label:"Tên học kỳ",type:"text",icon:"Aa",width:260,permission,readOnly:true,capabilities:read},
  {key:"code",label:"Mã",type:"text",icon:"#",width:160,permission,readOnly:true,capabilities:read},
  {key:"startDate",label:"Bắt đầu",type:"date",icon:"◷",width:140,permission,readOnly:true,capabilities:read},
  {key:"endDate",label:"Kết thúc",type:"date",icon:"◷",width:140,permission,readOnly:true,capabilities:read},
  {key:"weekCount",label:"Số tuần",type:"number",icon:"#",width:100,permission,readOnly:true,capabilities:read},
  {key:"scopeType",label:"Phạm vi",type:"text",icon:"Aa",width:100,permission,readOnly:true,capabilities:read},
] as const satisfies readonly FieldSchema[];
type F = typeof globalTermFields;
const keys = ["name","code","startDate","endDate","weekCount","scopeType"] as const;
const sections = [{id:"term-properties",label:"Global Term",fields:keys}] as const;
export const globalTermQuery: TableQuery<F> = {search:"",filters:{logic:"AND",rules:[]},sort:{field:"startDate",direction:"desc"},group:null,order:keys,visible:["name","code","startDate","endDate","weekCount"],page:1,pageSize:15};
export const globalTermDefinition = {
  version:1,classification:"TDD_DEFAULT",surface:"HO",key:"globalTerms",label:"Global Terms",group:"Operating Cycle",fields:globalTermFields,
  capabilities:{read:permission,create:permission,edit:permission,history:permission},
  actions:[
    {id:"term-create",label:"Tạo Global Term",slot:"table.header",variant:"primary",capability:"create",handler:"term.create"},
    {id:"term-edit",label:"Chỉnh sửa",slot:"detail.header",variant:"secondary",capability:"edit",handler:"term.edit"},
    {id:"term-delete",label:"Xóa",slot:"detail.header",variant:"danger",capability:"edit",handler:"term.delete"},
  ],
  table:{identity:{field:"name",pinned:"left",hideable:false,reorderable:false},columns:keys.map(field=>({field,visible:field!=="scopeType"})),
    search:{fields:["name","code"],normalization:"vi-diacritic-insensitive"},filters:{fields:["name","startDate","endDate"],mode:"flat",logic:"AND"},
    sort:{fields:["name","code","startDate","endDate","weekCount"],mode:"single",nulls:"last",tieBreak:"record-id"},group:{fields:[],mode:"single"},
    views:{builtIn:[],saved:{kind:"local-ui"},actions:["add","apply","rename","delete","reorder"]},pagination:{sizes:[8,15,30],defaultSize:15,mode:"local-ui"},
    inlineEdit:{fields:[],enabled:false},interaction:{settings:["properties","grouping","filters","quick-views"],quickView:"separate-opener",keyboard:"canonical",undo:"local-ui-only"}},
  drawer:{density:"one-column",sections,actions:[]},
  detail:{overview:{sections},businessTabs:[{id:"weeks",label:"Tuần",kind:"approved-extension",source:{adapter:"ho-global-term-weeks",permission},extensionId:"ho.global-term.weeks",
    approval:{jira:"PAP-1320",owner:"HO Runtime",designAuthority:"Founder",files:["app/ho/operating-cycle/global-terms/HoGlobalTermsTdd.tsx"],tests:["lib/pap1320-ho-global-terms.test.ts"],reviewBy:"2026-11-30T00:00:00+07:00"}}],
    history:{kind:"unavailable",reason:"Core chưa cung cấp audit Global Term."}},
} as const satisfies SurfaceDefinition<F>;
export const verifyGlobalTermApproval: ApprovalVerifier = (a,s) => s.surface==="HO" && s.key==="globalTerms" && s.extensionId==="ho.global-term.weeks" && a.jira==="PAP-1320" && a.owner==="HO Runtime" && a.designAuthority==="Founder" && a.files.includes("app/ho/operating-cycle/global-terms/HoGlobalTermsTdd.tsx");
const row = (t: Awaited<ReturnType<typeof loadGlobalTerm>> | Awaited<ReturnType<typeof loadGlobalTerms>>[number]) => ({id:t.id,name:t.name,code:t.code,startDate:t.startDate,endDate:t.endDate,weekCount:t.weekCount,scopeType:t.scopeType});
export const globalTermProvider: SurfaceProvider<F> = {
  pagination:"local-ui",
  async list(_q,scope,fetcher,signal) { if(scope.surface!=="HO") throw Error("HO only"); const terms=await loadGlobalTerms(fetcher,signal); return {records:terms.map(t=>({row:row(t),version:t.updatedAt})),total:terms.length}; },
  async detail(id,scope,fetcher,signal) { if(scope.surface!=="HO") throw Error("HO only"); try {const t=await loadGlobalTerm(id,fetcher,signal);return {row:row(t),version:t.updatedAt};} catch(e) {if(e instanceof BoApiError && e.status===404)return null;throw e;} },
  history:{subjectType:"term",bind:(fetcher,scope)=>({kind:"provider",source:{adapter:"ho-global-term-audit",permission},async load(subject,_context,cursor,signal){
    if(scope.surface!=="HO" || subject.type!=="term")return {status:"denied"};
    // PAP-1318 returns the newest 100 atomic successful mutation events, no cursor API.
    if(cursor)return {status:"unavailable",reason:"Core chưa hỗ trợ phân trang audit."};
    const t=await loadGlobalTerm(subject.id,fetcher,signal);
    if(t.history===null)return {status:"unavailable",reason:"Core chưa cung cấp audit Global Term."};
    return {status:"authorized",nextCursor:null,events:t.history.map(h=>({id:h.id,at:h.occurredAt,actor:h.actorId??"Core",action:h.action,outcome:"succeeded",source:"Core Operating Cycle",subject,redacted:true}))};
  }})},
};
export const globalTermRegistry = new TddRegistry(verifyGlobalTermApproval);
export const globalTermSchema = globalTermRegistry.register({...globalTermDefinition,data:{id:"ho-global-terms",async list(_q,_c,signal){const terms=await loadGlobalTerms(fetch,signal);return {rows:terms.map(row),total:terms.length};},async detail(id,_c,signal){return row(await loadGlobalTerm(id,fetch,signal));}}});
