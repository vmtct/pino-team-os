"use client";
/** PAP-2153: canonical WorldStage with scoped Avatar projection, not fixture Character. */
import {useCallback} from "react";
import {SelfLoadoutPreview} from "@/app/components/pinoria/SelfLoadoutPreview";
import {scopedWorldPreview,type AvatarWorldSnapshot} from "./avatar-world-snapshot";
import {WorldStage} from "@/app/ho/pinoria/worlds/WorldDetailPanels";
import type {BoRecord} from "@/lib/bo-registration";
import type {Scope} from "./avatar-world-contract";
export function SelfWorldPreview({snapshot,scope,instanceId,sceneId}:{snapshot:AvatarWorldSnapshot;scope:Scope;instanceId:string;sceneId:string}){
 const scene=scopedWorldPreview(snapshot,scope,instanceId,sceneId),model=snapshot.composition;
 const mediaSrc=useCallback((slot:string)=>"/api/bo/pinoria/selfs/"+scope.selfId+"/loadout/media/"+slot+"?centerId="+encodeURIComponent(scope.centerId),[scope.selfId,scope.centerId]);
 const setMemberSrc=useCallback((index:number)=>"/api/bo/pinoria/selfs/"+scope.selfId+"/set/media/"+index+"?centerId="+encodeURIComponent(scope.centerId),[scope.selfId,scope.centerId]);
 if(!scene||!model)return <p role="status">Cảnh chưa khả dụng.</p>;
 const record:BoRecord={id:scene.id,name:scene.displayName,canvasWidth:scene.canvasWidth,canvasHeight:scene.canvasHeight};
 const layers:BoRecord[]=[{id:"background:"+scene.id,name:"Background",kind:"BACKGROUND",assetKey:scene.baseAssetKey,z:0,enabled:true},...scene.layers.map((l,index)=>({id:l.id,name:l.displayName,kind:l.kind,mediaType:l.mediaType,assetKey:l.assetKey,posterAssetKey:l.posterAssetKey,x:50+l.positionX,y:50+l.positionY,scale:100*l.scale,rotation:l.rotationDegrees,anchor:l.anchor,z:index+1,enabled:l.enabled}))];
 return <WorldStage scene={record} layers={layers} avatarNode={<SelfLoadoutPreview key={[scope.selfId,scope.centerId,model.loadout.version,model.setVersion,model.selfVersion].join(":")} embedded loadout={model.loadout} activeSet={model.activeSet} mediaSrc={mediaSrc} setMemberSrc={setMemberSrc}/>} runtimeOnly/>;
}
