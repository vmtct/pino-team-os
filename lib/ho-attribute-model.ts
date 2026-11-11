/** PAP-1669 / PAP-1665 PLT-ATTR — exact Founder-approved 14 G0 fields, shared DSA matrix. */
import type { BoField, BoModule, BoRecord, BoValue } from "./bo-registration";

export const ENTITY_TYPES=["Student","Parent","Center","Staff","Subscription","Mission"] as const;
export const VALUE_TYPES=["text","number","boolean","date","datetime","select","multiselect","json"] as const;
export const VISIBILITY=["BO","HO","TOS"] as const;
export type EntityType=typeof ENTITY_TYPES[number];
export type ValueType=typeof VALUE_TYPES[number];
export type Surface=typeof VISIBILITY[number];
export type Scope="GLOBAL"|"CENTER";
export interface AttributeDraft {
 displayName:string;attributeKey:string;entityType:EntityType;valueType:ValueType;
 scope:Scope;centerId:string|null;required:boolean;visibility:Surface[];options:string[];
}
export interface AttributeDefinition extends AttributeDraft {
 id:string;status:"DRAFT"|"PILOT"|"ACTIVE"|"DEPRECATED"|"ARCHIVED";revision:number;
 createdAt:string;updatedAt:string;createdByUserId:string;updatedByUserId:string;
}
export type CenterOption={id:string;label:string};
const field=(key:string,label:string,type:BoField["type"],w=175):BoField=>
 ({key,label,type,w,icon:type==="number"?"#":type==="id"?"⌘":"Aa",readonly:true});
export const attributeModule:BoModule={label:"Custom Attributes",group:"System",fields:[
 field("displayName","Tên thuộc tính","text",210),
 field("attributeKey","Mã thuộc tính","id",190),
 field("entityType","Module","select",140),
 field("valueType","Kiểu dữ liệu","select",140),
 field("scope","Phạm vi","select",130),
 field("center","Trung tâm","text",180),
 field("lifecycleState","Vòng đời","select",165),
 field("required","Bắt buộc","boolean",125),
 field("visibility","Hiển thị tại","multiselect",150),
 field("revision","Phiên bản","number",110),
 field("createdAt","Created Time","datetime",165),
 field("createdByUser","Created by (User)","text",180),
 field("updatedAt","Last Modified Time","datetime",185),
 field("updatedByUser","Last Modified by (User)","text",195),
]};
export const optionsField:BoField={...field("options","Danh sách lựa chọn","textarea",190),readonly:true};
export const draft=():AttributeDraft=>({
 displayName:"",attributeKey:"",entityType:"Student",valueType:"text",
 scope:"GLOBAL",centerId:null,required:false,visibility:["BO"],options:[]
});
export const needsOptions=(value:ValueType)=>value==="select"||value==="multiselect";
const date=(v:string)=>{
 const dt=new Date(v);
 if(!Number.isFinite(dt.getTime()))return "—";
 const s=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Ho_Chi_Minh",
  day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(dt);
 return s.replace(",", " ·");
};
const center=(id:string|null,centers:CenterOption[])=>id===null?"—":
 centers.find(c=>c.id===id)?.label??"—";
export function asRecord(item:AttributeDefinition,centers:CenterOption[]):BoRecord{
 return {id:item.id,name:item.displayName,displayName:item.displayName,attributeKey:item.attributeKey,
  entityType:item.entityType,valueType:item.valueType,scope:item.scope,
  center:center(item.centerId,centers),lifecycleState:item.status,
  required:item.required,visibility:item.visibility,revision:item.revision,
  createdAt:date(item.createdAt),updatedAt:date(item.updatedAt),
  // Never infer legal name from opaque Core access_user ID.
  createdByUser:"—",updatedByUser:"—"};
}
export function draftRecord(item:AttributeDraft,centers:CenterOption[]):BoRecord{
 return {id:"",name:item.displayName||"Chưa đặt tên",displayName:item.displayName,
  attributeKey:item.attributeKey,entityType:item.entityType,valueType:item.valueType,
  scope:item.scope,center:center(item.centerId,centers),lifecycleState:"DRAFT",
  required:item.required,visibility:item.visibility,revision:1,createdAt:"—",
  createdByUser:"—",updatedAt:"—",updatedByUser:"—",
  ...(needsOptions(item.valueType)?{options:item.options.join("\n")}:{})};
}
export function editDraft(item:AttributeDraft,key:string,raw:BoValue,centers:CenterOption[]):AttributeDraft{
 const text=String(raw??"");
 switch(key) {
  case "displayName":return {...item,displayName:text};
  case "attributeKey":return {...item,attributeKey:text.trim().toLowerCase()};
  case "entityType":return ENTITY_TYPES.includes(text as EntityType)?{...item,entityType:text as EntityType}:item;
  case "valueType":return VALUE_TYPES.includes(text as ValueType)?
   {...item,valueType:text as ValueType,options:[]}:item;
  case "scope":return text==="GLOBAL"?{...item,scope:"GLOBAL",centerId:null}:
   text==="CENTER"?{...item,scope:"CENTER",centerId:centers[0]?.id??null}:item;
  case "center":return {...item,centerId:centers.find(c=>c.label===text)?.id??null};
  case "required":return {...item,required:Boolean(raw)};
  case "visibility":return {...item,visibility:Array.isArray(raw)?
    raw.filter((v):v is Surface=>VISIBILITY.includes(v as Surface)):item.visibility};
  case "options":return {...item,options:text.split(/[,\n]/).map(x=>x.trim()).filter(Boolean)};
  default:return item;
 }
}
export function validate(item:AttributeDraft,centers:CenterOption[]):string|null {
 if(!item.displayName.trim()||item.displayName.trim().length>120)return "Nhập tên thuộc tính từ 1–120 ký tự.";
 if(!/^[a-z][a-z0-9_]{1,63}$/.test(item.attributeKey))return "Mã thuộc tính dài 2–64 ký tự, bắt đầu bằng chữ thường.";
 if(item.scope==="CENTER"&&(!item.centerId||!centers.some(c=>c.id===item.centerId)))
  return "Chọn Trung tâm hợp lệ khi phạm vi là Center.";
 if(item.visibility.length===0)return "Chọn ít nhất một nơi hiển thị.";
 if(needsOptions(item.valueType)&&(!item.options.length||item.options.length>50||
  new Set(item.options.map(x=>x.normalize("NFKC").toLowerCase())).size!==item.options.length))
  return "Select cần 1–50 lựa chọn duy nhất.";
 return null;
}
