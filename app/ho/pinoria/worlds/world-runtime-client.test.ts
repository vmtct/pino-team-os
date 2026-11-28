import test from "node:test";
import assert from "node:assert/strict";
import {fetchWorldCatalog,saveScene,toUiGeometry,toCoreGeometry,sceneSaveBody,createScene,patchWorld,activateWorld,uploadSceneMedia,type SceneDraftLayer} from "./world-runtime-client";
const id=(n:number)=>"019a0000-0000-7000-8000-"+String(n).padStart(12,"0");
const [wid,sid,mid,newId]=[1,2,3,4].map(id),asset="pinoria/world/uploads/"+"a".repeat(64);
const character={id:sid,key:"character",displayName:"Character",kind:"CHARACTER",version:1,mediaType:null,assetKey:null,posterAssetKey:null,positionX:0,positionY:26,scale:1,zIndex:10,anchor:"BOTTOM_CENTER",enabled:true,metadata:{}};
const media={id:mid,key:"star",displayName:"Star",kind:"MEDIA",version:1,mediaType:"GIF",assetKey:asset+".gif",posterAssetKey:null,positionX:-20,positionY:10,scale:1.5,zIndex:20,anchor:"CENTER",enabled:true,metadata:{rotationDegrees:25}};
const scene={id:sid,worldId:wid,key:"scene",displayName:"Scene",descriptionText:"",version:2,canvasWidth:1920,canvasHeight:1080,baseAssetKey:asset+".png",sortOrder:0,status:"ACTIVE",layers:[character,media]};
const w={id:wid,key:"world",displayName:"World",descriptionText:"",version:3,worldType:"CORE",status:"DRAFT",scenes:[scene]};
const geo={x:70,y:40,scale:130,rotation:35},draft:SceneDraftLayer[]=[{kind:"MEDIA",id:null,key:"new",displayName:"New",mediaType:"GIF",assetKey:asset+".gif",posterAssetKey:null,enabled:true,...geo},{kind:"CHARACTER",id:sid,...geo}];
function mock(reply:unknown,fresh:unknown,status=200){
 const calls:{url:string;init?:RequestInit}[]=[];
 const fetcher:typeof fetch=async(url,init)=>{calls.push({url:String(url),init});return Response.json({data:init?.method==="GET"?fresh:reply},{status:init?.method==="GET"?200:status})};
 return{calls,fetcher}
}
test("catalog preserves canonical identity, version and percentage offset; reject fake or duplicate character",async()=>{
 const {fetcher}=mock(null,{worlds:[w]});const [world]=await fetchWorldCatalog(fetcher);const s=world!.scenes[0]!;
 assert.deepEqual(toUiGeometry(s.layers[1]!),{x:30,y:60,scale:150,rotation:25});
 assert.deepEqual(toCoreGeometry(geo),{positionX:20,positionY:-10,scale:1.3,rotationDegrees:35});
 for(const layers of [[media],[character,character],[{...character,anchor:"CENTER"}]])await assert.rejects(()=>fetchWorldCatalog(mock(null,{worlds:[{...w,scenes:[{...scene,layers}]}]}).fetcher));
});
test("save sends all prior versions and ordered typed geometry, confirms returned IDs and readback",async()=>{
 const [world]=await fetchWorldCatalog(mock(null,{worlds:[w]}).fetcher);const s=world!.scenes[0]!;
 const body=sceneSaveBody(s,draft);assert.deepEqual(body.expectedLayers,[{id:sid,version:1},{id:mid,version:1}]);
 const saved={...scene,version:3,layers:[{...character,version:2,zIndex:1,positionX:20,positionY:-10,scale:1.3,metadata:{rotationDegrees:35}},{...media,id:newId,key:"new",displayName:"New",zIndex:2,positionX:20,positionY:-10,scale:1.3,metadata:{rotationDegrees:35}}]};
 const receipt={sceneId:sid,version:3,layerIds:[newId,sid]},fresh={worlds:[{...w,scenes:[saved]}]};
 const {calls,fetcher}=mock(receipt,fresh);assert.equal((await saveScene(s,draft,"qa-save",fetcher)).scenes[0]!.version,3);
 assert.deepEqual(calls.map(c=>c.init?.method),["PUT","GET"]);assert.equal(calls[0]!.url,"/api/ho/pinoria/worlds/scenes/"+sid+"/save");assert.equal(new Headers(calls[0]!.init?.headers).get("idempotency-key"),"qa-save");
 assert.equal(calls[0]!.init?.body,JSON.stringify(body));
 for(const bad of [{...saved,version:2},{...saved,layers:[{...saved.layers[0],zIndex:3},saved.layers[1]]},{...saved,layers:[saved.layers[0],{...saved.layers[1],metadata:{rotationDegrees:99}}]}])await assert.rejects(()=>saveScene(s,draft,"qa-save",mock(receipt,{worlds:[{...w,scenes:[bad]}]}).fetcher));
 const denied=mock({},fresh,409);await assert.rejects(()=>saveScene(s,draft,"qa-save",denied.fetcher));assert.equal(denied.calls.length,1);
});
test("scene create and metadata require real catalog readback",async()=>{
 const body={expectedWorldVersion:3,key:"scene",displayName:"Scene",canvasWidth:1920,canvasHeight:1080,baseAssetKey:asset+".png"};
 const m=mock(scene,{worlds:[w]},201);await createScene(wid,body,"qa-create",m.fetcher);assert.deepEqual(m.calls.map(c=>c.init?.method),["POST","GET"]);
 const updated={...w,version:4,displayName:"New"};await patchWorld(wid,{expectedVersion:3,displayName:"New"},mock(updated,{worlds:[updated]}).fetcher);
 await assert.rejects(()=>patchWorld(wid,{expectedVersion:3,displayName:"New"},mock(updated,{worlds:[w]}).fetcher));
});
test("upload exact bytes typed form and bounded response; no auto retry",async()=>{
 const file=new File([new Uint8Array([1,2,3])],"motion.gif",{type:"image/gif"}),m=mock({objectKey:asset+".gif",mediaType:"GIF",byteSize:3},null,201);
 assert.equal((await uploadSceneMedia(file,"qa-upload",m.fetcher)).objectKey,asset+".gif");assert.equal(m.calls[0]!.url,"/api/ho/pinoria/worlds/media");assert.ok(m.calls[0]!.init?.body instanceof FormData);
 await assert.rejects(()=>uploadSceneMedia(file,"qa-upload",mock({objectKey:asset+".png",mediaType:"GIF",byteSize:3},null,201).fetcher));
});
import {fetchWorldHistory} from "./world-runtime-client";
test("PAP-2165 strict redacted scoped history response",async()=>{
 const event={id:id(8),occurredAt:"2026-11-18T10:00:00Z",action:"PINORIA_WORLD_SCENE_SAVED",subjectType:"pinoria_world_scene",actorName:null};
 const m=mock(null,{events:[event],truncated:false});assert.deepEqual(await fetchWorldHistory(wid,m.fetcher),{events:[{id:event.id,occurredAt:event.occurredAt,label:"Lưu cảnh",actorName:null}],truncated:false});
 assert.equal(m.calls[0]!.url,"/api/ho/pinoria/worlds/"+wid+"/history");
 for(const bad of [{...event,actorId:id(9)},{...event,action:"PINORIA_WORLD_INSTANCE_GRANTED"},{...event,subjectType:"pinoria_world"},{...event,occurredAt:"n/a"}])await assert.rejects(()=>fetchWorldHistory(wid,mock(null,{events:[bad],truncated:false}).fetcher));
});

test("PAP-2143 activate only current draft with active scene; exact status-only PATCH and readback",async()=>{
 const [draftWorld]=await fetchWorldCatalog(mock(null,{worlds:[w]}).fetcher);
 const active={...w,status:"ACTIVE",version:4};
 const m=mock(active,{worlds:[active]});
 assert.equal((await activateWorld(draftWorld!,m.fetcher)).status,"ACTIVE");
 assert.deepEqual(m.calls.map(c=>c.init?.method),["PATCH","GET"]);
 assert.equal(m.calls[0]!.init?.body,JSON.stringify({expectedVersion:3,status:"ACTIVE"}));
 for(const previous of [{...draftWorld!,status:"ACTIVE" as const},{...draftWorld!,scenes:[]}]){
  const invalid=mock(active,{worlds:[active]});await assert.rejects(()=>activateWorld(previous,invalid.fetcher));assert.equal(invalid.calls.length,0);
 }
 for(const fresh of [w,{...active,version:5}])await assert.rejects(()=>activateWorld(draftWorld!,mock(active,{worlds:[fresh]}).fetcher));
 const denied=mock({},null,403);await assert.rejects(()=>activateWorld(draftWorld!,denied.fetcher));assert.equal(denied.calls.length,1);
});
