// PAP-2337 / PNR-APP-HUB — isolated editorial table metadata and projection.
import {TddRegistry,type AuthorizationContext,type FieldSchema,type ModuleRow,type TableQuery} from "@/lib/workspace-schema";
import type {PostPreview,PostStatus} from "@/app/bo/content/posts/post-preview-contract";
import {diarySamples} from "@/app/bo/content/posts/post-preview-fixture";
const permission="preview.ho.editorial.read";
const searchable={display:true,search:true,filter:true,sort:true,group:false,inlineEdit:false} as const;
const choice={...searchable,group:true} as const;
const displayOnly={display:true,search:false,filter:false,sort:false,group:false,inlineEdit:false} as const;
const base={permission,readOnly:true,icon:"Aa",capabilities:searchable} as const;
const audit={...base,capabilities:displayOnly,width:145} as const;
export const editorialFields=[
 {...base,key:"name",label:"Person",type:"text",width:220},
 {...base,key:"cover",label:"Ảnh bìa",type:"number",icon:"▧",width:86,capabilities:displayOnly},
 {...base,key:"caption",label:"Caption",type:"textarea",width:290},
 {...base,key:"program",label:"Chương trình",type:"text",width:160,capabilities:choice},
 {...base,key:"center",label:"Center",type:"text",width:150,capabilities:choice},
 {...base,key:"status",label:"Trạng thái",type:"select",width:130,capabilities:choice,options:["Nháp","Chờ duyệt","Đã đăng","Đã ẩn"]},
 {...base,key:"diary",label:"Diary",type:"text",width:140},
 {...audit,key:"submittedAt",label:"Submitted Time",type:"datetime",icon:"▦"},
 {...audit,key:"submittedBy",label:"Submitted By",type:"text"},
 {...audit,key:"createdAt",label:"Created Time",type:"datetime",icon:"▦"},
 {...audit,key:"createdBy",label:"Created By",type:"text"},
 {...audit,key:"updatedAt",label:"Last Modified Time",type:"datetime",icon:"▦"},
 {...audit,key:"updatedBy",label:"Last Modified By",type:"text"},
] as const satisfies readonly FieldSchema[];
type F=typeof editorialFields;
const order=editorialFields.map(f=>f.key);
export const baseQuery:TableQuery<F>={search:"",filters:{logic:"AND",rules:[]},sort:null,group:null,order,visible:order,page:1,pageSize:15};
const states:readonly PostStatus[]=["Chờ duyệt","Đã đăng","Đã ẩn","Nháp"];
const sections=[{id:"post",label:"Thông tin bài đăng",fields:["name","caption","program","center","status","diary"]}] as const;
export const registry=new TddRegistry();
export const schema=registry.register({
 version:1,classification:"TDD_DEFAULT",surface:"HO",key:"post-approval",label:"Duyệt bài đăng",group:"Content",
 fields:editorialFields,capabilities:{read:permission},
 data:{id:"local-editorial-presentation",list:async()=>{throw Error("Caller-provided fixture only");},detail:async()=>{throw Error("Caller-provided fixture only");}},
 table:{identity:{field:"name",pinned:"left",hideable:false,reorderable:false},
 columns:order.map(field=>({field,visible:true})),
 search:{fields:["name","caption","program","center","status","diary"],normalization:"vi-diacritic-insensitive"},
 filters:{fields:["name","caption","program","center","status","diary"],mode:"flat",logic:"AND"},
 sort:{fields:["name","caption","program","center","status","diary"],mode:"single",nulls:"last",tieBreak:"record-id"},
 group:{fields:["program","center","status"],mode:"single"},
 views:{builtIn:states.map((status,i)=>({id:"status-"+i,label:status,state:{...baseQuery,filters:{logic:"AND",rules:[{field:"status" as const,op:"eq",value:status}]}}})),saved:{kind:"local-ui"},actions:["add","apply","rename","delete","reorder"]},
 pagination:{sizes:[8,15,30],defaultSize:15,mode:"local-ui"},inlineEdit:{fields:[],enabled:false},
 interaction:{settings:["properties","grouping","filters","quick-views"],quickView:"separate-opener",keyboard:"canonical",undo:"local-ui-only"}},
 drawer:{density:"one-column",sections,actions:[]},
 detail:{overview:{sections},businessTabs:[],history:{kind:"unavailable",reason:"Chỉ có dữ liệu mẫu."}}
});
export const context:AuthorizationContext=Object.freeze({surface:"HO",authorize:(p:string)=>p===permission});
export function projectEditorialRow(post:PostPreview):ModuleRow<F>{
 if(post.fixture!==true||!/^POST-MOCK-\d+$/.test(post.id))throw Error("Synthetic editorial record required");
 return {id:post.id,name:post.person,cover:post.media.length,caption:post.caption,program:post.program,center:post.center,status:post.status,
 diary:post.diaries.map(id=>diarySamples.find(d=>d.id===id)?.label??id).join(" · "),submittedAt:null,submittedBy:null,createdAt:post.createdAt,createdBy:post.createdBy,updatedAt:post.updatedAt,updatedBy:post.updatedBy};
}
