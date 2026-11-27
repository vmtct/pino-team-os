// PAP-2408 / PLT-ACCESS: isolated local review adapter only. Never imported by live page.
import type {BoAccessRoleDetail} from "@/lib/bo-access-model";
import type {AuthenticatedSurfaceAdapter} from "@/lib/workspace-adapters/contracts";
import type {AdapterLocation,AdapterNavigation} from "@/lib/workspace-adapters/navigation";
import {TddRegistry,type AuthorizationContext} from "@/lib/workspace-schema";
import {parseRoleInlineRequest} from "@/lib/workspace-adapters/ho-inline-command-contract";
import type {RolePresentationTransport} from "./HoRoleEditor";
import {roleDefinition,roleFields,roleProvider,roleQuery,verifyRolePermissionTabApproval} from "./schema";
import {rolePreviewCatalog} from "./role-m1-preview";
import {prepareRoleMetadataEdit} from "./role-metadata-edit";
import {roleCreateInput,canArchiveRole,type RoleCreateInput} from "./role-lifecycle-model";
import type {RoleCreateOutcome} from "./useRoleCreateFlow";

export const ROLE_LOCAL_MARKER="ROLE-MOCK-001";
export const ROLE_LOCAL_ROUTE="/ho/system/roles";
const seedId="00000000-0000-7000-8000-000000000001";
type F=typeof roleFields;
const initialTime="2000-01-01T00:00:00.000Z";
export function createNativeRolePreview(openSeed=false){
 let counter=1,request=0;
 const catalog=rolePreviewCatalog;
 const roles:BoAccessRoleDetail[]=[{id:seedId,roleKey:"demo-role",displayName:"Vai trò mẫu",description:"Dữ liệu mô phỏng · ROLE-MOCK-001",roleType:"custom",status:"active",permissionCount:0,assignmentCount:0,permissionKeys:[],createdAt:initialTime,updatedAt:initialTime}];
 const clone=(r:BoAccessRoleDetail)=>({...r,permissionKeys:[...r.permissionKeys]});
 const version=(r:BoAccessRoleDetail)=>new Date(Date.parse(r.updatedAt)+1000).toISOString();
 const reply=(status:number,data:unknown=null)=>new Response(JSON.stringify({data}),{status,headers:{"content-type":"application/json"}});
 const context:AuthorizationContext={surface:"HO",authorize:key=>["access.role.view","access.role.create","access.role.edit","access.role.archive"].includes(key)};
 // All operations are resolved from memory. Unknown routes, real IDs and invalid shapes fail closed.
 const localFetch:typeof fetch=async(input,init)=>{
  init?.signal?.throwIfAborted();
  if(typeof input!=="string")return reply(400);
  const method=init?.method??"GET";
  if(method==="GET"&&input==="/api/bo/access/roles")return reply(200,roles.map(clone));
  if(method==="GET"&&input==="/api/bo/access/permissions")return reply(200,catalog);
  const readPrefix="/api/bo/access/roles/",writePrefix="/api/ho/system/roles/";
  const read=method==="GET"&&input.startsWith(readPrefix)?roles.find(r=>input===readPrefix+r.id):undefined;
  if(read)return reply(200,clone(read));
  const target=method==="POST"?roles.find(r=>input===writePrefix+r.id+"/update"||input===writePrefix+r.id+"/archive"):undefined;
  if(!target||target.status!=="active"||typeof init?.body!=="string")return reply(404);
  let body:Record<string,unknown>;try{body=JSON.parse(init.body);}catch{return reply(400);}
  if(!body||typeof body!=="object"||Array.isArray(body))return reply(400);
  if(input.endsWith("/archive")){
   if(Object.keys(body).length!==1||body.expectedUpdatedAt!==target.updatedAt||!canArchiveRole(target))return reply(409);
   target.status="archived";target.updatedAt=version(target);return reply(200,clone(target));
  }
  const parsed=parseRoleInlineRequest(body);
  if(parsed){
   if(parsed.id!==target.id||parsed.expectedVersion!==target.updatedAt)return reply(409);
   const command=prepareRoleMetadataEdit(target,parsed.expectedVersion,parsed.patch);
   if(!command)return reply(400);
   target.displayName=command.body.displayName;target.description=command.body.description;
  }else{
   if(Object.keys(body).sort().join(",")!=="description,displayName,expectedUpdatedAt,permissionKeys"||body.expectedUpdatedAt!==target.updatedAt||
    typeof body.displayName!=="string"||!(typeof body.description==="string"||body.description===null)||!Array.isArray(body.permissionKeys)||
    !body.permissionKeys.every(k=>typeof k==="string"&&catalog.some(p=>p.key===k))||new Set(body.permissionKeys).size!==body.permissionKeys.length)return reply(400);
   const normalized=roleCreateInput({roleKey:target.roleKey,displayName:body.displayName,description:body.description??""});
   if(!normalized)return reply(400);
   target.displayName=normalized.displayName;target.description=normalized.description;target.permissionKeys=[...body.permissionKeys] as string[];target.permissionCount=target.permissionKeys.length;
  }
  target.updatedAt=version(target);return reply(200,clone(target));
 };
 const transport:RolePresentationTransport={fetcher:localFetch,idempotencyKey:()=> "local-role-"+(++request),synthetic:true};
 const scope={surface:"HO"} as const;
 const registry=new TddRegistry(verifyRolePermissionTabApproval);
 const schema=registry.register({...roleDefinition,data:{id:"local-role-review",list:async(query,_context,signal)=>{
   const result=await roleProvider.list(query,scope,localFetch,signal);return {rows:result.records.map(r=>r.row),total:result.total};
 },detail:async(id,_context,signal)=>(await roleProvider.detail(id,scope,localFetch,signal))?.row??null}});
 const adapter:AuthenticatedSurfaceAdapter<F>={registry,schema,context,scope,userId:ROLE_LOCAL_MARKER,
   capabilities:{read:true,edit:false,create:false,delete:false,reveal:false,audit:false},
   list:async(query,signal)=>{const result=await roleProvider.list(query,scope,localFetch,signal);return {rows:result.records.map(r=>r.row),total:result.total,versions:Object.fromEntries(result.records.flatMap(r=>r.version?[[r.row.id,r.version]]:[]))};},
   detail:(id,signal)=>roleProvider.detail(id,scope,localFetch,signal),
   views:async()=>({unavailable:[]}),subject:id=>({type:"access_role",id}),history:async()=>({status:"unavailable",reason:"Dữ liệu mô phỏng"}),dispose:()=>{}};
 let location:AdapterLocation<F>={kind:openSeed?"drawer":"table",...(openSeed?{recordId:seedId}:{}),tab:"overview",query:roleQuery};
 const subscribers=new Set<()=>void>();let focus:HTMLElement|null=null;
 const navigation:AdapterNavigation<F>={read:()=>location,change:next=>{if(next.kind!=="table"&&!roles.some(r=>r.id===next.recordId))throw Error("Unknown synthetic role");location=next;subscribers.forEach(fn=>fn());},subscribe:fn=>{subscribers.add(fn);return()=>{subscribers.delete(fn);}},capture:()=>{focus=document.activeElement instanceof HTMLElement?document.activeElement:null;},restore:()=>{if(focus?.isConnected)focus.focus();}};
 async function submitCreate(input:RoleCreateInput):Promise<RoleCreateOutcome>{
  const expected=roleCreateInput({roleKey:input.roleKey,displayName:input.displayName,description:input.description??""});
  if(!expected||input.permissionKeys.length||roles.some(r=>r.roleKey===input.roleKey)||input.roleKey==="staff")return {state:"conflict"};
  const id="00000000-0000-7000-8000-"+String(++counter).padStart(12,"0");
  const role:BoAccessRoleDetail={...expected,id,roleType:"custom",status:"active",permissionCount:0,assignmentCount:0,createdAt:initialTime,updatedAt:initialTime};
  roles.push(role);return {state:"verified",receipt:clone(role)};
 }
 return {ready:{adapter,navigation},transport,submitCreate};
}
