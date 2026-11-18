import test from "node:test";
import assert from "node:assert/strict";
import {projectAvatarWorldPreview} from "./avatar-world-preview";
const id=(n:number)=>"01a194f0-9bd0-7896-89a0-"+n.toString(16).padStart(12,"0");
const scope={selfId:id(1),centerId:id(2),studentProfileId:id(3)};
const asset=(ext:string)=>"pinoria/world/uploads/"+"a".repeat(64)+"."+ext;
const common={sceneId:id(11),displayName:"Layer",version:1,positionX:20,positionY:-10,scale:1.3,metadata:{rotationDegrees:35},enabled:true,posterAssetKey:null};
const character={...common,id:id(11),kind:"CHARACTER",key:"character",mediaType:null,assetKey:null,anchor:"BOTTOM_CENTER",zIndex:2};
const gif={...common,id:id(12),kind:"MEDIA",key:"gif",mediaType:"GIF",assetKey:asset("gif"),anchor:"CENTER",zIndex:1};
const hidden={...gif,id:id(13),key:"locked",zIndex:3};
const scene={id:id(11),worldId:id(10),key:"scene",displayName:"Cảnh",descriptionText:"",status:"ACTIVE",version:1,canvasWidth:1920,canvasHeight:1080,sortOrder:0,baseAssetKey:asset("png"),layers:[character,gif,hidden]};
const world={id:id(10),displayName:"World",version:1,status:"ACTIVE",scenes:[scene]};
const instance={id:id(20),worldId:world.id,studentProfileId:scope.studentProfileId,displayLabel:"QA",status:"INACTIVE",createdAt:"2026-11-18T00:00:00Z",updatedAt:"2026-11-18T00:00:00Z",createdByUser:null,updatedByUser:null,grantedAt:"2026-11-18T00:00:00Z",revokedAt:null,version:1,world,sceneAccess:{[scene.id]:true},unlockedLayerIds:[gif.id]};
const raw={...scope,grantableWorlds:[],instances:[instance],loadout:{selfId:scope.selfId,version:1,ready:true}};
test("preview only accessible canonical geometry and unlocked enabled media, sorted by depth",()=>{
 const p=projectAvatarWorldPreview(raw,scope,instance.id,scene.id);
 assert.ok(p);assert.deepEqual(p.layers.map(l=>l.id),[gif.id,character.id]);assert.equal(p.layers[0]?.rotationDegrees,35);assert.equal(p.layers[0]?.mediaType,"GIF");
});
test("preview denies wrong scope, locked or revoked scene, unsupported asset and disabled media",()=>{
 assert.throws(()=>projectAvatarWorldPreview(raw,{...scope,centerId:id(99)},instance.id,scene.id));
 assert.equal(projectAvatarWorldPreview({...raw,instances:[{...instance,sceneAccess:{[scene.id]:false}}]},scope,instance.id,scene.id),null);
 assert.equal(projectAvatarWorldPreview({...raw,instances:[{...instance,status:"REVOKED",revokedAt:"2026-11-18T01:00:00Z"}]},scope,instance.id,scene.id),null);
 assert.throws(()=>projectAvatarWorldPreview({...raw,instances:[{...instance,world:{...world,scenes:[{...scene,layers:[character,{...gif,assetKey:"https://example.com/a.gif"},hidden]}]}}]},scope,instance.id,scene.id));
 const p=projectAvatarWorldPreview({...raw,instances:[{...instance,world:{...world,scenes:[{...scene,layers:[character,{...gif,enabled:false},hidden]}]}}]},scope,instance.id,scene.id);
 assert.deepEqual(p?.layers.map(l=>l.id),[character.id]);
});
