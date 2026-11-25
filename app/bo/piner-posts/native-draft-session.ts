/** PAP-2134 / PNR-APP-HUB. Reuse actual Core-backed BO session boundary.
 * Feature remains unmounted until Core, shared route and host admission.
 * No synthetic grants and no raw fetch fallback. */
import {surfaceSession,type CenterSource} from "@/lib/workspace-adapters/session";
import {BoApiError} from "@/lib/bo-api-error";
import {createDraftController,type DraftActorScope} from "./draft-controller";
import {createSessionDraftJournal,type DraftRetryJournal} from "./draft-retry-journal";
import {bindNativeDraft} from "./native-draft-binding";
import {createPrivateMediaController} from "./private-media-controller";
import {privatePostMediaClient} from "./private-media-client";
import {postWorkflowReadClient} from "./workflow-read-client";
import {createWorkflowCoordinator} from "./workflow-coordinator";
import {postWorkflowClient} from "./workflow-client";
import {CoreDraftRequestError} from "./core-draft-client";
import {BO_STAGING_HOSTNAME} from "@/lib/host-boundary";
import type {PersonChoice,PostProgramKey} from "./data-port";
export async function openNativeDraftSession(centerId:string,centerSource:CenterSource,signal:AbortSignal,options:{origin?:string;fetcher?:typeof fetch;journal?:DraftRetryJournal}={}){
 const origin=options.origin??window.location.origin;
 if(new URL(origin).origin!=="https://"+BO_STAGING_HOSTNAME)throw new CoreDraftRequestError(403);
 const session=surfaceSession("BO",origin,options.fetcher,{id:centerId,source:centerSource});
 try{
  const principal=await session.refresh(signal);
  if(!session.context.authorize("piner.post.view"))throw new CoreDraftRequestError(403);
  const actor:DraftActorScope={actorId:principal.userId,centerId,authorize:p=>session.context.authorize(p)};
  const current=()=>session.principal?.userId===principal.userId?actor:null;
  const guardedFetch:typeof fetch=async(input,init)=>{
   const requestSignal=init?.signal??signal;
   try{
    await session.refresh(requestSignal);
    const url=new URL(String(input),origin),method=(init?.method??"GET").toUpperCase(),postsBase="/api/bo/learning/piner-posts";
    const postRoute=url.pathname===postsBase||url.pathname.startsWith(postsBase+"/"),people=url.pathname===postsBase+"/people";
    const media=postRoute&&url.pathname.includes("/attachments");
    const uuid="[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
    const root="^"+postsBase+"/"+uuid+"/";
    const submit=(new RegExp(root+"submit$").test(url.pathname)&&method==="POST")||(new RegExp(root+"submission-state$").test(url.pathname)&&method==="GET");
    const composeWrite=new RegExp(root+"(?:diary-selection|attachments/"+uuid+"/diary-provenance)$").test(url.pathname)&&method==="POST";
    const composeRead=new RegExp(root+"(?:workflow-state|diaries(?:/"+uuid+"/photos(?:/"+uuid+")?)?)$").test(url.pathname)&&method==="GET";
    if(postRoute&&(url.origin!==origin||url.searchParams.getAll("centerId").length!==1||url.searchParams.get("centerId")!==centerId))throw new CoreDraftRequestError(403);
    if(people&&([...url.searchParams.keys()].some(k=>!["centerId","programKey","q","after","limit"].includes(k))||[...new Set(url.searchParams.keys())].some(k=>url.searchParams.getAll(k).length!==1)||!["AFTERSCHOOL","MYTIME"].includes(url.searchParams.get("programKey")??"")))throw new CoreDraftRequestError(403);
    if(media&&[...url.searchParams.keys()].some(k=>k!=="centerId"))throw new CoreDraftRequestError(403);
    const permission=submit?"piner.post.submit":composeWrite||composeRead?"piner.post.diary.compose":media?(method==="GET"?"piner.post.view":"piner.post.edit"):people?"piner.post.create":postRoute?(method==="POST"?"piner.post.create":method==="PATCH"?"piner.post.edit":"piner.post.view"):url.pathname==="/api/bo/learners"||method==="POST"?"piner.post.create":method==="PATCH"?"piner.post.edit":"piner.post.view";
    if(!current()||!actor.authorize("piner.post.view")||!session.context.authorize(permission))throw new CoreDraftRequestError(403);
    const result=await session.transport(input,init);
    if(result.ok){await session.refresh(requestSignal);if(!current()||!actor.authorize("piner.post.view")||!session.context.authorize(permission))throw new CoreDraftRequestError(403);}
    return result;
   }catch(e){
    // Transport/session recheck can fail AFTER a command commits. Never map that
    // to a definitive first-hop HTTP rejection; controller retains receipt.
    if(e instanceof BoApiError&&(e.status===401||e.status===403))session.revoke();
    throw Error("Không thể xác minh phiên truy cập BO.");
   }
  };
  const journal=options.journal??createSessionDraftJournal(window.sessionStorage);
  const draft=createDraftController(actor,current,guardedFetch,undefined,journal);

  const workflowRead=postWorkflowReadClient(centerId,guardedFetch);
  const workflowScope={actorId:principal.userId,centerId,authorize:(p:string)=>session.context.authorize(p)};
  const workflowCurrent=()=>current()?workflowScope:null;
  const workflowCoordinator=createWorkflowCoordinator(workflowScope,workflowCurrent,postWorkflowClient(centerId,guardedFetch),async(receipt,requestSignal)=>{
   const c=receipt.command;
   if(c.kind==="submit"){
    const state=await workflowRead.submissionState(c.postId,requestSignal);
    return state.version===receipt.committedVersion&&state.status==="PENDING_APPROVAL"&&JSON.stringify(state.submittedAttachmentIds)===JSON.stringify(c.attachmentIds);
   }
   const state=await workflowRead.state(c.postId,requestSignal);
   if(state.version!==receipt.committedVersion||state.status!=="DRAFT")return false;
   if(c.kind==="diary-selection")return JSON.stringify([...state.diaryIds].sort())===JSON.stringify(c.diaryIds);
   return state.provenance.some(p=>p.attachmentId===c.attachmentId&&p.diaryId===c.diaryId&&p.evidenceId===c.evidenceId&&p.transform===c.transform&&p.attachmentVersion===c.expectedAttachmentVersion);
  },journal);
  const mediaControllers=new Map<string,ReturnType<typeof createPrivateMediaController>>();
  let active=false;
  async function fenced<T>(kind:"draft"|"workflow"|"media",postId:string|null,requestSignal:AbortSignal,operation:()=>Promise<T>):Promise<T>{
   requestSignal.throwIfAborted();
   if(active)throw Error("Yêu cầu trước chưa hoàn tất.");
   active=true;
   try{
    if(kind!=="draft"&&await draft.hasRetainedCommand(requestSignal))throw Error("Cần xác minh thay đổi Post trước.");
    if(kind!=="workflow"&&await workflowCoordinator.hasPending(requestSignal))throw Error("Cần xác minh yêu cầu Post trước.");
    if([...mediaControllers.entries()].some(([id,media])=>media.hasPending()&&(kind!=="media"||id!==postId)))throw Error("Cần xác minh ảnh trước.");
    requestSignal.throwIfAborted();
    return await operation();
   }finally{active=false;}
  }
  const controller={...draft,
   createDraft:(...args:Parameters<typeof draft.createDraft>)=>fenced("draft",null,args[3],()=>draft.createDraft(...args)),
   editCaption:(...args:Parameters<typeof draft.editCaption>)=>fenced("draft",args[0],args[3],()=>draft.editCaption(...args))
  };
  const workflow={...workflowCoordinator,
   run:(...args:Parameters<typeof workflowCoordinator.run>)=>fenced("workflow",args[0].postId,args[1],()=>workflowCoordinator.run(...args)),
   retry:(...args:Parameters<typeof workflowCoordinator.retry>)=>fenced("workflow",args[0].postId,args[1],()=>workflowCoordinator.retry(...args))
  };
  const binding=bindNativeDraft(controller,session.context);
  const canMedia=(write:boolean)=>Boolean(current()&&actor.authorize("piner.post.view")&&(!write||actor.authorize("piner.post.edit")));
  return {...binding,controller,userId:principal.userId,
   workflowRead,
   workflow,
   canSubmit:()=>Boolean(current()&&session.context.authorize("piner.post.view")&&session.context.authorize("piner.post.submit")),
   canCompose:()=>Boolean(current()&&session.context.authorize("piner.post.view")&&session.context.authorize("piner.post.diary.compose")),
   canEditMedia:()=>Boolean(current()&&actor.authorize("piner.post.view")&&actor.authorize("piner.post.edit")),

   mediaController:(postId:string)=>{
    if(!canMedia(false))throw new CoreDraftRequestError(403);
    let media=mediaControllers.get(postId);
    if(!media){
     const local=createPrivateMediaController(privatePostMediaClient(centerId,postId,guardedFetch),canMedia);
     media={...local,
      upload:(file,requestSignal)=>fenced("media",postId,requestSignal,()=>local.upload(file,requestSignal)),
      remove:(id,requestSignal)=>fenced("media",postId,requestSignal,()=>local.remove(id,requestSignal)),
      retry:requestSignal=>fenced("media",postId,requestSignal,()=>local.retry(requestSignal))
     };
     mediaControllers.set(postId,media);
    }
    return media;
   },
   async personChoices(programKey:PostProgramKey,requestSignal:AbortSignal):Promise<readonly PersonChoice[]>{
    if(!binding.canCreate())throw new CoreDraftRequestError(403);
    const choices=await controller.personChoices(programKey,requestSignal);
    requestSignal.throwIfAborted();
    return choices;
   },
   dispose(){workflow.dispose();for(const media of mediaControllers.values())media.dispose();mediaControllers.clear();binding.unbind();controller.dispose();session.dispose();}
  };
 }catch(e){session.dispose();throw e;}
}
export type NativeDraftSession=Awaited<ReturnType<typeof openNativeDraftSession>>;
