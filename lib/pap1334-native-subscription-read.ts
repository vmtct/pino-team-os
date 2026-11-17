/** PAP-1334 / PAP-1491 SPEC-UNLOCK — exclusively Center-scoped BO read model.
 * Do not reuse legacy learners, lifecycle, generic by-ID or Sale/renewal writers.
 */
import {BoApiError} from "./bo-api-error";
import type {BoLearnerSubscription,BoSubscriptionDirectoryItem,BoSubscriptionDirectoryPage} from "./bo-model";
import type {BoModule,BoRecord} from "./bo-registration";
import {recoverInvalidStaffPasswordSession} from "./staff-session-recovery";

export type OwnedSubscriptionItem=BoSubscriptionDirectoryItem & {centerId:string};
export type OwnedSubscriptionPage=Omit<BoSubscriptionDirectoryPage,"items"> & {items:OwnedSubscriptionItem[]};

export const subscriptionUuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Cursor={createdAt:string;id:string};
const PAGE_SIZE=50;
const MAX_PAGES=20;

export const nativeSubscriptionModule:BoModule={
  label:"Gói học",group:"School",
  fields:[
    {key:"name",label:"Học viên",type:"text",icon:"Aa",w:220},
    {key:"path",label:"Hành trình",type:"text",icon:"▦",w:195},
    {key:"status",label:"Trạng thái",type:"select",icon:"▣",w:125},
    {key:"start",label:"Ngày bắt đầu",type:"date",icon:"▦",w:148},
    {key:"end",label:"Ngày kết thúc",type:"date",icon:"▦",w:148},
    {key:"weeklyCommitment",label:"Buổi / tuần",type:"number",icon:"#",w:118},
    {key:"effectiveAvailableUnits",label:"Buổi còn",type:"number",icon:"#",w:112},
    {key:"commercialReference",label:"Tham chiếu",type:"text",icon:"Aa",w:210},
    {key:"createdAt",label:"Ngày tạo",type:"datetime",icon:"▦",w:170},
    {key:"updatedAt",label:"Cập nhật cuối",type:"datetime",icon:"▦",w:170},
    {key:"createdBy",label:"Người tạo",type:"text",icon:"Aa",w:150,defaultVisible:false},
    {key:"updatedBy",label:"Người cập nhật",type:"text",icon:"Aa",w:150,defaultVisible:false},
  ],
};

export function centerDirectoryUrl(centerId:string,cursor?:Cursor):string {
  if(!subscriptionUuid.test(centerId))throw new RangeError("Cơ sở không hợp lệ");
  const query=new URLSearchParams({centerId,limit:String(PAGE_SIZE)});
  if(cursor){
    if(!subscriptionUuid.test(cursor.id)||!cursor.createdAt)throw new RangeError("Invalid Subscription cursor");
    query.set("beforeCreatedAt",cursor.createdAt);
    query.set("beforeSubscriptionId",cursor.id);
  }
  return "/api/bo/subscriptions/center-directory?"+query;
}

export function subscriptionRecord(row:OwnedSubscriptionItem):BoRecord {
  if(!subscriptionUuid.test(row.id)||!subscriptionUuid.test(row.studentProfileId)||
     !subscriptionUuid.test(row.pathProgramId)||!subscriptionUuid.test(row.centerId)||
     typeof row.studentDisplayName!=="string"||!row.studentDisplayName.trim()||
     typeof row.pathDisplayName!=="string"||!row.pathDisplayName.trim()||
     typeof row.lifecycle!=="string")
    throw new Error("Core returned an invalid Subscription identity");
  return {
    id:row.id,name:row.studentDisplayName,
    path:row.pathDisplayName,status:row.lifecycle,start:row.serviceStartsOn||"",
    end:row.contractualEndsOn||"",weeklyCommitment:row.weeklyCommitment,
    effectiveAvailableUnits:row.effectiveAvailableUnits,
    commercialReference:row.commercialReference||"",studentProfileId:row.studentProfileId,
    pathProgramId:row.pathProgramId,createdAt:row.createdAt||"",
    updatedAt:row.updatedAt||"",createdBy:"—",updatedBy:"—",
  };
}

