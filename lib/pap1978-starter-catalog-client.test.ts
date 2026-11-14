import test from "node:test";
import assert from "node:assert/strict";
import {loadStarterCatalog,createStarter,updateStarter,changeStarterLifecycle,starterDraft} from "../app/ho/pinoria/starter-sets/starter-catalog-client";
import type {HoSetItem,ItemRecord} from "../app/ho/pinoria/wardrobe/item-client";
const id=(n:number)=>"019b1126-0001-7000-8000-"+String(n).padStart(12,"0");
const set=(n:number,p:Partial<HoSetItem>={}):HoSetItem=>({id:id(n),key:"set-"+n,displayName:"Set "+n,type:"SET",slot:null,asset:null,positionX:0,positionY:0,scale:1,rotationDegrees:null,status:"DRAFT",revision:1,createdAt:"2026-11-14",updatedAt:"2026-11-14",publishedAt:null,unpublishedAt:null,starterEligible:true,members:[],...p});
const mock=(rows:ItemRecord[],detail:HoSetItem[],result:HoSetItem=detail[0])=>{
 const calls:{path:string;method:string;body:object}[]=[];
 return {calls,client:{list:async()=>rows,get:async(key:string)=>{const r=detail.find(x=>x.id===key);if(!r)throw Error("missing");return r;},write:async(path:string,method:"POST"|"PATCH",body:object)=>{calls.push({path,method,body});return result;}}};
};
test("list hydrates SET detail and includes pending Starter",async()=>{
 const a=set(1),b=set(2,{starterEligible:false}),c=set(3,{starterEligible:false,status:"PUBLISHED",pendingDraft:{revision:1,key:"set-3",displayName:"Set 3",type:"SET",starterEligible:true,memberItemIds:[]}});
 assert.deepEqual((await loadStarterCatalog(undefined,mock([a,b,c],[a,b,c]).client)).starters.map(x=>x.id),[a.id,c.id]);
});
test("list fails closed on missing flag or revision change",async()=>{
 const a=set(1);for(const d of [set(1,{starterEligible:undefined}),set(1,{revision:2})])await assert.rejects(loadStarterCatalog(undefined,mock([a],[d]).client));
});
test("create writes canonical starter SET and verifies draft",async()=>{
 const a=set(1),m=mock([], [a]);assert.deepEqual(await createStarter(starterDraft(a),m.client),a);
 assert.deepEqual(m.calls,[{path:"",method:"POST",body:{type:"SET",key:a.key,displayName:a.displayName,starterEligible:true,memberItemIds:[]}}]);
});
test("update preserves variant and CAS and verifies readback",async()=>{
 const a=set(1,{variantOfItemId:id(9)}),b=set(1,{revision:2,displayName:"New",variantOfItemId:id(9)}),m=mock([], [b]);
 assert.equal((await updateStarter(a,starterDraft(b),m.client)).revision,2);
 assert.deepEqual(m.calls[0],{path:"/"+a.id,method:"PATCH",body:{type:"SET",key:a.key,displayName:"New",starterEligible:true,memberItemIds:[],variantOfItemId:id(9),expectedRevision:1}});
 await assert.rejects(updateStarter(a,starterDraft(b),mock([], [a],b).client));
});
test("lifecycle CAS and readback; wrong state writes nothing",async()=>{
 const a=set(1),b=set(1,{status:"PUBLISHED",revision:2}),c=set(1,{status:"UNPUBLISHED",revision:3});
 let m=mock([], [b]);assert.equal((await changeStarterLifecycle(a,"publish",m.client)).status,"PUBLISHED");
 assert.deepEqual(m.calls[0],{path:"/"+a.id+"/publish",method:"POST",body:{expectedRevision:1}});
 m=mock([], [c]);assert.equal((await changeStarterLifecycle(b,"unpublish",m.client)).status,"UNPUBLISHED");
 m=mock([], [a]);await assert.rejects(changeStarterLifecycle(a,"unpublish",m.client));assert.equal(m.calls.length,0);
});
