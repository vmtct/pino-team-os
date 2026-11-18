import test from "node:test";
import assert from "node:assert/strict";
import {policyView,wishPolicyModule} from "./wish-policy-view";
import {parsePolicyHead} from "@/lib/pls-wish-ho-contract";
const id=(n:number)=>"019a0000-0000-7000-8000-"+String(n).padStart(12,"0");
const time="2026-11-17T00:00:00.000Z";
const value={name:"QA Policy",actor_user_id:id(2),created_at:time,center_id:id(1),unit_cost:100,definition_json:JSON.stringify({rates:[.8036,.1764,.02],hard4:5,hard5:16,soft5:12,curve:[{position:12,rate:.08},{position:13,rate:.16},{position:14,rate:.3},{position:15,rate:.55},{position:16,rate:1}],featuredGuarantee:true})};
const d={...value,version:1,base_pointer_version:0};
const head=parsePolicyHead({recordId:id(1),pointerVersion:1,active:true,published:{...value,id:id(3),sequence:1},latestDraft:d,pendingDraft:null,staleDraft:false});
test("native schema uses exact prototype policy fields and real percentages",()=>{
 const v=policyView(head,"published","QA Center");assert.equal(v.row.rate3,80.36);assert.equal(v.row.rate4,17.64);assert.equal(v.row.rate5,2);
 assert.deepEqual(v.curve.map(s=>s.percentage),[8,16,30,55,100]);assert.equal(v.row.center,"QA Center");assert.equal(v.row.status,"PUBLISHED");
 assert.ok(wishPolicyModule.fields.every(f=>f.readonly));assert.equal(v.row.media5,null);assert.equal(v.row.createdAt,null);assert.equal(v.revisionCreatedAt,time);
});
test("unavailable selection or labels never invent values",()=>{
 assert.throws(()=>policyView(head,"pending",null));assert.equal(policyView(head,"published",null).row.center,null);
 assert.equal(policyView({...head,active:false},"published",null).row.status,"RETIRED");
});

test("native policy view displays only actual record audit and selected media",()=>{
 const clip="https://assets.pinohouse.art/wish/qa.mp4";
 const published={...value,id:id(3),sequence:1,definition_json:JSON.stringify({...JSON.parse(value.definition_json),media:{"3":null,"4":null,"5":clip}})};
 const audit={createdAt:time,updatedAt:"2026-11-17T01:00:00.000Z",createdByUserId:id(2),updatedByUserId:id(8),createdByUser:null,updatedByUser:"QA Verified"};
 const actual=parsePolicyHead({recordId:id(1),pointerVersion:1,active:true,published,latestDraft:d,pendingDraft:null,staleDraft:false,...audit});
 const v=policyView(actual,"published","QA Center");assert.equal(v.row.media5,clip);assert.equal(v.row.media3,null);assert.equal(v.row.createdAt,time);assert.equal(v.row.createdByUser,null);assert.equal(v.row.updatedByUser,"QA Verified");assert.equal(v.row.updatedAt,audit.updatedAt);
});
