// PAP-2369 · SCH-LEARNING-SPACE — typed native HO module.
import { TddRegistry, type FieldSchema, type ModuleSchema, type ModuleRow, type TableQuery } from "@/lib/workspace-schema";
import { spaceStatuses, type SpacePreview } from "./learning-space-m1-preview";

export const SPACE_READ = "delivery.schedule.manage", SPACE_EDIT = SPACE_READ;
const base={display:true,search:false,filter:false,sort:false,group:false,inlineEdit:false} as const;
const searchable={...base,search:true,filter:true,sort:true};
const choice={...base,filter:true,sort:true,group:true};
const ro={permission:SPACE_READ,readOnly:true} as const;
const rw={permission:SPACE_READ,readOnly:false} as const;
export const spaceFields=[
 {key:"name",label:"Không gian học",type:"text",icon:"Aa",width:230,...rw,required:true,validation:{minLength:1,maxLength:200},capabilities:{...searchable,inlineEdit:true}},
 {key:"code",label:"Mã",type:"text",icon:"Aa",width:130,...rw,required:true,validation:{minLength:1,maxLength:64},capabilities:{...searchable,inlineEdit:true}},
 {key:"center",label:"Center",type:"text",icon:"◉",width:150,...ro,capabilities:{...searchable,group:true}},
 {key:"optimalCapacity",label:"Sức chứa tối ưu",type:"number",icon:"#",width:135,...rw,required:true,validation:{min:1,integer:true},capabilities:{...choice,inlineEdit:true}},
 {key:"hardCapacity",label:"Sức chứa tối đa",type:"number",icon:"#",width:135,...rw,validation:{min:1,integer:true},capabilities:{...choice,inlineEdit:true}},
 {key:"status",label:"Trạng thái",type:"select",icon:"◉",width:130,...rw,required:true,options:spaceStatuses,capabilities:{...choice,inlineEdit:true}},
 {key:"createdAt",label:"Created Time",type:"datetime",icon:"◷",width:185,...ro,capabilities:base},
 {key:"createdBy",label:"Created By",type:"text",icon:"Aa",width:155,...ro,capabilities:base},
 {key:"updatedAt",label:"Last Modified Time",type:"datetime",icon:"◷",width:185,...ro,capabilities:base},
 {key:"updatedBy",label:"Last Modified By",type:"text",icon:"Aa",width:155,...ro,capabilities:base},
 {key:"spaceId",label:"Learning Space ID",type:"id",icon:"#",width:280,...ro,capabilities:base},
 {key:"version",label:"Version",type:"number",icon:"#",width:95,...ro,capabilities:base}
] as const satisfies readonly FieldSchema[];
export type SpaceSchemaFields=typeof spaceFields;
export const directFields=["name","code","optimalCapacity","hardCapacity","status"] as const;
const order=["name","code","center","optimalCapacity","hardCapacity","status","createdAt","createdBy","updatedAt","updatedBy","spaceId"] as const;
export const spaceQuery:TableQuery<SpaceSchemaFields>={search:"",filters:{logic:"AND",rules:[]},sort:null,group:null,order,visible:order.filter(k=>k!=="spaceId"),page:1,pageSize:15};
export const spaceSections=[
 {id:"identity",label:"Thông tin chung",fields:["name","code","center","status","spaceId"]},
 {id:"capacity",label:"Sức chứa",fields:["optimalCapacity","hardCapacity"]},
 {id:"audit",label:"System",fields:["createdAt","createdBy","updatedAt","updatedBy","version"],collapsed:true},
] as const;
export const spaceDefinition={
 version:1,classification:"TDD_DEFAULT",surface:"HO",key:"learningSpaces",label:"Không gian học",group:"Đào tạo",fields:spaceFields,
 capabilities:{read:SPACE_READ,edit:SPACE_EDIT,create:SPACE_EDIT},
 data:{id:"learning-space-m1-unbound",list:async()=>{throw Error("No live Learning Space transport in M1");},detail:async()=>{throw Error("No live Learning Space transport in M1");}},
 table:{identity:{field:"name",pinned:"left",hideable:false,reorderable:false},columns:order.map(field=>({field,visible:field!=="spaceId"})),
 search:{fields:["name","code","center"],normalization:"vi-diacritic-insensitive"},filters:{fields:["name","code","center","optimalCapacity","hardCapacity","status"],mode:"flat",logic:"AND"},
 sort:{fields:["name","code","center","optimalCapacity","hardCapacity","status"],mode:"single",nulls:"last",tieBreak:"record-id"},group:{fields:["center","optimalCapacity","hardCapacity","status"],mode:"single"},
 views:{builtIn:[],saved:{kind:"local-ui"},actions:["add","apply","rename","delete","reorder"]},pagination:{sizes:[8,15,30],defaultSize:15,mode:"local-ui"},
 inlineEdit:{fields:directFields,enabled:true},interaction:{settings:["properties","grouping","filters","quick-views"],quickView:"separate-opener",keyboard:"canonical",undo:"local-ui-only"}},
 drawer:{density:"one-column",sections:spaceSections,actions:[{id:"clear-hard-capacity",label:"Bỏ giới hạn tối đa",capability:"edit"}]},
 detail:{overview:{sections:spaceSections},businessTabs:[{id:"runningClasses",label:"Lớp học",kind:"relation-grid",relatedModule:"runningClasses",source:{adapter:"learning-space-classes-preview",permission:SPACE_READ}}],history:{kind:"unavailable",reason:"Chưa có lịch sử thay đổi khả dụng."}}
} as const satisfies ModuleSchema<SpaceSchemaFields>;
export const spaceRegistry=new TddRegistry();
export const spaceSchema=spaceRegistry.register(spaceDefinition);
export function projectSpace(p:SpacePreview):ModuleRow<SpaceSchemaFields>{return {
 id:p.id,name:p.name,code:p.code,center:p.center,optimalCapacity:p.optimalCapacity,hardCapacity:p.hardCapacity,status:p.status,
 createdAt:p.createdAt,createdBy:p.createdBy??"—",updatedAt:p.updatedAt,updatedBy:p.updatedBy??"—",spaceId:p.id,version:p.version
};}
