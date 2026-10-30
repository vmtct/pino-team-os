import test from "node:test";
import assert from "node:assert/strict";
import {TddRegistry,type Approval} from "./workspace-schema";
import {itemDefinition,extensionVerifier} from "../app/ho/pinoria/wardrobe/schema";
import {assetUrl,validateItem} from "../app/ho/pinoria/wardrobe/item-client";
test("PAP-1119 approved interactive Calibration registers only with scoped Founder authority",()=>{
 assert.throws(()=>new TddRegistry().register({...itemDefinition,data:{id:"local",list:async()=>({rows:[],total:0}),detail:async()=>null}}),/not verified/);
 const ok=new TddRegistry((a:Approval,s)=>extensionVerifier(a,s));
 const admitted=ok.register({...itemDefinition,data:{id:"local",list:async()=>({rows:[],total:0}),detail:async()=>null}});
 assert.equal(admitted.detail.businessTabs[0]?.kind,"approved-extension");
 assert.equal(extensionVerifier(itemDefinition.detail.businessTabs[0].approval,{surface:"BO",key:"wardrobe",extensionId:"pap1119-ho-item-calibration-v1"}),false);
 assert.equal(extensionVerifier(itemDefinition.detail.businessTabs[0].approval,{surface:"HO",key:"roles",extensionId:"pap1119-ho-item-calibration-v1"}),false);
});
test("PAP-1119 only renders Core-owned R2 upload keys, no synthetic asset URLs",()=>{
 const ok={key:"pinoria/item/uploads/"+"a".repeat(64)+".png",mimeType:"image/png" as const,byteSize:12,sha256:"c".repeat(64)};
 assert.equal(assetUrl(ok),"https://assets.pinohouse.art/"+ok.key);
 assert.equal(assetUrl({...ok,key:"https://evil.invalid/image.png"}),null);
 assert.equal(assetUrl({...ok,key:"demo/pinoria/fake-item.png"}),null);
});
test("PAP-1119 validates the strict HO Core read projection",()=>{
 const base={id:"019b1126-0001-7000-8000-000000000001",key:"real-item",displayName:"Test",type:"WEARABLE",slot:"HAIR",status:"DRAFT",
  asset:{key:"pinoria/item/uploads/"+"0".repeat(64)+".png",mimeType:"image/png",byteSize:10,sha256:"0".repeat(64)},
  positionX:0,positionY:0,scale:1,rotationDegrees:null,revision:1,createdAt:"",updatedAt:"",publishedAt:null,unpublishedAt:null};
 assert.equal(validateItem(base).revision,1);
 const pending={...base,key:"pending-key",positionX:.36,positionY:-.24,revision:3};
 const published=validateItem({...base,status:"PUBLISHED",revision:3,pendingDraft:pending});
 assert.equal(published.positionX,0);
 assert.equal(published.pendingDraft?.positionX,.36);
 assert.throws(()=>validateItem({...base,status:"PUBLISHED",revision:3,pendingDraft:{...pending,revision:2}}));
 assert.throws(()=>validateItem({...base,status:"PUBLISHED",revision:3,pendingDraft:{...pending,asset:{...pending.asset,key:"https://evil.invalid/file.png"}}}));
 assert.throws(()=>validateItem({...base,revision:"1"}));
 assert.throws(()=>validateItem({...base,slot:"ZINDEX"}));
});
