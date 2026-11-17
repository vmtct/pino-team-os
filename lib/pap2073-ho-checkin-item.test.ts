import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {itemDefinition,projectItemRow} from "../app/ho/pinoria/wardrobe/schema";
import {validateItem,saveCheckInItem,ItemApiError} from "../app/ho/pinoria/wardrobe/item-client";
import {recordProjection} from "../app/components/workspace-renderer/projection";
import {validateModule,type AuthorizationContext} from "./workspace-schema";
const id="019b1126-0001-7000-8000-000000000001";
const asset={key:"pinoria/item/uploads/"+"a".repeat(64)+".png",mimeType:"image/png",byteSize:42,sha256:"a".repeat(64)};
const item={id,key:"qa-item",displayName:"QA Item",type:"WEARABLE",slot:"HAIR",asset,positionX:0,positionY:0,scale:1,rotationDegrees:null,variantOfItemId:null,status:"PUBLISHED",revision:3,createdAt:"",updatedAt:"",publishedAt:null,unpublishedAt:null,checkInItem:false};
const draft={key:item.key,displayName:"Pending Name",type:item.type,slot:item.slot,asset,positionX:0.3,positionY:0,scale:1,rotationDegrees:null,variantOfItemId:null,revision:3,checkInItem:true};
const model={...itemDefinition,data:{id:"test",list:async()=>({rows:[],total:0}),detail:async()=>null}};
const context:AuthorizationContext={surface:"HO",authorize:p=>p==="pinoria.item.view"};
function projected(raw:unknown){return recordProjection(model,context,projectItemRow(validateItem(raw)))!}
test("PAP-2073 ordinary false remains visible; legacy absent defaults false; SET completely hidden",()=>{
 for(const type of ["WEARABLE","ACCESSORY"]){const p=projected({...item,type});assert.equal(p.record.checkInItem,false);assert(p.fields.some(x=>x.key==="checkInItem"))}
 const legacy=projected({...item,checkInItem:undefined});assert.equal(legacy.record.checkInItem,false);
 const set=projected({...item,type:"SET",asset:null,slot:null,checkInItem:undefined,starterEligible:false,members:[]});assert(!set.fields.some(x=>["checkInItem","publishedCheckInItem"].includes(x.key)));assert(!("checkInItem" in set.record));
 assert.throws(()=>validateItem({...item,type:"SET",asset:null,slot:null,checkInItem:false}),/not a SET field/);
 assert.throws(()=>validateItem({...item,checkInItem:"false"}),/Invalid Check-in/);
 assert.throws(()=>validateItem({...item,pendingDraft:{...draft,checkInItem:null}}),/Invalid pending/);
});
test("PAP-2073 pending flag distinguished from effective published value; property-only registration",()=>{
 const p=projected({...item,pendingDraft:draft});assert.equal(p.record.checkInItem,true);assert.equal(p.record.publishedCheckInItem,false);
 assert.equal(projected(item).fields.some(x=>x.key==="publishedCheckInItem"),false);
 validateModule(model);
 assert.throws(()=>validateModule({...model,table:{...model.table,columns:[...model.table.columns,{field:"checkInItem",visible:false}]}}),/property-only/);
 assert.throws(()=>validateModule({...model,fields:model.fields.map(f=>f.key==="checkInItem"?{...f,capabilities:{...f.capabilities,search:true}}:f)}),/property-only/);
 assert.equal(recordProjection(model,{surface:"HO",authorize:()=>false},projectItemRow(validateItem(item))),null);
});
test("PAP-2073 native domain CAS preserves pending other fields and published flag, stale read never sends PATCH",async()=>{
 const calls:{method:string;body?:Record<string,unknown>}[]=[];
 const old=globalThis.fetch;
 let revision=3;
 globalThis.fetch=async (_input,init)=>{const method=init?.method??"GET";const body=init?.body?JSON.parse(String(init.body)) as Record<string,unknown>:undefined;calls.push({method,body});if(method==="GET")return Response.json({data:{...item,revision,pendingDraft:{...draft,revision}}});assert.equal(body?.expectedRevision,3);assert.equal(body?.displayName,"Pending Name");assert.equal(body?.positionX,0.3);assert.equal(body?.checkInItem,false);return Response.json({data:{...item,revision:4,pendingDraft:{...draft,revision:4,checkInItem:false}}})};
 try{const result=await saveCheckInItem(id,3,false,new AbortController().signal);assert.equal(result.revision,4);assert.equal(result.checkInItem,false);assert.equal(result.pendingDraft?.checkInItem,false);assert.deepEqual(calls.map(x=>x.method),["GET","PATCH"]);revision=4;await assert.rejects(saveCheckInItem(id,3,true,new AbortController().signal),(e:unknown)=>e instanceof ItemApiError&&e.status===409);assert.deepEqual(calls.map(x=>x.method),["GET","PATCH","GET"])}finally{globalThis.fetch=old}
});
test("PAP-2073 uses native DSA Detail and keeps generic HO adapter read-only",()=>{
 const file=(f:string)=>readFileSync(new URL("../"+f,import.meta.url),"utf8");
 assert.match(file("app/ho/pinoria/wardrobe/HoCheckInOverview.tsx"),/PropertySections variant="detail"/);
 assert.match(file("app/ho/pinoria/wardrobe/HoCheckInOverview.tsx"),/BoTypedEditor/);
 assert.match(file("app/ho/pinoria/wardrobe/HoItemsTdd.tsx"),/drawerReadOnly detailProperties=/);
 assert.match(file("lib/workspace-adapters/adapter.ts"),/session\.scope\.surface === "HO" && provider\.mutation/);
 assert.match(file("app/ho/pinoria/wardrobe/HoItemCreate.tsx"),/setCheckInItem\(false\)/);
});