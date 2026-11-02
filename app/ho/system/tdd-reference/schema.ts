import { TddRegistry, type FieldSchema, type ModuleRow, type TableQuery } from "@/lib/workspace-schema";
import type { SurfaceDefinition, SurfaceProvider } from "@/lib/workspace-adapters";
import { BoApiError } from "@/lib/bo-api-error";
const read = { display: true, search: true, filter: true, sort: true, group: true, inlineEdit: false } as const;
const display = { ...read, search: false, filter: false, sort: false, group: false };
const metadata = { icon: "Aa", width: 200, permission: "demo.tdd.read", readOnly: true, capabilities: read } as const;
export const atlasFields = [
 { ...metadata,key:"name",label:"Tên demo",type:"text" },
 { ...metadata,key:"id",label:"UUID demo",type:"id",capabilities:display },
 { ...metadata,key:"status",label:"Trạng thái",type:"select",options:["Active","Pending"] },
 { ...metadata,key:"quantity",label:"Số lượng",type:"number" },
 { ...metadata,key:"amount",label:"Tiền VND",type:"currency" },
 { ...metadata,key:"day",label:"Ngày",type:"date" },
 { ...metadata,key:"relation",label:"Liên kết đơn",type:"relation",options:["Demo A","Demo B"] },
 { ...metadata,key:"enabled",label:"Boolean",type:"boolean" },
 { ...metadata,key:"notes",label:"Văn bản dài",type:"textarea" },
 { ...metadata,key:"at",label:"Ngày giờ Việt Nam",type:"datetime" },
 { ...metadata,key:"relations",label:"Nhiều liên kết",type:"multirelation",options:["Demo A","Demo B"] },
 { ...metadata,key:"person",label:"Người mô phỏng",type:"person",options:["Demo Actor"] },
 { ...metadata,key:"tags",label:"Nhiều lựa chọn",type:"multiselect",options:["Demo A","Demo B"] },
 { ...metadata,key:"email",label:"Email giả lập",type:"email" },
 { ...metadata,key:"url",label:"URL nội bộ demo",type:"url" },
 { ...metadata,key:"computed",label:"Công thức chỉ đọc",type:"formula",capabilities:display },
 { ...metadata,key:"masked",label:"Dữ liệu đã che (giả lập)",type:"text",sensitive:true,capabilities:display },
] as const satisfies readonly FieldSchema[];
export type AtlasFields = typeof atlasFields;
export type AtlasRow = ModuleRow<AtlasFields>;
export const atlasScenarios = ["populated","empty","null","long-unicode","loading","error","401","403","404","readonly","invalid","conflict","success","high-volume"] as const;
export type AtlasScenario = typeof atlasScenarios[number];
export const atlasGaps = ["Rich text, telephone, time-only, duration, percent, color, rating/progress, image/file uploads and JSON are planned families, not registered editable field kinds.","The current HO surface adapter intentionally denies generic inline writes; local typed business forms demonstrate simulated edits. No real commit or Shared Views persistence.","Multi-column sorting and multi-level grouping are not registered; current engine supports single sort/group.","Approved-extension slots require separate exact Founder approval; Atlas does not invent one."] as const;
const sections = [{ id:"identity",label:"Định danh mô phỏng",fields:["name","id","status","person","masked"] },{ id:"values",label:"Giá trị mô phỏng",fields:["quantity","amount","enabled","computed","notes"] },{ id:"relations",label:"Ngày và liên kết mô phỏng",fields:["day","at","relation","relations","tags","email","url"] }] as const;
export const atlasQuery: TableQuery<AtlasFields> = { search:"",filters:{logic:"AND",rules:[]},sort:null,group:null,order:atlasFields.map(f=>f.key),visible:["name","status","quantity","amount"],page:1,pageSize:8 };
export const atlasDefinition = {
 version:1,classification:"TDD_DEFAULT",surface:"HO",key:"tddReference",label:"TDD Reference — DEMO",group:"System",fields:atlasFields,capabilities:{read:"demo.tdd.read",history:"demo.tdd.read"},
 table:{ identity:{field:"name",pinned:"left",hideable:false,reorderable:false},columns:atlasFields.map(f=>({field:f.key,visible:atlasQuery.visible.includes(f.key)})),search:{fields:["name","notes"],normalization:"vi-diacritic-insensitive"},filters:{fields:["name","status","quantity"],mode:"flat",logic:"AND"},sort:{fields:["name","quantity","amount"],mode:"single",nulls:"last",tieBreak:"record-id"},group:{fields:["status"],mode:"single"},views:{builtIn:[{id:"pending",label:"Pending (demo)",state:{...atlasQuery,filters:{logic:"AND",rules:[{field:"status",op:"eq",value:"Pending"}]}}}],saved:{kind:"local-ui"},actions:["add","apply","rename","delete","reorder"]},pagination:{sizes:[8,15,30],defaultSize:8,mode:"local-ui"},inlineEdit:{fields:[],enabled:false},interaction:{settings:["properties","grouping","filters","quick-views"],quickView:"separate-opener",keyboard:"canonical",undo:"local-ui-only"}},
 drawer:{density:"one-column",sections,actions:[]},
 detail:{overview:{sections},businessTabs:[
  {id:"relations",label:"Quan hệ demo",kind:"relation-grid",relatedModule:"tddReference",source:{adapter:"demo.relations",permission:"demo.tdd.read"}},
  {id:"form",label:"Biểu mẫu demo",kind:"form",fields:["label","quantity","day","notes"],submitPermission:"demo.tdd.edit",source:{adapter:"demo.form",permission:"demo.tdd.read"}},
  {id:"timeline",label:"Timeline demo",kind:"timeline",dateField:"at",source:{adapter:"demo.timeline",permission:"demo.tdd.read"}},
  {id:"metrics",label:"Chỉ số demo",kind:"metric-cards",fields:["quantity","amount","computed"],source:{adapter:"demo.metrics",permission:"demo.tdd.read"}},
  {id:"media",label:"Media demo",kind:"media",fields:["url"],source:{adapter:"demo.media",permission:"demo.tdd.read"}},
  {id:"audit",label:"Quyền demo",kind:"audit-events",subjectType:"demo-reference",source:{adapter:"demo.audit",permission:"demo.tdd.read"}},
 ],history:{kind:"provider",source:{adapter:"demo.history",permission:"demo.tdd.read"},load:async(subject)=>({status:"authorized",nextCursor:null,events:[{id:"demo-event",at:"2026-10-30T02:00:00Z",actor:"Demo Actor",action:"Mô phỏng thay đổi — chỉ RAM",outcome:"succeeded",source:"SYNTHETIC DEMO",subject,redacted:true,changes:[{field:"name",before:"Demo trước",after:"Demo sau"}]}]})}},
} as const satisfies SurfaceDefinition<AtlasFields>;
let scenario: AtlasScenario = "populated", attempts=0;
export function configureAtlas(value: AtlasScenario) { scenario=value;attempts=0; }
export function atlasRows(): AtlasRow[] {
 if(scenario==="empty")return [];
 return Array.from({length:scenario==="high-volume"?128:24},(_,i)=>({id:`019d2000-0003-7000-8000-${String(i+1).padStart(12,"0")}`,name:`DEMO ${String(i+1).padStart(3,"0")}`,status:i%2?"Pending":"Active",quantity:i+1,amount:125000,day:"2026-10-30",relation:scenario==="null"?null:"Demo A",enabled:i%2===0,notes:scenario==="long-unicode"?"Tiếng Việt · 漢字 · العربية · 🙂\n".repeat(16):scenario==="null"?null:"Mô phỏng\nKhông có dữ liệu thật.",at:"2026-10-30T09:00",relations:["Demo A","Demo B"],person:"Demo Actor",tags:["Demo A"],email:"demo@example.invalid",url:"https://ho.staging.pinohouse.art/ho/system/tdd-reference",computed:(i+1)*125000,masked:"••• DEMO •••"}));
}
/** This transport handles a synthetic principal in memory; it NEVER calls fetch.
 * The real HO server layout authenticates the route before this UI can mount. */
