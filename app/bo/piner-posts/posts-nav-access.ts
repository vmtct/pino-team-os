/** PAP-2134: navigation requires a successful current-Center Core-backed read. */
import {coreDraftClient} from "./core-draft-client";
export async function canOpenPosts(centerId:string,signal:AbortSignal,fetcher:typeof fetch=fetch){
 if(signal.aborted)return false;
 try{await coreDraftClient(centerId,fetcher).list(signal,undefined,1);return !signal.aborted;}catch{return false;}
}
