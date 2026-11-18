import test from "node:test";
import assert from "node:assert/strict";
import {parsePolicyHead} from "@/lib/pls-wish-ho-contract";
import {policyEdit,policyCurve,policyEditCommand} from "./wish-policy-edit";
const id=(n:number)=>"019a0000-0000-7000-8000-"+String(n).padStart(12,"0");
const time="2026-11-17T00:00:00.000Z";
const definition={rates:[.8036,.1764,.02],hard4:5,hard5:16,soft5:12,curve:[{position:12,rate:.08},{position:13,rate:.16},{position:14,rate:.30},{position:15,rate:.55},{position:16,rate:1}],featuredGuarantee:true};
const draft={name:"QA",actor_user_id:id(2),created_at:time,center_id:id(1),unit_cost:100,definition_json:JSON.stringify(definition),version:1,base_pointer_version:0};
const h=parsePolicyHead({recordId:id(1),pointerVersion:0,active:false,published:null,latestDraft:draft,pendingDraft:draft,staleDraft:false});
test("one draft command for decimal odds, canonical Center and CAS",()=>{
 const d=policyEdit(h);
 const command=policyEditCommand({...d,rate3:"80.36",rate4:"17.64",rate5:"2",cost:"120"},h);
 assert.equal(command.body.cost,120);assert.equal(command.body.centerId,id(1));
 assert.equal(command.body.expectedDraftVersion,1);assert.equal(command.body.expectedPointerVersion,0);
 assert.deepEqual(command.body.definition.rates,definition.rates);
});
test("invalid probabilities, wrong Center, stale base, blank numbers and untrusted media fail closed",()=>{
 const d=policyEdit(h);
 for(const v of [{...d,rate3:"80"},{...d,cost:""},{...d,hard4:0},{...d,centerId:id(8)},{...d,media5:"https://other.example/file.mp4"}])assert.throws(()=>policyEditCommand(v,h));
 assert.throws(()=>policyEdit({...h,staleDraft:true}));assert.throws(()=>policyEditCommand(d,{...h,staleDraft:true}));
});
test("curve is fixed consecutive positions, no missing, nonmonotonic or incomplete final rate",()=>{
 const d=policyEdit(h),changed={...d,soft5:11};
 const curve=policyCurve(changed);assert.equal(curve[0]?.position,11);assert.equal(curve[0]?.percentage,"");
 assert.throws(()=>policyEditCommand(changed,h));assert.throws(()=>policyEditCommand({...changed,curve},h));
 assert.equal(policyEditCommand({...changed,curve:curve.map(x=>x.position===11?{...x,percentage:4}:x)},h).body.definition.curve.length,6);
 for(const c of [d.curve.map(x=>x.position===13?{...x,percentage:1}:x),d.curve.map(x=>x.position===16?{...x,percentage:99}:x)])assert.throws(()=>policyEditCommand({...d,curve:c},h));
});

test("edit session rejects later draft or pointer instead of silently rebasing",()=>{
 const d=policyEdit(h);
 const next={...draft,version:2};
 const fresh=parsePolicyHead({recordId:id(1),pointerVersion:0,active:false,published:null,latestDraft:next,pendingDraft:next,staleDraft:false});
 assert.throws(()=>policyEditCommand(d,fresh));
 const published={...draft,id:id(3),sequence:1};
 const afterPublish=parsePolicyHead({recordId:id(1),pointerVersion:1,active:true,published,latestDraft:draft,pendingDraft:null,staleDraft:false});
 assert.throws(()=>policyEditCommand(d,afterPublish));
 assert.equal(policyEditCommand(policyEdit(fresh),fresh).body.expectedDraftVersion,2);
 assert.equal(policyEditCommand(policyEdit(afterPublish),afterPublish).body.expectedPointerVersion,1);
});
