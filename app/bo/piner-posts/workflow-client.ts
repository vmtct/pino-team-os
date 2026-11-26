/** PAP-2386 / PNR-APP-HUB. Unmounted same-origin BO workflow client. */
type Common={postId:string;expectedVersion:number;idempotencyKey:string};
export type WorkflowCommand=Common&({kind:"submit";attachmentIds:readonly string[]}|{kind:"diary-selection";diaryIds:readonly string[]}|{kind:"diary-provenance";attachmentId:string;diaryId:string;evidenceId:string;expectedAttachmentVersion:number;transform:"RAW"|"RETOUCHED"});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function id(v:unknown):string{if(typeof v!=="string"||!uuid.test(v))throw Error("Invalid canonical identifier");return v;}
function version(v:unknown):number{if(typeof v!=="number"||!Number.isSafeInteger(v)||v<1||v>=Number.MAX_SAFE_INTEGER)throw Error("Invalid version");return v;}
function key(v:unknown):string{if(typeof v!=="string"||!/^[A-Za-z0-9_-]{16,128}$/.test(v))throw Error("Invalid command key");return v;}
function ids(v:readonly string[],max:number,min=0){if(!Array.isArray(v)||v.length<min||v.length>max)throw Error("Invalid identifiers");const a=v.map(id);if(new Set(a).size!==a.length)throw Error("Duplicate identifier");return Object.freeze(a);}
function obj(v:unknown):Record<string,unknown>{if(!v||typeof v!=="object"||Array.isArray(v))throw Error("Invalid response");return v as Record<string,unknown>;}
export function snapshotWorkflow(c:WorkflowCommand):WorkflowCommand{
 const common={postId:id(c.postId),expectedVersion:version(c.expectedVersion),idempotencyKey:key(c.idempotencyKey)};
 switch(c.kind){
  case "submit":return Object.freeze({...common,kind:c.kind,attachmentIds:ids(c.attachmentIds,5,1)});
  case "diary-selection":return Object.freeze({...common,kind:c.kind,diaryIds:Object.freeze([...ids(c.diaryIds,20)].sort())});
  case "diary-provenance":if(c.transform!=="RAW"&&c.transform!=="RETOUCHED")throw Error("Invalid transformation");return Object.freeze({...common,kind:c.kind,attachmentId:id(c.attachmentId),diaryId:id(c.diaryId),evidenceId:id(c.evidenceId),expectedAttachmentVersion:version(c.expectedAttachmentVersion),transform:c.transform});
  default:throw Error("Unsupported workflow command");
 }
}
export class PostWorkflowError extends Error{constructor(readonly status:number,readonly uncertain:boolean){super("Post workflow request failed");}}
export function postWorkflowClient(centerId:string,fetcher:typeof fetch=fetch){
 const center=id(centerId);
 return async function execute(command:WorkflowCommand,signal:AbortSignal){
  const c=snapshotWorkflow(command);signal.throwIfAborted();
  const root="/api/bo/learning/piner-posts/"+c.postId,common={expectedVersion:c.expectedVersion};
  const path=c.kind==="diary-provenance"?root+"/attachments/"+c.attachmentId+"/diary-provenance":root+"/"+c.kind;
  const body=c.kind==="submit"?{...common,attachmentIds:c.attachmentIds}:c.kind==="diary-selection"?{...common,diaryIds:c.diaryIds}:{...common,attachmentId:undefined,diaryId:c.diaryId,evidenceId:c.evidenceId,expectedAttachmentVersion:c.expectedAttachmentVersion,transform:c.transform};
  let response:Response;
  try{response=await fetcher(path+"?"+new URLSearchParams({centerId:center}),{method:"POST",headers:{Accept:"application/json","Content-Type":"application/json","Idempotency-Key":c.idempotencyKey},credentials:"same-origin",cache:"no-store",redirect:"error",body:JSON.stringify(body),signal});}catch{throw new PostWorkflowError(0,true);}
  if(!response.ok)throw new PostWorkflowError(response.status,response.status>=500);
  try{
   signal.throwIfAborted();
   const r=obj(obj(await response.json()).data);
   if(r.committedVersion!==c.expectedVersion+1||typeof r.replayed!=="boolean")throw Error("Wrong receipt version");
   if(c.kind==="submit"){const p=obj(r.post);if(p.id!==c.postId||p.centerId!==center||p.status!=="PENDING_APPROVAL"||p.version!==r.committedVersion)throw Error("Wrong Post receipt");}
   if(c.kind==="diary-selection"&&JSON.stringify(r.diaryIds)!==JSON.stringify(c.diaryIds))throw Error("Wrong selection receipt");
   if(c.kind==="diary-provenance"&&r.attachmentId!==c.attachmentId)throw Error("Wrong attachment receipt");
   return {command:c,committedVersion:r.committedVersion as number,replayed:r.replayed};
  }catch{throw new PostWorkflowError(response.status,true);}
 };
}
