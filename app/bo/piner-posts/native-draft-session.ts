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
import {CoreDraftRequestError} from "./core-draft-client";
import {BO_STAGING_HOSTNAME} from "@/lib/host-boundary";
import {collectPagedDirectory} from "@/lib/bo-school-students-state";
import {studentCenterApi} from "@/lib/bo-student-center-api";
import type {StudentChoice} from "./data-port";
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
    const url=new URL(String(input),origin),method=(init?.method??"GET").toUpperCase();
    const media=url.pathname.startsWith("/api/bo/learning/piner-posts/")&&url.pathname.includes("/attachments");
    if(media&&(url.origin!==origin||url.searchParams.getAll("centerId").length!==1||url.searchParams.get("centerId")!==centerId||[...url.searchParams.keys()].some(k=>k!=="centerId")))throw new CoreDraftRequestError(403);
    const permission=media?(method==="GET"?"piner.post.view":"piner.post.edit"):url.pathname==="/api/bo/learners"||method==="POST"?"piner.post.create":method==="PATCH"?"piner.post.edit":"piner.post.view";
    if(!current()||!actor.authorize("piner.post.view")||!actor.authorize(permission))throw new CoreDraftRequestError(403);
    const result=await session.transport(input,init);
    if(result.ok){await session.refresh(requestSignal);if(!current()||!actor.authorize("piner.post.view")||!actor.authorize(permission))throw new CoreDraftRequestError(403);}
    return result;
   }catch(e){
    // Transport/session recheck can fail AFTER a command commits. Never map that
    // to a definitive first-hop HTTP rejection; controller retains receipt.
    if(e instanceof BoApiError&&(e.status===401||e.status===403))session.revoke();
    throw Error("Không thể xác minh phiên truy cập BO.");
   }
  };
  const journal=options.journal??createSessionDraftJournal(window.sessionStorage);
  const controller=createDraftController(actor,current,guardedFetch,undefined,journal);
  const binding=bindNativeDraft(controller,session.context);
  const mediaControllers=new Map<string,ReturnType<typeof createPrivateMediaController>>();
  const canMedia=(write:boolean)=>Boolean(current()&&actor.authorize("piner.post.view")&&(!write||actor.authorize("piner.post.edit")));
  return {...binding,controller,userId:principal.userId,
   canEditMedia:()=>Boolean(current()&&actor.authorize("piner.post.view")&&actor.authorize("piner.post.edit")),
   media:(postId:string)=>{if(!current()||!actor.authorize("piner.post.view"))throw new CoreDraftRequestError(403);return privatePostMediaClient(centerId,postId,guardedFetch);},
   mediaController:(postId:string)=>{if(!canMedia(false))throw new CoreDraftRequestError(403);let media=mediaControllers.get(postId);if(!media){media=createPrivateMediaController(privatePostMediaClient(centerId,postId,guardedFetch),canMedia);mediaControllers.set(postId,media);}return media;},
   async studentChoices(requestSignal:AbortSignal):Promise<readonly StudentChoice[]>{
    if(!binding.canCreate())throw new CoreDraftRequestError(403);
    const rows=await collectPagedDirectory((cursor,limit)=>studentCenterApi.learners("",limit,cursor,centerId,(input,init)=>guardedFetch(input,{...init,signal:requestSignal})),100,100);
    requestSignal.throwIfAborted();
    const active=rows.filter(r=>r.status.toUpperCase()==="ACTIVE");
    const count=new Map<string,number>();for(const row of active){if(!/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(row.id)||!row.displayName.trim())throw Error("Danh bạ học viên không hợp lệ.");const name=row.displayName.trim();count.set(name,(count.get(name)??0)+1);}
    // Distinguish matching names via existing birth year, never display raw IDs.
    // If the result remains ambiguous, resolveStudent denies rather than choosing.
    const choices=active.map(row=>({id:row.id,label:count.get(row.displayName.trim())===1?row.displayName.trim():row.displayName.trim()+(row.birthYear?" · "+row.birthYear:"")}));
    return choices;
   },
   dispose(){for(const media of mediaControllers.values())media.dispose();mediaControllers.clear();binding.unbind();controller.dispose();session.dispose();}
  };
 }catch(e){session.dispose();throw e;}
}
export type NativeDraftSession=Awaited<ReturnType<typeof openNativeDraftSession>>;
