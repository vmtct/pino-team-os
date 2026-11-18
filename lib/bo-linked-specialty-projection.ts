/** PAP-1496 / PAP-1491 — canonical Specialty presentation with BO-only read authority. */
import {BoApiError} from "./bo-api-error";
import {parseSpecialtyDetail} from "./ho-specialty-v2-reader";
import {specialtyDefinition,specialtyFields,formatSpecialtyAuditTime,specialtyStatusLabel} from "@/app/ho/learning/specialties/schema";
import {createBoTddAdapter,type SurfaceDefinition,type SurfaceProvider} from "./workspace-adapters";
import {TddRegistry,type ModuleRow} from "./workspace-schema";

const permission="membership.subscription.view";
const fields=Object.freeze(specialtyFields.map(field=>({...field,permission})));
type F=typeof fields;
export type LinkedSpecialtyScope={subscriptionId:string;centerId:string;specialtyId:string;pathProgramId:string;pathLabel:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const denied=()=>new BoApiError(403,"Không có quyền xem Chuyên đề.",null);
const malformed=()=>new BoApiError(502,"Core trả dữ liệu Chuyên đề không hợp lệ.",null);
function validate(scope:LinkedSpecialtyScope){
 if(![scope.subscriptionId,scope.centerId,scope.specialtyId,scope.pathProgramId].every(id=>uuid.test(id))||!scope.pathLabel.trim())throw denied();
}
const route=(scope:LinkedSpecialtyScope)=>"/api/bo/subscriptions/"+encodeURIComponent(scope.subscriptionId)+"/specialties";
async function data(url:string,fetcher:typeof fetch,signal:AbortSignal):Promise<unknown>{
 const response=await fetcher(url,{method:"GET",signal,credentials:"same-origin",cache:"no-store",redirect:"error"});
 signal.throwIfAborted();
 if(!response.ok)throw new BoApiError(response.status,"Không thể tải Chuyên đề.",response.headers.get("x-request-id"));
 const envelope:unknown=await response.json();
 if(!envelope||typeof envelope!=="object"||!("data" in envelope))throw malformed();
 return envelope.data;
}
export async function readLinkedSpecialtyProjection(scope:LinkedSpecialtyScope,fetcher:typeof fetch,signal:AbortSignal){
 validate(scope);signal.throwIfAborted();
 const query="?centerId="+encodeURIComponent(scope.centerId);
 const detail=parseSpecialtyDetail(await data(route(scope)+"/"+encodeURIComponent(scope.specialtyId)+query,fetcher,signal));
 if(!detail||detail.id!==scope.specialtyId||detail.pathProgramId!==scope.pathProgramId||detail.status!=="ACTIVE")throw denied();
 const names=new Map<string,string>();
 if(detail.prerequisiteIds.length){
  const raw=await data(route(scope)+query,fetcher,signal);
  if(!raw||typeof raw!=="object"||!("subject" in raw)||!("catalog" in raw)||!Array.isArray(raw.catalog))throw malformed();
  const sub=raw.subject;
  if(!sub||typeof sub!=="object"||!("id" in sub)||!("centerId" in sub)||!("pathProgramId" in sub)||
    sub.id!==scope.subscriptionId||sub.centerId!==scope.centerId||sub.pathProgramId!==scope.pathProgramId)throw denied();
  for(const item of raw.catalog as unknown[]){
   if(!item||typeof item!=="object"||!("id" in item)||!("name" in item)||!("pathProgramId" in item)||
    typeof item.id!=="string"||!uuid.test(item.id)||typeof item.name!=="string"||!item.name.trim()||item.pathProgramId!==scope.pathProgramId||names.has(item.id))throw malformed();
   names.set(item.id,item.name);
  }
 }
 signal.throwIfAborted();
 const prerequisites=detail.prerequisiteIds.map(id=>{const name=names.get(id);if(!name)throw malformed();return name;});
 const row:ModuleRow<F>={id:detail.id,name:detail.name,path:scope.pathLabel,status:specialtyStatusLabel(detail.status),
  description:detail.description,levelCount:detail.levels.length,prerequisiteView:prerequisites,tagView:detail.tags,
  missionCount:detail.missionCountDistinct,createdTime:formatSpecialtyAuditTime(detail.createdAt),
  createdBy:detail.createdByVerifiedLegalName??"—",lastModifiedTime:formatSpecialtyAuditTime(detail.updatedAt),
  lastModifiedBy:detail.updatedByVerifiedLegalName??"—"};
 return {row,version:String(detail.version),centerId:scope.centerId};
}
// This is a read-only linked record, not a registered BO catalog or HO session.
// Do not admit the HO-only mission editor/history until a scoped read contract exists.
const definition={...specialtyDefinition,surface:"BO",fields,capabilities:{read:permission},
 detail:{overview:specialtyDefinition.detail.overview,businessTabs:[],
 history:{kind:"unavailable",reason:"Lịch sử Chuyên đề không khả dụng trong phạm vi đọc này."}}} as const satisfies SurfaceDefinition<F>;
export function openLinkedSpecialtyAdapter(scope:LinkedSpecialtyScope,signal:AbortSignal,centerSource:"centers"|"workforce/planning/bootstrap"|"delivery/calendar-scope"="centers"){
 validate(scope);
 const provider:SurfaceProvider<F>={pagination:"local-ui",
  list:async()=>{throw denied();},
  detail:async(id,current,fetcher,requestSignal)=>{
   if(id!==scope.specialtyId||current.surface!=="BO"||current.centerId!==scope.centerId)throw denied();
   return readLinkedSpecialtyProjection(scope,fetcher,requestSignal);
  }};
 return createBoTddAdapter({registry:new TddRegistry(),definition,provider,centerId:scope.centerId,centerSource},signal);
}
