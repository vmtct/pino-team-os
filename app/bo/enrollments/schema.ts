/** PAP-2181 / PAP-1100 SCH-ENROLLMENT — read-only recurring schedule projection. */
import { TddRegistry, type FieldSchema, type ModuleSchema, type TableQuery } from "@/lib/workspace-schema";
import type { BoField, BoModule } from "@/lib/bo-registration";
export const READ = "membership.subscription.view";
const base = {display:true,search:false,filter:false,sort:false,group:false,inlineEdit:false} as const;
const lookup = {...base,search:true,sort:true,filter:true} as const;
const date = {...base,sort:true,filter:true} as const;
export const fields = [
 {key:"name",label:"Học viên",type:"text",icon:"Aa",width:210,permission:READ,readOnly:true,capabilities:lookup},
 {key:"subscription",label:"Subscription",type:"text",icon:"Aa",width:160,permission:READ,readOnly:true,capabilities:lookup},
 {key:"runningClass",label:"Lớp",type:"text",icon:"Aa",width:200,permission:READ,readOnly:true,capabilities:lookup},
 {key:"path",label:"Nhánh học",type:"text",icon:"Aa",width:160,permission:READ,readOnly:true,capabilities:lookup},
 {key:"schedule",label:"Lịch học",type:"text",icon:"Aa",width:210,permission:READ,readOnly:true,capabilities:base},
 {key:"start",label:"Từ ngày",type:"date",icon:"▦",width:130,permission:READ,readOnly:true,capabilities:date},
 {key:"end",label:"Đến ngày (loại trừ)",type:"date",icon:"▦",width:170,permission:READ,readOnly:true,capabilities:date},
 {key:"createdAt",label:"Created Time",type:"datetime",icon:"▦",width:175,permission:READ,readOnly:true,capabilities:base},
 {key:"createdBy",label:"Created By",type:"text",icon:"Aa",width:170,permission:READ,readOnly:true,capabilities:base},
 {key:"updatedAt",label:"Last Modified Time",type:"datetime",icon:"▦",width:185,permission:READ,readOnly:true,capabilities:base},
 {key:"updatedBy",label:"Last Modified By",type:"text",icon:"Aa",width:185,permission:READ,readOnly:true,capabilities:base},
] as const satisfies readonly FieldSchema[];
export type EnrollmentFields = typeof fields;
const order = fields.map(f=>f.key);
export const queryDefault:TableQuery<EnrollmentFields> = {search:"",filters:{logic:"AND",rules:[]},sort:null,group:null,order,visible:order,page:1,pageSize:15};
const sections = [
 {id:"relations",label:"Liên kết",fields:["name","subscription","runningClass","path"]},
 {id:"schedule",label:"Lịch học",fields:["schedule","start","end"]},
 {id:"system",label:"Thông tin hệ thống",fields:["createdAt","createdBy","updatedAt","updatedBy"]},
] as const;
export const definition = {
 version:1,classification:"TDD_DEFAULT",surface:"BO",key:"enrollments",label:"Lịch học",group:"School",fields,
 capabilities:{read:READ,history:"access.audit.view"},
 data:{id:"enrollment-directory-unbound",list:async()=>{throw Error("Core adapter not bound");},detail:async()=>{throw Error("Core adapter not bound");}},
 table:{identity:{field:"name",pinned:"left",hideable:false,reorderable:false},columns:order.map(field=>({field,visible:true})),
 search:{fields:["name","subscription","runningClass","path"],normalization:"vi-diacritic-insensitive"},
 filters:{fields:["name","subscription","runningClass","path","start","end"],mode:"flat",logic:"AND"},
 sort:{fields:["name","subscription","runningClass","path","start","end"],mode:"single",nulls:"last",tieBreak:"record-id"},
 group:{fields:[],mode:"single"},views:{builtIn:[],saved:{kind:"local-ui"},actions:["add","apply","rename","delete","reorder"]},
 pagination:{sizes:[8,15,30],defaultSize:15,mode:"local-ui"},inlineEdit:{fields:[],enabled:false},
 interaction:{settings:["properties","grouping","filters","quick-views"],quickView:"separate-opener",keyboard:"canonical",undo:"local-ui-only"}},
 drawer:{density:"one-column",sections,actions:[]},
 detail:{overview:{sections},businessTabs:[],history:{kind:"unavailable",reason:"Chưa có dữ liệu lịch sử."}},
} as const satisfies ModuleSchema<EnrollmentFields>;
export const registry = new TddRegistry();
export const enrollmentSchema = registry.register(definition);
export function canonicalEnrollmentSchema(template:ModuleSchema<EnrollmentFields>,bound:ModuleSchema<EnrollmentFields>){
 const structural=(s:ModuleSchema<EnrollmentFields>)=>JSON.stringify({...s,data:undefined});
 if(structural(template)!==structural(bound))throw Error("Enrollment runtime differs from admitted schema");
 return bound;
}
const boFields:BoField[] = sections.flatMap(s=>s.fields).map(key=>{const f=fields.find(x=>x.key===key)!;return {key:f.key,label:f.label,type:f.type,icon:f.icon,w:f.width,readonly:true};});
export const enrollmentModule:BoModule = {label:"Lịch học",group:"School",fields:boFields};
