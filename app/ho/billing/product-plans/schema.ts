// PAP-2183 / PLT-PRODUCT-PLAN. Native typed HO schema; real provider bound separately.
import {TddRegistry,type FieldSchema,type ModuleSchema,type ModuleRow,type TableQuery} from "@/lib/workspace-schema";
export const productPlanBadges = ["ENTRY","HERO","STANDARD"] as const;
export type ProductPlanBadge=typeof productPlanBadges[number];
type ProductPlanProjection={id:string;name:string;cadence:number;termWeeks:number;price:number;currency:"VND";badge:ProductPlanBadge;enabled:boolean;version:number;createdAt:string|null;createdBy:string|null;updatedAt:string|null;updatedBy:string|null};
export const PLAN_READ="billing.view", PLAN_EDIT="billing.manage";
const base={display:true,search:false,filter:false,sort:false,group:false,inlineEdit:false} as const;
const searchable={...base,search:true,filter:true,sort:true} as const;
const choice={...base,filter:true,sort:true,group:true} as const;
const meta={permission:PLAN_READ,readOnly:true} as const;
const writable={permission:PLAN_READ,readOnly:false,required:true} as const;
export const planFields=[
 {key:"name",label:"Gói học",type:"text",icon:"Aa",width:225,...writable,validation:{minLength:1,maxLength:120},capabilities:{...searchable,inlineEdit:true}},
 {key:"cadence",label:"Buổi/tuần",type:"number",icon:"#",width:112,...writable,validation:{min:1,max:6,integer:true},capabilities:{...choice,inlineEdit:true}},
 {key:"termWeeks",label:"Số tuần",type:"number",icon:"#",width:105,...writable,validation:{min:12,max:48,integer:true},capabilities:{...choice,inlineEdit:true}},
 {key:"price",label:"Giá niêm yết",type:"currency",icon:"₫",width:155,...writable,validation:{min:0,max:Number.MAX_SAFE_INTEGER,integer:true},capabilities:{...base,sort:true,inlineEdit:true}},
 {key:"badge",label:"Badge",type:"select",icon:"◉",width:128,...writable,options:productPlanBadges,capabilities:{...choice,inlineEdit:true}},
 {key:"enabled",label:"Đang bán",type:"boolean",icon:"✓",width:105,...writable,capabilities:{...choice,inlineEdit:true}},
 {key:"createdAt",label:"Created Time",type:"datetime",icon:"◷",width:185,...meta,capabilities:base},
 {key:"createdBy",label:"Created By",type:"text",icon:"Aa",width:155,...meta,capabilities:base},
 {key:"updatedAt",label:"Last Modified Time",type:"datetime",icon:"◷",width:185,...meta,capabilities:base},
 {key:"updatedBy",label:"Last Modified By",type:"text",icon:"Aa",width:160,...meta,capabilities:base},
 {key:"planId",label:"Product Plan ID",type:"id",icon:"#",width:280,...meta,capabilities:base},
 {key:"currency",label:"Tiền tệ",type:"text",icon:"Aa",width:95,...meta,capabilities:base},
 {key:"version",label:"Version",type:"number",icon:"#",width:95,...meta,capabilities:base},
] as const satisfies readonly FieldSchema[];
export type PlanFields=typeof planFields;
const order=["name","cadence","termWeeks","price","badge","enabled","createdAt","createdBy","updatedAt","updatedBy","planId"] as const;
export const planQuery:TableQuery<PlanFields>={search:"",filters:{logic:"AND",rules:[]},sort:null,group:null,order,visible:order.filter(k=>k!=="planId"),page:1,pageSize:15};
const sections=[
 {id:"identity",label:"Gói học",fields:["name","cadence","termWeeks","planId"]},
 {id:"commercial",label:"Thương mại",fields:["price","currency","badge","enabled"]},
 {id:"audit",label:"System",fields:["createdAt","createdBy","updatedAt","updatedBy","version"],collapsed:true},
] as const;
export const planDefinition={
 version:1,classification:"TDD_DEFAULT",surface:"HO",key:"productPlans",label:"Gói học",group:"Tài chính",fields:planFields,
 capabilities:{read:PLAN_READ,edit:PLAN_EDIT},
 data:{id:"product-plans-unbound",list:async()=>{throw Error("Unbound Product Plan data");},detail:async()=>{throw Error("Unbound Product Plan data");}},
 table:{identity:{field:"name",pinned:"left",hideable:false,reorderable:false},columns:order.map(field=>({field,visible:field!=="planId"})),
 search:{fields:["name"],normalization:"vi-diacritic-insensitive"},filters:{fields:["name","cadence","termWeeks","badge","enabled"],mode:"flat",logic:"AND"},
 sort:{fields:["name","cadence","termWeeks","price","badge","enabled"],mode:"single",nulls:"last",tieBreak:"record-id"},group:{fields:["cadence","termWeeks","badge","enabled"],mode:"single"},
 views:{builtIn:[],saved:{kind:"local-ui"},actions:["add","apply","rename","delete","reorder"]},pagination:{sizes:[8,15,30],defaultSize:15,mode:"local-ui"},
 inlineEdit:{fields:["name","cadence","termWeeks","price","badge","enabled"],enabled:true},interaction:{settings:["properties","grouping","filters","quick-views"],quickView:"separate-opener",keyboard:"canonical",undo:"local-ui-only"}},
 drawer:{density:"one-column",sections,actions:[]},detail:{overview:{sections},businessTabs:[{id:"subscriptions",label:"Subscription",kind:"relation-grid",relatedModule:"subscriptions",source:{adapter:"product-plan-subscriptions-native",permission:PLAN_READ}}],history:{kind:"unavailable",reason:"Chưa có lịch sử thay đổi khả dụng."}},
} as const satisfies ModuleSchema<PlanFields>;
export const planRegistry=new TddRegistry();
export const planSchema=planRegistry.register(planDefinition);
export function projectPlan(p:ProductPlanProjection):ModuleRow<PlanFields>{
 return {id:p.id,name:p.name,cadence:p.cadence,termWeeks:p.termWeeks,
 price:p.price,badge:p.badge,enabled:p.enabled,createdAt:p.createdAt,createdBy:p.createdBy??"—",updatedAt:p.updatedAt,updatedBy:p.updatedBy??"—",planId:p.id,currency:p.currency,version:p.version};
}