export const atlasMemoryTransport: typeof fetch = async(input,init)=>{
 const path=new URL(String(input),"https://ho.staging.pinohouse.art").pathname;
 if(path!=="/api/bo/context" || (init?.method??"GET")!=="GET")throw Error("Atlas network forbidden");
 return Response.json({data:{surface:"BO",entitled:true,userId:"synthetic-demo-only",permissionKeys:["team.bo.access","demo.tdd.read",...(scenario==="readonly"?[]:["demo.tdd.edit"])]}});
};
export const atlasProvider: SurfaceProvider<AtlasFields> = {
 pagination:"local-ui",
 history:{subjectType:"demo-reference",bind:()=>atlasDefinition.detail.history},
 list:async(_query,scope,_transport,signal)=>{if(scope.surface!=="HO")throw new BoApiError(403,"Demo HO only",null);if(["401","403"].includes(scenario))throw new BoApiError(Number(scenario),"Demo denied",null);if(scenario==="error"&&attempts++===0)throw new BoApiError(503,"Demo failure",null);if(scenario==="loading")await new Promise(r=>setTimeout(r,1000));signal.throwIfAborted();const rows=atlasRows();return {records:rows.map(row=>({row})),total:rows.length};},
 detail:async(id,scope,_transport,signal)=>{signal.throwIfAborted();if(scope.surface!=="HO")throw new BoApiError(403,"Demo HO only",null);return scenario==="404"?null:atlasRows().find(row=>row.id===id)?{row:atlasRows().find(row=>row.id===id)!}:null;},
};
const registry=new TddRegistry();
export const atlasSchema=registry.register({...atlasDefinition,data:{id:"synthetic-memory-only",list:async()=>({rows:atlasRows(),total:atlasRows().length}),detail:async id=>atlasRows().find(row=>row.id===id)??null}});
export const atlasCoverage=atlasFields.map(field=>({kind:field.type,field:field.key,fixture:"DEMO 001",test:"pap1080-tdd-reference.spec.ts"}));
export const currentAtlasScenario=()=>scenario;
