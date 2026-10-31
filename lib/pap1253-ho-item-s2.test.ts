import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {TddRegistry,composeTabs} from "./workspace-schema";
import {itemDefinition,extensionVerifier} from "../app/ho/pinoria/wardrobe/schema";
import {validateItem,assetUrl,ItemApiError} from "../app/ho/pinoria/wardrobe/item-client";

const uuid="019b1126-0001-7000-8000-000000000001";
const other="019b1126-0001-7000-8000-000000000002";
const row={id:uuid,key:"test-set",displayName:"S2 Test SET",type:"SET",slot:null,asset:null,status:"DRAFT",
 positionX:0,positionY:0,scale:1,rotationDegrees:null,revision:1,createdAt:"",updatedAt:"",publishedAt:null,unpublishedAt:null,
 starterEligible:false,members:[],variantOfItemId:null};
test("PAP-1253 accepts canonical SET with no Item-owned slot or media",()=>{
 const parsed=validateItem(row);assert.equal(parsed.type,"SET");
 const published=validateItem({...row,status:"PUBLISHED",revision:4,members:[{id:other,ordinal:1,item_type:"WEARABLE",status:"PUBLISHED",slot:"HAIR",asset_key:"protected",position_x:0,position_y:0,scale:1,rotation_degrees:null}]});
 assert.equal(published.type,"SET");
 assert.equal(published.type==="SET"?published.members?.[0]?.id:null,other);
 assert.throws(()=>validateItem({...row,asset:{key:"demo/fake.png"}}),/Invalid SET/);
 assert.throws(()=>validateItem({...row,slot:"HAIR"}),/Invalid SET/);
 assert.throws(()=>validateItem({...row,pendingDraft:{type:"SET",key:"test-set",displayName:"SET",starterEligible:true,memberItemIds:["not-a-uuid"],revision:2}}),/Invalid pending SET/);
});
test("PAP-1253 registers typed S2 business tabs through Founder-approved TDD scope",()=>{
 const fields=composeTabs({...itemDefinition,data:{id:"test",list:async()=>({rows:[],total:0}),detail:async()=>null}});
 assert.deepEqual(fields.map(t=>t.label),["Tổng quan","Calibration","Biến thể","Thành viên","Lịch sử"]);
 assert.throws(()=>new TddRegistry().register({...itemDefinition,data:{id:"test",list:async()=>({rows:[],total:0}),detail:async()=>null}}),/not verified/);
 const registry=new TddRegistry(extensionVerifier);
 registry.register({...itemDefinition,data:{id:"test",list:async()=>({rows:[],total:0}),detail:async()=>null}});
 for(const slot of itemDefinition.detail.businessTabs.slice(1)){
  assert.equal(extensionVerifier(slot.approval,{surface:"BO",key:"wardrobe",extensionId:slot.extensionId}),false);
  assert.equal(extensionVerifier(slot.approval,{surface:"HO",key:"roles",extensionId:slot.extensionId}),false);
 }
});
test("PAP-1253 preserves server-hosted HO authorization, CAS & private R2",()=>{
 const src=readFileSync(new URL("../app/ho/pinoria/wardrobe/HoItemRelations.tsx",import.meta.url),"utf8");
 const host=readFileSync(new URL("../lib/ho-pinoria-item-handler.ts",import.meta.url),"utf8");
 assert.match(src,/expectedRevision:item.revision/);
 assert.match(src,/credentials:"same-origin"/);
 assert.match(src,/getItem\(itemId/);
 assert.match(src,/status==="PUBLISHED"/);
 assert.match(src,/taken\.has\(x\.slot\)/);
 assert.match(host,/authorizeHoShell\(request.headers,env\)/);
 assert.match(host,/PINO_HO_ITEM_CORE\.executeWithStaffPassword/);
 const bad={key:"demo/pinoria/fake.png",mimeType:"image/png" as const,byteSize:42,sha256:"1".repeat(64)};
 assert.equal(assetUrl(bad,uuid),null);
 assert.match(new ItemApiError(409,"CONFLICT").message,/Tải lại/);
});
