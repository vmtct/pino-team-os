import test from "node:test";
import assert from "node:assert/strict";
import {projectRuntimeWorld,prepareRuntimeDraft,WorldMutationJournal,assetUrl} from "./world-runtime-model";
import type {CoreWorld} from "./world-runtime-client";
const id=(n:number)=>"019a0000-0000-7000-8000-"+String(n).padStart(12,"0");
const [wid,sid,mid]=[1,2,3].map(id),asset="pinoria/world/uploads/"+"a".repeat(64);
const w:CoreWorld={id:wid,key:"world",displayName:"World",descriptionText:"",version:3,worldType:"CORE",status:"DRAFT",scenes:[{id:sid,worldId:wid,key:"scene",displayName:"Scene",descriptionText:"",version:2,canvasWidth:1920,canvasHeight:1080,baseAssetKey:asset+".png",sortOrder:0,status:"ACTIVE",layers:[
{id:sid,key:"character",displayName:"Character",kind:"CHARACTER",version:1,mediaType:null,assetKey:null,posterAssetKey:null,positionX:0,positionY:26,scale:1,zIndex:10,anchor:"BOTTOM_CENTER",enabled:true,rotationDegrees:0},
{id:mid,key:"star",displayName:"Star",kind:"MEDIA",version:1,mediaType:"WEBM",assetKey:asset+".webm",posterAssetKey:asset+".png",positionX:-20,positionY:10,scale:1.5,zIndex:20,anchor:"CENTER",enabled:true,rotationDegrees:25}]}]};
test("authoritative projection preserves IDs, anchor, exact assets and no invented audit",()=>{
 const p=projectRuntimeWorld(w);
 assert.equal(p.world.layerCount,2);assert.equal(p.layers.length,3);
 const [bg,char,media]=p.layers;assert.equal(bg?.id,"background:"+sid);assert.equal(bg?.assetKey,asset+".png");assert.equal(char?.id,sid);assert.equal(char?.anchor,"BOTTOM_CENTER");assert.equal(char?.y,76);assert.equal(media?.x,30);assert.equal(media?.scale,150);assert.equal(media?.rotation,25);assert.equal(media?.createdByUser,"—");assert.equal(media?.updatedAt,null);
 assert.equal(assetUrl("https://evil.invalid/a.png"),null);assert.equal(assetUrl(asset+".gif"),"https://assets.pinohouse.art/"+asset+".gif");
});
test("new upload and legacy media use exact refs, existing Character and stable replay on manual retry",async()=>{
 const p=projectRuntimeWorld(w),journal=new WorldMutationJournal(()=>id(99)),calls:RequestInit[]=[];
 const fetcher:typeof fetch=async(_url,init)=>{calls.push(init??{});return Response.json({data:{objectKey:asset+".gif",mediaType:"GIF",byteSize:3}},{status:201})};
 const rows=[...p.layers,{id:"qa-world-local-1",sceneId:sid,key:"new",name:"New",kind:"MEDIA",mediaName:"new.gif",mediaData:"data:image/gif;base64,AQID",x:50,y:50,scale:100,rotation:0,z:40}];
 const first=await prepareRuntimeDraft(w.scenes[0]!,rows,journal,fetcher),second=await prepareRuntimeDraft(w.scenes[0]!,rows,journal,fetcher);
 assert.deepEqual(first,second);assert.deepEqual(first.map(l=>l.id),[null,mid,sid]);assert.equal(first[0]?.kind==="MEDIA"&&first[0].assetKey,asset+".gif");assert.equal(first[1]?.kind==="MEDIA"&&first[1].mediaType,"WEBM");
 assert.equal(new Headers(calls[0]?.headers).get("idempotency-key"),new Headers(calls[1]?.headers).get("idempotency-key"));
 await assert.rejects(()=>prepareRuntimeDraft(w.scenes[0]!,[...p.layers,{...rows.at(-1)!,id:id(9)}],journal,fetcher));
 await assert.rejects(()=>prepareRuntimeDraft(w.scenes[0]!,p.layers.filter(l=>l.kind!=="BACKGROUND"),journal,fetcher));
});
