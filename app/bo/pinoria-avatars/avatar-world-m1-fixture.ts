/** PAP-2153 / PNR-WORLD — isolated local M1 review model, no IO. */
import {projectAvatarRow} from "./avatar-dsa-data";
import {buildWorldCommand,parseAvatarWorld,verifyWorldReadback,type AvatarWorldState,type WorldIntent} from "./avatar-world-contract";
import {WORLD_PERMISSIONS} from "./SelfWorldNative";
const id=(n:number)=>"01a194f0-9bd0-7896-89a0-"+n.toString(16).padStart(12,"0");
export const avatarWorldReviewRoute="/bo/pinoria-avatars";
export const avatarWorldReviewScope=Object.freeze({selfId:id(1),centerId:id(2),studentProfileId:id(3)});
const personId=id(4),worldId=id(5),sceneId=id(6),mediaId=id(7),instanceId=id(8);
const at="2026-11-28T00:00:00.000Z";
const scope=avatarWorldReviewScope;
const world={id:worldId,displayName:"World mau",status:"ACTIVE",version:1,scenes:[{id:sceneId,worldId,displayName:"Scene mau",status:"ACTIVE",layers:[{id:sceneId,sceneId,displayName:"Character",kind:"CHARACTER",enabled:true},{id:mediaId,sceneId,displayName:"Media mau",kind:"MEDIA",enabled:true}]}]};
export const avatarWorldReviewRecord=Object.freeze(projectAvatarRow({rowKey:"PERSON:"+personId,displayName:"Avatar mau",nickname:"Piner mau",subjectTypes:["LEARNER"],avatarStatus:"READY",subjectStatus:"ACTIVE",personId,pinoriaSelfId:scope.selfId,studentProfileId:scope.studentProfileId,staffMemberId:null,selfStatus:"ACTIVE",selfVersion:1,loadoutVersion:1,equippedCount:0,ownedCount:0,createdAt:at,updatedAt:at,createdBy:null,updatedBy:null}));
export function assertAvatarWorldReviewLocation(url:URL,origin:string){
 if(url.origin!=="http://desktop-isrdren:8800"||url.pathname!==avatarWorldReviewRoute||origin!=="null"||url.hash||[...url.searchParams.keys()].some(k=>k!=="record")||url.searchParams.getAll("record").length>1||(url.searchParams.has("record")&&url.searchParams.get("record")!==avatarWorldReviewRecord.id))throw Error("Local sandbox only");
}
type RawInstance={id:string;studentProfileId:string;worldId:string;displayLabel:string;status:"INACTIVE"|"LIVE";grantedAt:string;revokedAt:null;version:number;world:typeof world;sceneAccess:Record<string,boolean>;unlockedLayerIds:string[];createdAt:string;updatedAt:string;createdByUser:null;updatedByUser:null};
export function createAvatarWorldReview(){
 let instance:RawInstance|null=null;
 const grants=new Set<string>(WORLD_PERMISSIONS);
 const read=()=>parseAvatarWorld({...scope,capabilities:{grant:true,configure:true,setLive:true},grantableWorlds:instance?[]:[world],instances:instance?[instance]:[],loadout:{selfId:scope.selfId,version:1,ready:true}},scope);
 function confirm(previous:AvatarWorldState,intent:WorldIntent,permissions:ReadonlySet<string>=grants){
  const before=read(),command=buildWorldCommand(previous,intent,permissions),current=buildWorldCommand(before,intent,permissions);
  if(previous.selfId!==scope.selfId||previous.centerId!==scope.centerId||previous.studentProfileId!==scope.studentProfileId||JSON.stringify(command)!==JSON.stringify(current))throw Error("Stale review intent");
  if(command.kind==="grant")instance={id:instanceId,studentProfileId:scope.studentProfileId,worldId,displayLabel:command.label,status:"INACTIVE",grantedAt:at,revokedAt:null,version:1,world,sceneAccess:{[sceneId]:false},unlockedLayerIds:[],createdAt:at,updatedAt:at,createdByUser:null,updatedByUser:null};
  else {
   if(!instance)throw Error("No instance");
   const next={...instance,version:instance.version+1,sceneAccess:{...instance.sceneAccess},unlockedLayerIds:[...instance.unlockedLayerIds]};
   if(command.kind==="live")next.status="LIVE";
   if(command.kind==="scene"){next.sceneAccess[command.sceneId]=command.accessible;if(!command.accessible)next.unlockedLayerIds=[];}
   if(command.kind==="layer")next.unlockedLayerIds=command.unlocked?[...new Set([...next.unlockedLayerIds,command.layerId])]:next.unlockedLayerIds.filter(v=>v!==command.layerId);
   instance=next;
  }
  const fresh=read();verifyWorldReadback(scope,command,{instanceId,version:instance.version},fresh);return fresh;
 }
 return {read,confirm,grants:grants as ReadonlySet<string>};
}
