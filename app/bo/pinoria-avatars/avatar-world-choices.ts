/** PAP-2153: presentation choices only. Core remains authoritative. */
import {buildWorldCommand,type AvatarWorldState,type WorldIntent,type Scope} from "./avatar-world-contract";
export type WorldChoice={label:string;intent:WorldIntent;confirmation:string|null};
export function worldChoices(scope:Scope,state:AvatarWorldState,grants:ReadonlySet<string>,instanceId:string|null):WorldChoice[]{
 if(state.selfId!==scope.selfId||state.centerId!==scope.centerId||state.studentProfileId!==scope.studentProfileId)return [];
 const choices:WorldChoice[]=[];
 function offer(label:string,intent:WorldIntent,confirmation:string|null=null){
  try{buildWorldCommand(state,intent,grants);choices.push({label,intent,confirmation});}catch{/* unavailable, not a grant */}
 }
 if(instanceId===null){
  for(const w of state.grantableWorlds)offer("Cấp World · "+w.displayName,{kind:"grant",worldId:w.id,label:w.displayName},"World mới chưa kích hoạt và các cảnh đang khóa.");
  return choices;
 }
 const i=state.instances.find(x=>x.id===instanceId);
 if(!i||i.status==="REVOKED")return choices;
 if(i.status==="INACTIVE")offer("Đặt LIVE",{kind:"live",instanceId:i.id},"World LIVE trước đó sẽ ngừng kích hoạt.");
 for(const s of i.world.scenes){
  const open=i.sceneAccess[s.id]===true;
  offer((open?"Khóa cảnh · ":"Mở cảnh · ")+s.displayName,{kind:"scene",instanceId:i.id,sceneId:s.id,accessible:!open},open?"Khóa cảnh đồng thời khóa các layer đã mở.":null);
  for(const l of s.layers){
   if(l.kind!=="MEDIA")continue;
   const unlocked=i.unlockedLayerIds.includes(l.id);
   offer((unlocked?"Khóa layer · ":"Mở layer · ")+l.displayName,{kind:"layer",instanceId:i.id,layerId:l.id,unlocked:!unlocked});
  }
 }
 return choices;
}
