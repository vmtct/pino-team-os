/** PAP-2386 / PNR-APP-HUB. Exact PAP-2390 Core read DTO; no route activation. */
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function id(v:unknown):string{if(typeof v!=="string"||!uuid.test(v))throw Error("Invalid identifier");return v;}
function obj(v:unknown):Record<string,unknown>{if(!v||typeof v!=="object"||Array.isArray(v))throw Error("Invalid readback");return v as Record<string,unknown>;}
function version(v:unknown):number{if(typeof v!=="number"||!Number.isSafeInteger(v)||v<1)throw Error("Invalid version");return v;}
function array(v:unknown,max:number):unknown[]{if(!Array.isArray(v)||v.length>max)throw Error("Invalid list");return v;}
function unique(v:string[]){if(new Set(v).size!==v.length)throw Error("Duplicate identity");return v;}
function claim(v:unknown){if(v!=="AVAILABLE"&&v!=="SELECTED"&&v!=="USED")throw Error("Invalid claim");return v;}
function time(v:unknown){if(typeof v!=="string"||!Number.isFinite(Date.parse(v)))throw Error("Invalid timestamp");return v;}
function photo(v:unknown,diaryId:string){const p=obj(v);if(p.diaryId!==diaryId||!["image/png","image/jpeg","image/webp"].includes(String(p.mimeType))||typeof p.byteSize!=="number"||!Number.isSafeInteger(p.byteSize)||p.byteSize<1||p.byteSize>2*1024*1024)throw Error("Invalid photo");return {id:id(p.id),diaryId,mimeType:p.mimeType as string,byteSize:p.byteSize,confirmedAt:time(p.confirmedAt)};}
export function postWorkflowReadClient(centerId:string,fetcher:typeof fetch=fetch){
 const center=id(centerId);
 async function get(postId:string,tail:string,signal:AbortSignal,query?:{after?:string;limit?:number}){
  const params=new URLSearchParams({centerId:center});
  if(query?.after!==undefined)params.set("after",id(query.after));
  if(query?.limit!==undefined){if(!Number.isSafeInteger(query.limit)||query.limit<1||query.limit>10)throw Error("Invalid page");params.set("limit",String(query.limit));}
  signal.throwIfAborted();
  const r=await fetcher("/api/bo/learning/piner-posts/"+id(postId)+"/"+tail+"?"+params,{method:"GET",credentials:"same-origin",cache:"no-store",redirect:"error",headers:{Accept:"application/json"},signal});
  if(!r.ok)throw Error("Post readback unavailable");
  const data=obj(obj(await r.json()).data);signal.throwIfAborted();return data;
 }
 function scoped(d:Record<string,unknown>,postId:string){if(d.postId!==postId||d.centerId!==center)throw Error("Wrong readback scope");return version(d.version);}
 return {
  async state(postId:string,signal:AbortSignal){
   const d=await get(postId,"workflow-state",signal),v=scoped(d,postId);
   if(d.status!=="DRAFT"&&d.status!=="PENDING_APPROVAL")throw Error("Invalid Post state");
   const diaryIds=unique(array(d.diaryIds,20).map(id));
   const provenance=array(d.provenance,5).map(x=>{const p=obj(x),diaryId=id(p.diaryId);if(!diaryIds.includes(diaryId)||(p.transform!=="RAW"&&p.transform!=="RETOUCHED"))throw Error("Invalid provenance");return {attachmentId:id(p.attachmentId),diaryId,evidenceId:id(p.evidenceId),transform:p.transform,attachmentVersion:version(p.attachmentVersion)};});
   unique(provenance.map(p=>p.attachmentId));
   const submittedAttachmentIds=d.status==="DRAFT"?(d.submittedAttachmentIds===null?null:undefined):unique(array(d.submittedAttachmentIds,5).map(id));
   if(submittedAttachmentIds===undefined||submittedAttachmentIds?.length===0||submittedAttachmentIds&&provenance.some(p=>!submittedAttachmentIds.includes(p.attachmentId)))throw Error("Invalid submitted order");
   return {postId,centerId:center,version:v,status:d.status,diaryIds,provenance,submittedAttachmentIds};
  },
  async discover(postId:string,signal:AbortSignal,query?:{after?:string;limit?:number}){
   const d=await get(postId,"diaries",signal,query),v=scoped(d,postId);
   const diaries=array(d.diaries,query?.limit??10).map(x=>{const r=obj(x);return {diaryId:id(r.diaryId),registeredAt:time(r.registeredAt),pathId:id(r.pathId),runningClassId:r.runningClassId===null?null:id(r.runningClassId),claimState:claim(r.claimState)};});
   unique(diaries.map(r=>r.diaryId));
   const nextAfter=d.nextAfter===null?null:id(d.nextAfter);
   if(nextAfter!==null&&diaries[diaries.length-1]?.diaryId!==nextAfter)throw Error("Invalid cursor");
   return {postId,centerId:center,version:v,diaries,nextAfter};
  },
  async photos(postId:string,diaryId:string,signal:AbortSignal){
   const d=await get(postId,"diaries/"+id(diaryId)+"/photos",signal),v=scoped(d,postId);
   if(d.diaryId!==diaryId)throw Error("Wrong Diary");
   const photos=array(d.photos,100).map(x=>photo(x,diaryId));unique(photos.map(p=>p.id));
   return {postId,centerId:center,version:v,diaryId,claimState:claim(d.claimState),photos};
  },
  async photo(postId:string,diaryId:string,evidenceId:string,signal:AbortSignal){
   const d=await get(postId,"diaries/"+id(diaryId)+"/photos/"+id(evidenceId),signal),p=photo(d,diaryId);
   if(p.id!==evidenceId||typeof d.base64!=="string"||d.base64.length!==4*Math.ceil(p.byteSize/3)||!/^[A-Za-z0-9+/]+={0,2}$/.test(d.base64)||atob(d.base64).length!==p.byteSize)throw Error("Invalid media bytes");
   return {...p,base64:d.base64};
  }
 };
}
