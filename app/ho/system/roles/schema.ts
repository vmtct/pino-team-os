import { TddRegistry, type FieldSchema, type ModuleRow, type TableQuery } from "@/lib/workspace-schema";
import type { ApprovalVerifier } from "@/lib/workspace-schema/registry";
import type { SurfaceDefinition, SurfaceProvider } from "@/lib/workspace-adapters/contracts";
import {roleCreateActions} from "./role-lifecycle-model";

const read = { display:true, search:true, filter:true, sort:true, group:true, inlineEdit:false } as const;
const readOnlyMetadata = {display:true,search:false,filter:false,sort:false,group:false,inlineEdit:false} as const;
export const roleFields = [
  {key:"name",label:"Tên vai trò",type:"text",icon:"Aa",width:280,permission:"access.role.view",readOnly:true,capabilities:read},
  {key:"roleType",label:"Loại",type:"text",icon:"▣",width:110,permission:"access.role.view",readOnly:true,capabilities:read},
  {key:"status",label:"Trạng thái",type:"text",icon:"◉",width:120,permission:"access.role.view",readOnly:true,capabilities:read},
  {key:"permissionCount",label:"Số quyền",type:"number",icon:"≡",width:110,permission:"access.role.view",readOnly:true,capabilities:read},
  {key:"assignmentCount",label:"Số phân công",type:"number",icon:"@",width:135,permission:"access.role.view",readOnly:true,capabilities:read},
  {key:"roleKey",label:"Role Key",type:"text",icon:"⌘",width:180,permission:"access.role.view",readOnly:true,capabilities:read},
  {key:"description",label:"Mô tả",type:"textarea",icon:"Aa",width:220,permission:"access.role.view",readOnly:true,validation:{maxLength:500},capabilities:readOnlyMetadata},
  {key:"createdAt",label:"Created Time",type:"datetime",icon:"◷",width:170,permission:"access.role.view",readOnly:true,capabilities:readOnlyMetadata},
  {key:"createdBy",label:"Created By",type:"text",icon:"@",width:150,permission:"access.role.view",readOnly:true,capabilities:readOnlyMetadata},
  {key:"updatedAt",label:"Last Modified Time",type:"datetime",icon:"◷",width:170,permission:"access.role.view",readOnly:true,capabilities:readOnlyMetadata},
  {key:"updatedBy",label:"Last Modified By",type:"text",icon:"@",width:150,permission:"access.role.view",readOnly:true,capabilities:readOnlyMetadata},
] as const satisfies readonly FieldSchema[];
type F=typeof roleFields;
const sections=[{id:"role-info",label:"Thông tin Role",fields:["name","roleKey","description","roleType","status","permissionCount","assignmentCount"]},{id:"audit",label:"Thông tin hệ thống",fields:["createdAt","createdBy","updatedAt","updatedBy"]}] as const;
export const roleQuery:TableQuery<F> = {
  search:"",filters:{logic:"AND",rules:[]},sort:{field:"name",direction:"asc"},group:null,
  order:["name","roleType","status","permissionCount","assignmentCount","roleKey","description","createdAt","createdBy","updatedAt","updatedBy"],
  visible:["name","roleType","status","permissionCount","assignmentCount","createdAt","createdBy","updatedAt","updatedBy"],
  page:1,pageSize:15,
};
export const roleDefinition = {
 version:1,classification:"TDD_DEFAULT",surface:"HO",key:"roles",label:"Roles",group:"System",
 fields:roleFields,capabilities:{read:"access.role.view",create:"access.role.create"},actions:roleCreateActions,
 table:{
  identity:{field:"name",pinned:"left",hideable:false,reorderable:false},
  columns:[
   {field:"name",visible:true},{field:"roleType",visible:true},{field:"status",visible:true},
   {field:"permissionCount",visible:true},{field:"assignmentCount",visible:true},{field:"roleKey",visible:false},
   {field:"description",visible:false},{field:"createdAt",visible:true},{field:"createdBy",visible:true},{field:"updatedAt",visible:true},{field:"updatedBy",visible:true},
  ],
  search:{fields:["name","roleType","status","roleKey"],normalization:"vi-diacritic-insensitive"},
  filters:{fields:["name","roleType","status","permissionCount","assignmentCount"],mode:"flat",logic:"AND"},
  sort:{fields:["name","roleType","status","permissionCount","assignmentCount"],mode:"single",nulls:"last",tieBreak:"record-id"},
  group:{fields:["roleType","status"],mode:"single"},
  views:{builtIn:[],saved:{kind:"local-ui"},actions:["add","apply","rename","delete","reorder"]},
  pagination:{sizes:[8,15,30],defaultSize:15,mode:"local-ui"},
  inlineEdit:{fields:[],enabled:false},
  interaction:{settings:["properties","grouping","filters","quick-views"],quickView:"separate-opener",keyboard:"canonical",undo:"local-ui-only"},
 },
 drawer:{density:"one-column",sections,actions:[]},
 detail:{overview:{sections},businessTabs:[{
   id:"permissions",label:"Quyền",kind:"approved-extension",
   source:{adapter:"ho-role-edit",permission:"access.role.view"},
   extensionId:"ho.roles.permission-editor",
   approval:{jira:"PAP-1187",owner:"HO Runtime",designAuthority:"Founder",
     files:["app/ho/system/roles/HoRoleEditor.tsx","app/ho/system/roles/HoRolesTdd.tsx"],
     tests:["lib/pap1169-ho-role-edit.test.ts"],reviewBy:"2026-11-30T00:00:00+07:00"},
  }],history:{kind:"unavailable",reason:"Chưa có lịch sử thay đổi Role khả dụng."}},
} as const satisfies SurfaceDefinition<F>;

