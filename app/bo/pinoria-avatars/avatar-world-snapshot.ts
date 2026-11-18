/** PAP-2153: one authoritative response, no raw DTO retained in UI state. */
import {parseAvatarWorld,type Scope} from "./avatar-world-contract";
import {parseWorldComposition} from "./avatar-world-composition";
import {projectAvatarWorldPreview} from "./avatar-world-preview";
import type {CoreScene} from "@/app/ho/pinoria/worlds/world-runtime-client";
export function parseAvatarWorldSnapshot(raw:unknown,scope:Scope){
 const state=parseAvatarWorld(raw,scope),composition=parseWorldComposition(raw,scope);
 const previews:Record<string,Record<string,CoreScene>>={};
 for(const i of state.instances)for(const s of i.world.scenes){
  const preview=projectAvatarWorldPreview(raw,scope,i.id,s.id);
  if(preview)(previews[i.id]??={})[s.id]=preview;
 }
 return {state,composition,previews};
}
export type AvatarWorldSnapshot=ReturnType<typeof parseAvatarWorldSnapshot>;
export function scopedWorldPreview(snapshot:AvatarWorldSnapshot,scope:Scope,instanceId:string,sceneId:string){
 const s=snapshot.state;
 if(s.selfId!==scope.selfId||s.centerId!==scope.centerId||s.studentProfileId!==scope.studentProfileId)return null;
 return snapshot.previews[instanceId]?.[sceneId]??null;
}
