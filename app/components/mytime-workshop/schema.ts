/** PAP-2161 / MT-WORKSHOP. Presentation schema, capability binding is injected by host. */
import {TddRegistry,type Approval,type FieldSchema,type ModuleSchema,type TableQuery,type HistoryBinding} from "@/lib/workspace-schema";
const participationApproval={jira:"PAP-2242",owner:"Founder",designAuthority:"PAP-2242 M1 Participation in BO Workshop Detail",files:["app/components/mytime-workshop/WorkshopParticipationTab.tsx","app/components/mytime-workshop/WorkshopParticipationCreate.tsx","app/components/mytime-workshop/WorkshopWorkspace.tsx"],tests:["lib/pap2242-participation-shell.test.ts","lib/pap2242-create-shell.test.ts"],reviewBy:"2026-12-31T00:00:00+07:00"} as const;
export const verifyWorkshopParticipation=(approval:Approval,scope:{surface:"BO"|"HO";key:string;extensionId?:string})=>scope.surface==="BO"&&scope.key==="mytime-workshops"&&scope.extensionId==="pap2242-workshop-participation"&&approval.jira===participationApproval.jira&&approval.designAuthority===participationApproval.designAuthority;
import type {BoField,BoModule} from "@/lib/bo-registration";
export type WorkshopChoices={centers:readonly string[];missions:readonly string[];specialties:readonly string[];staff:readonly string[]};
export type WorkshopCapabilities={read:string;create:string;edit:string;history:string};
export function workshopBinding(surface:"HO"|"BO",choices:WorkshopChoices,cap:WorkshopCapabilities,history:HistoryBinding={kind:"unavailable",reason:"Chưa có dữ liệu lịch sử."}){
 const base={display:true,search:false,filter:false,sort:false,group:false,inlineEdit:false} as const;
 const editable=surface==="HO";
 // Preserve the literal readOnly/inlineEdit pair for the canonical EditablePatch type.
 type EditMode =
  | {readonly readOnly:false;readonly capabilities:{readonly display:true;readonly search:boolean;readonly filter:boolean;readonly sort:boolean;readonly group:boolean;readonly inlineEdit:true}}
  | {readonly readOnly:true;readonly capabilities:{readonly display:true;readonly search:boolean;readonly filter:boolean;readonly sort:boolean;readonly group:boolean;readonly inlineEdit:false}};
 const mode=(extra:Partial<Record<"search"|"filter"|"sort"|"group",boolean>>):EditMode=>{
  const capabilities={display:true as const,search:false,filter:false,sort:false,group:false,...extra};
  return editable?{readOnly:false,capabilities:{...capabilities,inlineEdit:true}}:{readOnly:true,capabilities:{...capabilities,inlineEdit:false}};
 };
 const edit=mode({}),search=mode({search:true,sort:true}),choice=mode({filter:true,sort:true});
 const fields=[
 {key:"name",label:"Tên Workshop",type:"text",icon:"Aa",width:240,permission:cap.read,required:true,...search},
 {key:"center",label:"Chi nhánh",type:"select",icon:"▣",width:180,permission:cap.read,required:true,options:[...choices.centers],...choice},
 {key:"startAt",label:"Bắt đầu",type:"datetime",icon:"▦",width:185,permission:cap.read,required:true,...mode({sort:true})},
 {key:"endAt",label:"Kết thúc",type:"datetime",icon:"▦",width:185,permission:cap.read,required:true,...edit},
 {key:"missions",label:"Nhiệm vụ",type:"multirelation",icon:"▣",width:230,permission:cap.read,required:true,options:[...choices.missions],...edit},
 {key:"specialty",label:"Collection",type:"select",icon:"▣",width:180,permission:cap.read,options:[...choices.specialties],...edit},
 {key:"capacity",label:"Sức chứa",type:"number",icon:"#",width:110,permission:cap.read,...edit},
 {key:"status",label:"Trạng thái",type:"select",icon:"▣",width:130,permission:cap.read,readOnly:true,options:["Đã lên lịch","Đã hủy"],capabilities:{...base,filter:true}},
 {key:"eventLead",label:"Trưởng Event",type:"person",icon:"◉",width:175,permission:cap.read,options:editable?[...choices.staff]:undefined,...edit},
 {key:"academicLead",label:"Trưởng Chuyên môn",type:"person",icon:"◉",width:190,permission:cap.read,options:editable?[...choices.staff]:undefined,...edit},
 {key:"otherStaff",label:"Nhân viên khác",type:"multirelation",icon:"◉",width:230,permission:cap.read,options:editable?[...choices.staff]:undefined,...edit},
 {key:"facebookUrl",label:"Facebook link",type:"url",icon:"↗",width:220,permission:cap.read,...edit},
 {key:"note",label:"Ghi chú",type:"textarea",icon:"Aa",width:230,permission:cap.read,...edit},
 {key:"createdAt",label:"Created Time",type:"datetime",icon:"▦",width:175,permission:cap.read,readOnly:true,capabilities:base},
 {key:"createdBy",label:"Created By",type:"text",icon:"Aa",width:170,permission:cap.read,readOnly:true,capabilities:base},
 {key:"updatedAt",label:"Last Modified Time",type:"datetime",icon:"▦",width:185,permission:cap.read,readOnly:true,capabilities:base},
 {key:"updatedBy",label:"Last Modified By",type:"text",icon:"Aa",width:185,permission:cap.read,readOnly:true,capabilities:base},
 ] as const satisfies readonly FieldSchema[];
 const order=fields.map(f=>f.key),visible=order.filter(k=>k!=="note");
 const query:TableQuery<typeof fields>={search:"",filters:{logic:"AND",rules:[]},sort:null,group:null,order,visible,page:1,pageSize:15};
 const sections=[{id:"event",label:"Thông tin Workshop",fields:["name","center","startAt","endAt","capacity","status","facebookUrl","note"]},{id:"creative",label:"Nội dung sáng tạo",fields:["missions","specialty"]},{id:"staff",label:"Nhân sự",fields:["eventLead","academicLead","otherStaff"]},{id:"system",label:"Thông tin hệ thống",fields:["createdAt","createdBy","updatedAt","updatedBy"]}] as const;
 const definition={version:1,classification:"TDD_DEFAULT",surface,key:"mytime-workshops",label:"Workshop MyTime",group:"Operations",fields,capabilities:editable?cap:{read:cap.read,history:cap.history},
 data:{id:"mt-workshop-unbound",list:async()=>{throw Error("Adapter not bound");},detail:async()=>{throw Error("Adapter not bound");}},
 table:{identity:{field:"name",pinned:"left",hideable:false,reorderable:false},columns:order.map(field=>({field,visible:visible.includes(field as typeof visible[number])})),search:{fields:["name"],normalization:"vi-diacritic-insensitive"},filters:{fields:["center","status"],mode:"flat",logic:"AND"},sort:{fields:["name","center","startAt"],mode:"single",nulls:"last",tieBreak:"record-id"},group:{fields:[],mode:"single"},views:{builtIn:[],saved:{kind:"local-ui"},actions:["add","apply","rename","delete","reorder"]},pagination:{sizes:[8,15,30],defaultSize:15,mode:"local-ui"},inlineEdit:{fields:[],enabled:false},interaction:{settings:["properties","grouping","filters","quick-views"],quickView:"separate-opener",keyboard:"canonical",undo:"local-ui-only"}},
 drawer:{density:"one-column",sections,actions:[]},detail:{overview:{sections},businessTabs:surface==="BO"?[{id:"participation",label:"Participation",kind:"approved-extension" as const,extensionId:"pap2242-workshop-participation",source:{adapter:"bo-workshop-participation",permission:cap.read},approval:participationApproval}]:[],history}
 } as const satisfies ModuleSchema<typeof fields>;
 const registry=new TddRegistry(verifyWorkshopParticipation),schema=registry.register(definition);
 const boFields:BoField[]=sections.flatMap(s=>s.fields).map(key=>{const f=fields.find(x=>x.key===key)!;return {key:f.key,label:f.label,type:f.type,icon:f.icon,w:f.width,readonly:f.readOnly,...("options" in f&&f.options?{options:[...f.options]}:{})}});
 const moduleDefinition:BoModule={label:"Workshop MyTime",group:"Operations",fields:boFields};
 return {registry,schema,module:moduleDefinition,fields,query};
}
export type WorkshopBinding=ReturnType<typeof workshopBinding>;
export type WorkshopFields=WorkshopBinding["fields"];
// Stable BO admission contract. Runtime binding may supply presentation choices and
// a genuine scoped History provider, but must not redefine the authorized surface.
export const boWorkshopSchema=workshopBinding("BO",{centers:[],missions:[],specialties:[],staff:[]},{read:"learning.mytime_workshop.bo_view",history:"learning.mytime_workshop.bo_view",create:"learning.mytime_workshop.ho_manage",edit:"learning.mytime_workshop.ho_manage"}).schema;
export const hoWorkshopSchema=workshopBinding("HO",{centers:[],missions:[],specialties:[],staff:[]},{read:"learning.mytime_workshop.ho_view",history:"learning.mytime_workshop.ho_view",create:"learning.mytime_workshop.ho_manage",edit:"learning.mytime_workshop.ho_manage"}).schema;
export function canonicalWorkshopSchema(template:ModuleSchema<WorkshopFields>,binding:ModuleSchema<WorkshopFields>){
 // PAP-2193: object key insertion order is not part of schema authority; array order is.
 const structural=(s:ModuleSchema<WorkshopFields>)=>JSON.stringify({...s,fields:s.fields.map((f:FieldSchema)=>{const {options,...field}=f;void options;return field;}),detail:{...s.detail,history:undefined}},(_key,value:unknown)=>value!==null&&typeof value==="object"&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0)):value);
 if(structural(template)!==structural(binding))throw Error("Workshop runtime differs from admitted schema");
 if(binding.detail.history.kind!=="provider"||binding.detail.history.source.permission!==template.capabilities.history)throw Error("Workshop history authorization mismatch");
 return binding;
}