type Row=ModuleRow<F>;
type DirectoryRole={id:string;roleKey:string;displayName:string;roleType:"system"|"custom";status:"active"|"archived";permissionCount:number;assignmentCount:number;description:string|null;createdAt:string;updatedAt:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function roles(fetcher:typeof fetch,signal:AbortSignal):Promise<readonly Row[]>{
 const response=await fetcher("/api/bo/access/roles",{method:"GET",signal,cache:"no-store"});
 signal.throwIfAborted();
 if(!response.ok)throw Error("Không tải được danh sách Roles.");
 const json:unknown=await response.json();signal.throwIfAborted();
 if(!json||typeof json!=="object"||!("data" in json)||!Array.isArray(json.data))throw Error("Invalid Role directory");
 const rows=json.data as DirectoryRole[];
 if(rows.some(r=>!r||typeof r.id!=="string"||!uuid.test(r.id)||typeof r.displayName!=="string"||typeof r.roleKey!=="string"||
   !["system","custom"].includes(r.roleType)||!["active","archived"].includes(r.status)||
   !Number.isSafeInteger(r.permissionCount)||r.permissionCount<0||!Number.isSafeInteger(r.assignmentCount)||r.assignmentCount<0||
   !(r.description===null||typeof r.description==="string")||
   typeof r.createdAt!=="string"||!Number.isFinite(Date.parse(r.createdAt))||
   typeof r.updatedAt!=="string"||!Number.isFinite(Date.parse(r.updatedAt))))throw Error("Invalid Role record");
 return rows.map(r=>({id:r.id,name:r.displayName,roleType:r.roleType,status:r.status,
   permissionCount:r.permissionCount,assignmentCount:r.assignmentCount,roleKey:r.roleKey,
   description:r.description??"",createdAt:r.createdAt,updatedAt:r.updatedAt,createdBy:"—",updatedBy:"—"}));
}
export const roleProvider:SurfaceProvider<F>={
 pagination:"local-ui",
 async list(_query,scope,fetcher,signal){
   if(scope.surface!=="HO")throw Error("HO only");
   const all=await roles(fetcher,signal);
   return {records:all.map(row=>({row})),total:all.length};
 },
 async detail(id,scope,fetcher,signal){
   if(scope.surface!=="HO")throw Error("HO only");
   const all=await roles(fetcher,signal);
   const row=all.find(r=>r.id===id);
   return row?{row}:null;
 },
};
/** Founder UI approval: PAP-1187 comment #18549 (2026-10-30).
 * Narrow TDD presentation extension, NOT an Access permission or runtime ACL grant. */
export const verifyRolePermissionTabApproval: ApprovalVerifier = (approval,scope) =>
  scope.surface==="HO" && scope.key==="roles" && scope.extensionId==="ho.roles.permission-editor" &&
  approval.jira==="PAP-1187" && approval.owner==="HO Runtime" && approval.designAuthority==="Founder" &&
  approval.files.includes("app/ho/system/roles/HoRoleEditor.tsx") &&
  approval.tests.includes("lib/pap1169-ho-role-edit.test.ts");
const registry=new TddRegistry(verifyRolePermissionTabApproval);
export const roleSchema=registry.register({...roleDefinition,data:{
 id:"ho-role-directory-read",
 list:async(_query:TableQuery<F>,_context,signal)=>{const items=await roles(fetch,signal);return{rows:items,total:items.length};},
 detail:async(id:string,_context,signal)=>(await roles(fetch,signal)).find(r=>r.id===id)??null,
}});