export function assertCenterDetail(
  value:BoLearnerSubscription,subscriptionId:string,centerId:string,
  directoryItem?:OwnedSubscriptionItem,
):BoLearnerSubscription & {centerId:string} {
  // Directory currently omits centerId. The authoritative by-ID Core route
  // MUST attest immutable owning Center before Drawer/Detail is displayed.
  const row=value as BoLearnerSubscription & {centerId?:unknown};
  if(!row||row.id!==subscriptionId||row.centerId!==centerId||
    !subscriptionUuid.test(row.studentProfileId)||!subscriptionUuid.test(row.pathProgramId)||
    directoryItem && (directoryItem.centerId!==centerId||
      row.studentProfileId!==directoryItem.studentProfileId||
      row.pathProgramId!==directoryItem.pathProgramId))
    throw new Error("Subscription response does not match selected Center");
  return row as BoLearnerSubscription & {centerId:string};
}

export async function loadCenterSubscriptionDirectory(
  centerId:string,signal:AbortSignal,transport:typeof fetch=fetch,
):Promise<OwnedSubscriptionItem[]> {
  if(!subscriptionUuid.test(centerId))throw new RangeError("Cơ sở không hợp lệ");
  const all:OwnedSubscriptionItem[]=[];
  const seen=new Set<string>();
  let cursor:Cursor|undefined;
  let expectedTotal:number|undefined;
  for(let i=0;i<MAX_PAGES;i++){
    if(signal.aborted)throw new Error("Center changed");
    const response=await transport(centerDirectoryUrl(centerId,cursor),{
      method:"GET",cache:"no-store",signal,
    });
    if(signal.aborted)throw new Error("Center changed during Subscription read");
    const raw=await response.text();
    if(signal.aborted)throw new Error("Center changed during Subscription read");
    let payload:{data?:OwnedSubscriptionPage;error?:{message?:string;requestId?:string}};
    try{payload=JSON.parse(raw) as typeof payload;}catch{
      throw new BoApiError(response.status,"Subscription directory response invalid",
        response.headers.get("x-request-id"),false);
    }
    if(!response.ok||!payload.data){
      if(response.status===401&&typeof window!=="undefined")void recoverInvalidStaffPasswordSession();
      throw new BoApiError(response.status,payload.error?.message||"Không thể tải gói học theo cơ sở.",
        response.headers.get("x-request-id")??payload.error?.requestId??null,Boolean(payload.error?.message));
    }
    const page=payload.data;
    if(!Array.isArray(page.items)||!Number.isSafeInteger(page.total)||page.total<0||
       !Number.isSafeInteger(page.limit)||page.limit>PAGE_SIZE||page.limit<1)
      throw new Error("Invalid scoped Subscription directory page");
    if(expectedTotal===undefined)expectedTotal=page.total;
    if(page.total!==expectedTotal)throw new Error("Subscription directory changed during paging");
    for(const item of page.items){
      if(item.centerId!==centerId)throw new Error("Subscription row is outside selected Center");
      subscriptionRecord(item); // validate identity before presentation
      if(seen.has(item.id))throw new Error("Duplicate Subscription in Center directory");
      seen.add(item.id);all.push(item);
    }
    if(page.nextCursor===null){
      if(all.length!==expectedTotal)throw new Error("Incomplete Center Subscription directory");
      return all;
    }
    if(!page.nextCursor||!subscriptionUuid.test(page.nextCursor.id)||
       typeof page.nextCursor.createdAt!=="string"||!page.nextCursor.createdAt||
       !page.items.length||all.length>=expectedTotal)
      throw new Error("Invalid Subscription directory cursor");
    cursor=page.nextCursor;
  }
  throw new Error("Subscription directory exceeded safe page limit");
}
