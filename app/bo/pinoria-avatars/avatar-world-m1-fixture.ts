/** PAP-2153 / PNR-WORLD — original-reference isolated M1 review, no IO. */
import {projectAvatarRow} from "./avatar-dsa-data";
import {buildWorldCommand,parseAvatarWorld,verifyWorldReadback,type AvatarWorldState,type WorldIntent} from "./avatar-world-contract";
import {WORLD_PERMISSIONS,avatarWorldReviewMarker} from "./avatar-world-review-identity";
export {avatarWorldReviewMarker} from "./avatar-world-review-identity";
const id=(n:number)=>"01a194f0-9bd0-7896-89a0-"+n.toString(16).padStart(12,"0");
export const avatarWorldReviewRoute="/bo/pinoria-avatars";
export const avatarWorldReviewScope=Object.freeze({selfId:id(1),centerId:id(2),studentProfileId:id(3)});
const scope=avatarWorldReviewScope,at="2026-11-28T00:00:00.000Z",personId=id(4);
function sample(n:number,name:string,sceneName:string,mediaName:string){
 const wid=id(n),sid=id(n+1);
 return {id:wid,displayName:name,status:"ACTIVE",version:1,scenes:[{id:sid,worldId:wid,displayName:sceneName,status:"ACTIVE",layers:[{id:sid,sceneId:sid,displayName:"Avatar Anchor",kind:"CHARACTER",enabled:true},{id:id(n+2),sceneId:sid,displayName:mediaName,kind:"MEDIA",enabled:true}]}]};
}
const chromia=sample(10,"Chromia","Prism Lighthouse","Ánh sao"),terravia=sample(20,"Terravia","Terravia Garden","Lá mùa thu"),grantSample=sample(30,"World mẫu","Cảnh mẫu","Layer mẫu");
const worlds=[chromia,terravia,grantSample];
export const avatarWorldReviewRecord=Object.freeze(projectAvatarRow({rowKey:"PERSON:"+personId,displayName:"Avatar mẫu",nickname:"Piner mẫu",subjectTypes:["LEARNER"],avatarStatus:"READY",subjectStatus:"ACTIVE",personId,pinoriaSelfId:scope.selfId,studentProfileId:scope.studentProfileId,staffMemberId:null,selfStatus:"ACTIVE",selfVersion:1,loadoutVersion:1,equippedCount:0,ownedCount:0,createdAt:at,updatedAt:at,createdBy:null,updatedBy:null}));
export function assertAvatarWorldReviewLocation(url:URL,origin:string){
 if(url.origin!=="http://desktop-isrdren:8800"||url.pathname!==avatarWorldReviewRoute||origin!=="null"||url.hash||[...url.searchParams.keys()].some(k=>k!=="record")||url.searchParams.getAll("record").length>1||(url.searchParams.has("record")&&url.searchParams.get("record")!==avatarWorldReviewMarker))throw Error("Local sandbox only");
}
type RawInstance={id:string;studentProfileId:string;worldId:string;displayLabel:string;status:"INACTIVE"|"LIVE";grantedAt:string;revokedAt:null;version:number;world:typeof chromia;sceneAccess:Record<string,boolean>;unlockedLayerIds:string[];createdAt:string;updatedAt:string;createdByUser:null;updatedByUser:null};
function seed(w:typeof chromia,status:RawInstance["status"],open=false,label=w.displayName):RawInstance{
 return {id:id(w===chromia?40:w===terravia?41:42),studentProfileId:scope.studentProfileId,worldId:w.id,displayLabel:label,status,grantedAt:at,revokedAt:null,version:1,world:w,sceneAccess:{[w.scenes[0].id]:open},unlockedLayerIds:[],createdAt:at,updatedAt:at,createdByUser:null,updatedByUser:null};
}
export function createAvatarWorldReview(){
 let rows=[seed(chromia,"LIVE",true),seed(terravia,"INACTIVE")];
 const grants=new Set<string>(WORLD_PERMISSIONS);
 const read=()=>parseAvatarWorld({...scope,capabilities:{grant:true,configure:true,setLive:true},grantableWorlds:worlds.filter(w=>!rows.some(r=>r.worldId===w.id)),instances:rows,loadout:{selfId:scope.selfId,version:1,ready:true}},scope);
 function confirm(previous:AvatarWorldState,intent:WorldIntent,permissions:ReadonlySet<string>=grants){
  const before=read(),command=buildWorldCommand(previous,intent,permissions),current=buildWorldCommand(before,intent,permissions);
  if(previous.selfId!==scope.selfId||previous.centerId!==scope.centerId||previous.studentProfileId!==scope.studentProfileId||JSON.stringify(command)!==JSON.stringify(current))throw Error("Stale review intent");
  let instance:RawInstance;
  if(command.kind==="grant"){
   const w=worlds.find(w=>w.id===command.worldId);if(!w)throw Error("Unknown world");
   instance=seed(w,"INACTIVE",false,command.label);rows=[...rows,instance];
  }else{
   const old=rows.find(r=>r.id===command.instanceId);if(!old)throw Error("No instance");
   instance={...old,version:old.version+1,sceneAccess:{...old.sceneAccess},unlockedLayerIds:[...old.unlockedLayerIds]};
   if(command.kind==="live"){instance.status="LIVE";rows=rows.map(r=>r.id!==old.id&&r.status==="LIVE"?{...r,status:"INACTIVE",version:r.version+1}:r);}
   if(command.kind==="scene"){instance.sceneAccess[command.sceneId]=command.accessible;if(!command.accessible)instance.unlockedLayerIds=instance.unlockedLayerIds.filter(l=>!old.world.scenes.find(s=>s.id===command.sceneId)?.layers.some(v=>v.id===l));}
   if(command.kind==="layer")instance.unlockedLayerIds=command.unlocked?[...new Set([...instance.unlockedLayerIds,command.layerId])]:instance.unlockedLayerIds.filter(v=>v!==command.layerId);
   rows=rows.map(r=>r.id===instance.id?instance:r);
  }
  const fresh=read();verifyWorldReadback(scope,command,{instanceId:instance.id,version:instance.version},fresh);return fresh;
 }
 return {read,confirm,grants:grants as ReadonlySet<string>};
}
