/** PAP-2180: canonical typed read-only Person schema. */
import {TddRegistry,type FieldSchema,type ModuleSchema,type TableQuery} from "@/lib/workspace-schema";
export const READ="identity.person.ho_view";
const base={display:true,search:false,filter:false,sort:false,group:false,inlineEdit:false} as const;
const meta={permission:READ,readOnly:true} as const;
const search={...base,search:true,filter:true,sort:true};
const choice={...base,filter:true,sort:true,group:true};
export const fields=[
 {key:"name",label:"Person",type:"text",icon:"Aa",width:245,...meta,capabilities:search},
 {key:"roles",label:"Vai trò",type:"multiselect",icon:"▦",width:200,...meta,options:["Student","Staff","MyTime Guest","Parent"],capabilities:{...base,filter:true}},
 {key:"avatarState",label:"Avatar",type:"select",icon:"◉",width:156,...meta,options:["SELF_MISSING","NEEDS_REPAIR","NOT_STARTED","IN_PROGRESS","READY"],capabilities:choice},
 {key:"identityState",label:"Liên kết",type:"select",icon:"◉",width:145,...meta,options:["Linked","Unlinked"],capabilities:choice},
 {key:"createdAt",label:"Created Time",type:"datetime",icon:"◷",width:190,...meta,capabilities:base},
 {key:"createdBy",label:"Created By",type:"text",icon:"Aa",width:165,...meta,capabilities:base},
 {key:"updatedAt",label:"Last Modified Time",type:"datetime",icon:"◷",width:190,...meta,capabilities:base},
 {key:"updatedBy",label:"Last Modified By",type:"text",icon:"Aa",width:165,...meta,capabilities:base},
 {key:"personId",label:"Person ID",type:"id",icon:"#",width:280,...meta,capabilities:base},
 {key:"student",label:"Student",type:"text",icon:"Aa",width:250,...meta,capabilities:base},
 {key:"staff",label:"Staff",type:"text",icon:"Aa",width:250,...meta,capabilities:base},
 {key:"parent",label:"Parent",type:"text",icon:"Aa",width:250,...meta,capabilities:base},
 {key:"guest",label:"MyTime Guest",type:"text",icon:"Aa",width:250,...meta,capabilities:base},
 {key:"avatarId",label:"Avatar ID",type:"id",icon:"#",width:280,...meta,capabilities:base},
 {key:"nickname",label:"Nickname",type:"text",icon:"Aa",width:180,...meta,capabilities:base},
] as const satisfies readonly FieldSchema[];
export type PersonFields=typeof fields;
const order=["name","roles","avatarState","identityState","createdAt","createdBy","updatedAt","updatedBy","personId"] as const;
export const queryDefault:TableQuery<PersonFields>={search:"",filters:{logic:"AND",rules:[]},sort:null,group:null,order,visible:order.filter(k=>k!=="personId"),page:1,pageSize:15};
const sections=[{id:"identity",label:"Identity",fields:["name","personId","identityState"]},{id:"roles",label:"Roles",fields:["roles","student","staff","parent","guest"]},{id:"pinoria",label:"Pinoria",fields:["avatarState","avatarId","nickname"]},{id:"audit",label:"System",fields:["createdAt","createdBy","updatedAt","updatedBy"],collapsed:true}] as const;
export const definition={version:1,classification:"TDD_DEFAULT",surface:"HO",key:"people",label:"Person",group:"System",fields,capabilities:{read:READ},data:{id:"person-directory-unbound",list:async()=>{throw Error("Unbound Person provider");},detail:async()=>{throw Error("Unbound Person provider");}},table:{identity:{field:"name",pinned:"left",hideable:false,reorderable:false},columns:order.map(field=>({field,visible:field!=="personId"})),search:{fields:["name"],normalization:"vi-diacritic-insensitive"},filters:{fields:["name","roles","avatarState","identityState"],mode:"flat",logic:"AND"},sort:{fields:["name","avatarState","identityState"],mode:"single",nulls:"last",tieBreak:"record-id"},group:{fields:["avatarState","identityState"],mode:"single"},views:{builtIn:[],saved:{kind:"local-ui"},actions:["add","apply","rename","delete","reorder"]},pagination:{sizes:[8,15,30],defaultSize:15,mode:"local-ui"},inlineEdit:{fields:[],enabled:false},interaction:{settings:["properties","grouping","filters","quick-views"],quickView:"separate-opener",keyboard:"canonical",undo:"local-ui-only"}},drawer:{density:"one-column",sections,actions:[]},detail:{overview:{sections},businessTabs:[],history:{kind:"unavailable",reason:"Chưa có lịch sử Person riêng."}}} as const satisfies ModuleSchema<PersonFields>;
export const registry=new TddRegistry();
export const personSchema=registry.register(definition);
