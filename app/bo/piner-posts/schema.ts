/** PAP-2126 / PAP-1746 PNR-APP-HUB. BO Posts FE shell, local-review only.
 * Permission below is a local fixture discriminator, NOT a Core grant.
 * No route admission or backend contract until PAP-2118 prototype / revised S0/S1. */
import { TddRegistry, type FieldSchema, type TableQuery, type ModuleSchema } from "@/lib/workspace-schema";
import type { BoField, BoModule } from "@/lib/bo-registration";
export const POST_PREVIEW_READ="local.posts.preview";
const base={display:true,search:false,filter:false,sort:false,group:false,inlineEdit:false} as const;
const searchable={...base,search:true,sort:true};
const filterable={...base,filter:true,sort:true};
export const postFields=[
 {key:"name",label:"Person",type:"text",icon:"Aa",width:220,permission:POST_PREVIEW_READ,readOnly:true,capabilities:searchable},
 {key:"program",label:"Chương trình",type:"select",icon:"▣",width:165,permission:POST_PREVIEW_READ,readOnly:true,options:["PINO Afterschool","MyTime by PINO"],capabilities:filterable},
 {key:"caption",label:"Caption",type:"textarea",icon:"Aa",width:270,permission:POST_PREVIEW_READ,readOnly:true,capabilities:searchable},
 {key:"author",label:"Tác giả",type:"text",icon:"Aa",width:175,permission:POST_PREVIEW_READ,readOnly:true,capabilities:searchable},
 {key:"mediaCount",label:"Media",type:"number",icon:"#",width:100,permission:POST_PREVIEW_READ,readOnly:true,capabilities:filterable},
 {key:"commentCount",label:"Bình luận",type:"number",icon:"#",width:110,permission:POST_PREVIEW_READ,readOnly:true,capabilities:filterable},
 {key:"source",label:"Nguồn",type:"select",icon:"▣",width:150,permission:POST_PREVIEW_READ,readOnly:true,options:["Diary","Upload trực tiếp","Chưa có"],capabilities:filterable},
 {key:"status",label:"Trạng thái",type:"select",icon:"▣",width:170,permission:POST_PREVIEW_READ,readOnly:true,options:["Nháp","Đã đăng riêng tư","Thu hồi"],capabilities:filterable},
 {key:"center",label:"Chi nhánh",type:"text",icon:"Aa",width:170,permission:POST_PREVIEW_READ,readOnly:true,capabilities:base},
 {key:"createdAt",label:"Created Time",type:"datetime",icon:"▦",width:175,permission:POST_PREVIEW_READ,readOnly:true,capabilities:base},
 {key:"createdBy",label:"Created By",type:"text",icon:"Aa",width:170,permission:POST_PREVIEW_READ,readOnly:true,capabilities:base},
 {key:"updatedAt",label:"Last Modified Time",type:"datetime",icon:"▦",width:185,permission:POST_PREVIEW_READ,readOnly:true,capabilities:base},
 {key:"updatedBy",label:"Last Modified By",type:"text",icon:"Aa",width:185,permission:POST_PREVIEW_READ,readOnly:true,capabilities:base},
] as const satisfies readonly FieldSchema[];
export type PostFields=typeof postFields;
const order=postFields.map(f=>f.key);
export const postQuery:TableQuery<PostFields>={search:"",filters:{logic:"AND",rules:[]},sort:null,group:null,order,visible:order,page:1,pageSize:15};
const primary=["name","program","caption","author","status","center","source","mediaCount","commentCount"] as const;
const audit=["createdAt","createdBy","updatedAt","updatedBy"] as const;
const sections=[{id:"overview",label:"Thông tin bài đăng",fields:primary},{id:"system",label:"Thông tin hệ thống",fields:audit}] as const;
export const postDefinition={
 version:1, classification:"TDD_DEFAULT", surface:"BO", key:"piner-posts",label:"Posts",group:"Piner App",fields:postFields,
 capabilities:{read:POST_PREVIEW_READ},
 data:{id:"posts-local-review-only",list:async()=>{throw Error("Authorized Core Post adapter not available");},detail:async()=>{throw Error("Authorized Core Post adapter not available");}},
 table:{
 identity:{field:"name",pinned:"left",hideable:false,reorderable:false},
 columns:order.map(field=>({field,visible:true})),
 search:{fields:["name","caption","author"],normalization:"vi-diacritic-insensitive"},
 filters:{fields:["program","mediaCount","commentCount","source","status"],mode:"flat",logic:"AND"},
 sort:{fields:["name","caption","author","mediaCount","commentCount","source","status"],mode:"single",nulls:"last",tieBreak:"record-id"},
 group:{fields:[],mode:"single"},
 views:{builtIn:[{id:"draft",label:"Nháp",state:{...postQuery,filters:{logic:"AND",rules:[{field:"status",op:"eq",value:"Nháp"}]}}},{id:"published",label:"Đã đăng",state:{...postQuery,filters:{logic:"AND",rules:[{field:"status",op:"eq",value:"Đã đăng riêng tư"}]}}}],saved:{kind:"local-ui"},actions:["add","apply","rename","delete","reorder"]},
 pagination:{sizes:[8,15,30],defaultSize:15,mode:"local-ui"},inlineEdit:{fields:[],enabled:false},
 interaction:{settings:["properties","grouping","filters","quick-views"],quickView:"separate-opener",keyboard:"canonical",undo:"local-ui-only"},
 },
 drawer:{density:"one-column",sections,actions:[]},
 detail:{overview:{sections},businessTabs:[
 {id:"media",label:"Media",kind:"media",fields:["mediaCount"],source:{adapter:"posts-local-content",permission:POST_PREVIEW_READ}},
 {id:"comments",label:"Bình luận",kind:"data-grid",relatedModule:"piner-post-comments",source:{adapter:"posts-local-content",permission:POST_PREVIEW_READ}},
 ],history:{kind:"unavailable",reason:"Chưa kết nối lịch sử Post từ Core."}},
} as const satisfies ModuleSchema<PostFields>;
export const postsRegistry=new TddRegistry();
export const postsSchema=postsRegistry.register(postDefinition);
export const postBoFields:BoField[]=sections.flatMap(section=>section.fields).map(key=>{const f=postFields.find(x=>x.key===key)!;return {key:f.key,label:f.label,type:f.type,icon:f.icon,w:f.width,readonly:true,...("options" in f?{options:[...f.options]}:{})}});
export const postModule:BoModule={label:"Posts",group:"Piner App",fields:postBoFields};
export const canCreateDraft=(person:string,people:readonly string[])=>people.includes(person);
export const canPublish=(caption:string,mediaCount:number)=>caption.trim().length>0&&mediaCount>0;
