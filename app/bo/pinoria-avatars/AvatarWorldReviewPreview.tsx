"use client";
/** PAP-2153 original-reference synthetic geometry; never a live media adapter. */
import {WorldStage} from "@/app/ho/pinoria/worlds/WorldDetailPanels";
import type {BoRecord} from "@/lib/bo-registration";
import type {AvatarWorldState} from "./avatar-world-contract";
export function AvatarWorldReviewPreview({instance}:{instance:AvatarWorldState["instances"][number]}){
 const s=instance.world.scenes.find(s=>s.status==="ACTIVE"&&instance.sceneAccess[s.id]);
 if(!s)return null;
 const scene:BoRecord={id:s.id,name:s.displayName,canvasWidth:960,canvasHeight:540};
 const layers:BoRecord[]=[{id:s.id+"-background",kind:"BACKGROUND",name:"Nền mẫu",enabled:true,z:0},...s.layers.map(l=>({id:l.id,kind:l.kind,name:l.displayName,enabled:l.enabled,x:l.kind==="CHARACTER"?50:instance.world.displayName==="Terravia"?25:75,y:l.kind==="CHARACTER"?70:25,scale:100,z:l.kind==="CHARACTER"?10:20,anchor:"CENTER"}))];
 return <div style={{width:"100%",minWidth:0}} data-world-review-preview><WorldStage scene={scene} layers={layers} avatar="Avatar mẫu" unlocked={instance.unlockedLayerIds}/></div>;
}
