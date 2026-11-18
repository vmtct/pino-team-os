/** PAP-2153 — selected-Center preview projection. No media fetching or legacy Character. */
import {parseScene,type CoreScene} from "@/app/ho/pinoria/worlds/world-runtime-client";
import {parseAvatarWorld,type Scope} from "./avatar-world-contract";
export function projectAvatarWorldPreview(raw:unknown,scope:Scope,instanceId:string,sceneId:string):CoreScene|null{
 const state=parseAvatarWorld(raw,scope);
 const instance=state.instances.find(i=>i.id===instanceId);
 if(!instance||instance.status==="REVOKED"||instance.world.status!=="ACTIVE"||!instance.sceneAccess[sceneId])return null;
 const scene=instance.world.scenes.find(s=>s.id===sceneId);
 if(!scene||scene.status!=="ACTIVE")return null;
 // The exact raw instance/scene membership has already been validated by parseAvatarWorld.
 const original=(raw as {instances:{id:string;world:{scenes:{id:string}[]}}[]}).instances.find(i=>i.id===instanceId)?.world.scenes.find(s=>s.id===sceneId);
 const parsed=parseScene(original,instance.world.id);
 if(!Number.isSafeInteger(parsed.canvasWidth)||!Number.isSafeInteger(parsed.canvasHeight)||parsed.canvasWidth<1||parsed.canvasHeight<1)return null;
 if(parsed.layers.some(l=>Math.abs(l.positionX)>50||Math.abs(l.positionY)>50))return null;
 return {...parsed,layers:parsed.layers.filter(l=>l.kind==="CHARACTER"||(l.enabled&&instance.unlockedLayerIds.includes(l.id))).sort((a,b)=>a.zIndex-b.zIndex)};
}
