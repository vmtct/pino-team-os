/** PAP-2145 / PAP-2144 MT-GUEST — native approved primitive schema; permission keys are Core-owned. */
import { TddRegistry, type FieldSchema, type ModuleSchema, type TableQuery } from "@/lib/workspace-schema";
import type { BoField, BoModule } from "@/lib/bo-registration";
export const READ="identity.mytime_guest.view", EDIT="identity.mytime_guest.edit", CREATE="identity.mytime_guest.create";
const base={display:true,search:false,filter:false,sort:false,group:false,inlineEdit:false} as const;
const search={...base,search:true,sort:true,inlineEdit:true} as const;
const choice={...base,filter:true,sort:true} as const;
const edit={...base,inlineEdit:true} as const;
export const fields=[
 {key:"category",label:"Đối tượng",type:"select",icon:"▣",width:150,permission:READ,required:true,readOnly:true,options:["Người lớn","Trẻ em","Chưa xác định"],capabilities:base},
 {key:"name",label:"Họ và tên",type:"text",icon:"Aa",width:210,permission:READ,required:true,readOnly:false,capabilities:search},
 {key:"gender",label:"Giới tính",type:"select",icon:"▣",width:110,permission:READ,required:true,readOnly:false,options:["Nam","Nữ"],capabilities:{...choice,inlineEdit:true}},
 {key:"phone",label:"Số điện thoại",type:"text",icon:"Aa",width:150,permission:READ,required:false,readOnly:false,capabilities:search},
 {key:"center",label:"Cơ sở gốc",type:"text",icon:"Aa",width:180,permission:READ,readOnly:true,capabilities:base},
 {key:"birthDate",label:"Ngày sinh",type:"date",icon:"▦",width:135,permission:READ,readOnly:false,capabilities:edit},
 {key:"email",label:"Email",type:"email",icon:"Aa",width:200,permission:READ,readOnly:false,capabilities:edit},
 {key:"note",label:"Ghi chú",type:"textarea",icon:"Aa",width:230,permission:READ,readOnly:false,capabilities:edit},
 {key:"guardianName",label:"Họ tên người giám hộ",type:"text",icon:"Aa",width:200,permission:READ,readOnly:true,capabilities:base},
 {key:"guardianPhone",label:"Điện thoại người giám hộ",type:"text",icon:"Aa",width:180,permission:READ,readOnly:true,capabilities:base},
 {key:"guardianRelation",label:"Quan hệ",type:"text",icon:"Aa",width:150,permission:READ,readOnly:true,capabilities:base},
 {key:"createdAt",label:"Created Time",type:"datetime",icon:"▦",width:175,permission:READ,readOnly:true,capabilities:base},
 {key:"createdBy",label:"Created By",type:"text",icon:"Aa",width:170,permission:READ,readOnly:true,capabilities:base},
 {key:"updatedAt",label:"Last Modified Time",type:"datetime",icon:"▦",width:185,permission:READ,readOnly:true,capabilities:base},
 {key:"updatedBy",label:"Last Modified By",type:"text",icon:"Aa",width:185,permission:READ,readOnly:true,capabilities:base},
] as const satisfies readonly FieldSchema[];
export type GuestFields=typeof fields;
const order=["name",...fields.filter(f=>f.key!=="name").map(f=>f.key)] as GuestFields[number]["key"][];
const visible=order.filter(k=>k!=="birthDate"&&k!=="email"&&k!=="note"&&k!=="category"&&!k.startsWith("guardian"));
export const queryDefault:TableQuery<GuestFields>={search:"",filters:{logic:"AND",rules:[]},sort:null,group:null,order,visible,page:1,pageSize:15};
const sections=[{id:"profile",label:"Thông tin cá nhân",fields:["category","name","gender","birthDate","phone","email","note"]},{id:"affiliation",label:"Cơ sở",fields:["center"]},{id:"system",label:"Thông tin hệ thống",fields:["createdAt","createdBy","updatedAt","updatedBy"]}] as const;
export const definition={
 version:1,classification:"TDD_DEFAULT",surface:"BO",key:"mytime-guests",label:"Khách",group:"Operations",fields,
 capabilities:{read:READ,create:CREATE,edit:EDIT,history:"access.audit.view"},
 data:{id:"mytime-guest-unbound",list:async()=>{throw Error("Core adapter not bound");},detail:async()=>{throw Error("Core adapter not bound");}},
 table:{identity:{field:"name",pinned:"left",hideable:false,reorderable:false},columns:order.map(field=>({field,visible:visible.includes(field as typeof visible[number])})),
 search:{fields:["name","phone"],normalization:"vi-diacritic-insensitive"},filters:{fields:["gender"],mode:"flat",logic:"AND"},sort:{fields:["name","gender","phone"],mode:"single",nulls:"last",tieBreak:"record-id"},
 group:{fields:[],mode:"single"},views:{builtIn:[],saved:{kind:"local-ui"},actions:["add","apply","rename","delete","reorder"]},pagination:{sizes:[8,15,30],defaultSize:15,mode:"local-ui"},inlineEdit:{fields:[],enabled:false},interaction:{settings:["properties","grouping","filters","quick-views"],quickView:"separate-opener",keyboard:"canonical",undo:"local-ui-only"}},
 drawer:{density:"one-column",sections,actions:[]},detail:{overview:{sections},businessTabs:[],history:{kind:"unavailable",reason:"Chưa có dữ liệu lịch sử."}},
} as const satisfies ModuleSchema<GuestFields>;
const registryInstance=new TddRegistry();
export const guestSchema=registryInstance.register(definition);
export const registry=registryInstance;
const boFields:BoField[]=sections.flatMap(s=>s.fields).map(key=>{const f=fields.find(x=>x.key===key)!;return {key:f.key,label:f.label,type:f.type,icon:f.icon,w:f.width,readonly:f.readOnly,...("options" in f?{options:[...f.options]}:{})}});
export const guestModule:BoModule={label:"Khách",group:"Operations",fields:boFields};
