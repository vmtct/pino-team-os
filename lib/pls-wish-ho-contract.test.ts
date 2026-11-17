import test from "node:test";
import assert from "node:assert/strict";
import {parsePolicyHead,parseBannerHead,publishWishDraft,retireWishRevision,savePolicyDraft,saveBannerDraft,confirmSavedWishDraft,confirmWishLifecycle,type BannerPoolItem} from "./pls-wish-ho-contract";
const id=(n:number)=>"019a0000-0000-7000-8000-"+String(n).padStart(12,"0");
const time="2026-11-17T00:00:00.000Z";
const base={name:"QA",actor_user_id:id(2),created_at:time};
const definition={rates:[0.8036,0.1764,0.02],hard4:5,hard5:16,soft5:12,curve:[{position:12,rate:.08},{position:13,rate:.16},{position:14,rate:.3},{position:15,rate:.55},{position:16,rate:1}],featuredGuarantee:true};
const policy={...base,center_id:id(1),unit_cost:10,definition_json:JSON.stringify(definition)};
const draft={...policy,version:1,base_pointer_version:0};
const head={recordId:id(1),pointerVersion:0,active:false,published:null,latestDraft:draft,pendingDraft:draft,staleDraft:false};
test("initial policy publish uses actual CAS receipt, no invented revision",()=>{
 assert.deepEqual(publishWishDraft("policy",parsePolicyHead(head)),{action:"publishPolicy",body:{centerId:id(1),draftVersion:1,expectedPointerVersion:0}});
});
test("retired revision and stale pending draft are distinguished",()=>{
 const published={...policy,id:id(3),sequence:1};
 const later={...draft,version:2,base_pointer_version:1};
 const h=parsePolicyHead({...head,pointerVersion:2,published,latestDraft:later,pendingDraft:later,staleDraft:true});
 assert.equal(h.published?.id,id(3));assert.throws(()=>publishWishDraft("policy",h));assert.throws(()=>retireWishRevision("policy",h,"QA"));
 const active=parsePolicyHead({...head,pointerVersion:1,active:true,published,pendingDraft:null});
 assert.deepEqual(retireWishRevision("policy",active," QA "),{action:"retirePolicy",body:{centerId:id(1),revisionId:id(3),expectedPointerVersion:1,reason:"QA"}});
});
test("rejects inconsistent pointers, scope, pending clone and policy curve",()=>{
 for(const h of [{...head,active:true},{...head,pointerVersion:1},{...head,recordId:id(8)},{...head,staleDraft:true},{...head,pendingDraft:{...draft,version:2}},{...head,latestDraft:{...draft,definition_json:"{}"}}])assert.throws(()=>parsePolicyHead(h));
});
test("global banner independent of policy; draft and immutable published rarity differ",()=>{
 const value={...base,banner_id:id(4),center_id:null,family_id:"default",starts_at:time,ends_at:"2026-12-17T00:00:00.000Z",pool_json:JSON.stringify([{itemId:id(5),revision:2,weight:1,featured:true}])};
 const d={...value,version:1,base_pointer_version:0};
 const h={...head,recordId:id(4),latestDraft:d,pendingDraft:d};
 const parsed=parseBannerHead(h);assert.equal(parsed.pendingDraft?.value.centerId,null);
 assert.deepEqual(publishWishDraft("banner",parsed),{action:"publishBanner",body:{bannerId:id(4),draftVersion:1,expectedPointerVersion:0}});
 const published={...value,id:id(6),sequence:1,pool_json:JSON.stringify([{itemId:id(5),revision:2,weight:1,featured:true,rarity:5}])};
 assert.equal(parseBannerHead({...h,pointerVersion:1,active:true,published,pendingDraft:null}).published?.value.pool[0]?.rarity,5);
 assert.throws(()=>parseBannerHead({...h,pointerVersion:1,active:true,published:{...published,pool_json:value.pool_json},pendingDraft:null}));
 assert.throws(()=>parseBannerHead({...h,latestDraft:{...d,pool_json:published.pool_json}}));
});

test("save draft uses exact current CAS and verifies receipt plus actual pending readback",()=>{
 const current=parsePolicyHead(head);
 const command=savePolicyDraft(current.latestDraft!.value," Next ",current);
 assert.deepEqual(command.body,{centerId:id(1),cost:10,definition,name:"Next",expectedDraftVersion:1,expectedPointerVersion:0});
 const next={...draft,name:"Next",version:2};
 const receipt={centerId:id(1),draftVersion:2,basePointerVersion:0};
 const fresh={...head,latestDraft:next,pendingDraft:next};
 assert.equal(confirmSavedWishDraft(command,receipt,fresh).pendingDraft?.version,2);
 for(const bad of [{...receipt,draftVersion:3},{...receipt,centerId:id(8)}])assert.throws(()=>confirmSavedWishDraft(command,bad,fresh));
 assert.throws(()=>confirmSavedWishDraft(command,receipt,head));
 assert.throws(()=>confirmSavedWishDraft(command,receipt,{...fresh,latestDraft:{...next,unit_cost:11},pendingDraft:{...next,unit_cost:11}}));
});
test("save banner carries only editable concrete revision fields",()=>{
 const command=saveBannerDraft({bannerId:id(4),centerId:null,familyId:"default",startsAt:time,endsAt:"2026-12-17T00:00:00.000Z",pool:[{itemId:id(5),revision:2,weight:1,featured:true,rarity:5} as BannerPoolItem]},"Global",null);
 assert.deepEqual(command.body.pool,[{itemId:id(5),revision:2,weight:1,featured:true}]);
 assert.equal(command.body.expectedDraftVersion,0);assert.equal(command.body.expectedPointerVersion,0);
});

test("optional versioned media is strict and legacy null media round trips",()=>{
 const clip="https://assets.pinohouse.art/wish/qa.mp4";
 const withMedia=(m:unknown)=>({...draft,definition_json:JSON.stringify({...definition,media:m})});
 const valid=withMedia({"3":null,"4":null,"5":clip});
 const h=parsePolicyHead({...head,latestDraft:valid,pendingDraft:valid});
 assert.equal(h.pendingDraft?.value.definition.media?.["5"],clip);
 assert.equal(savePolicyDraft(h.pendingDraft!.value,"QA",h).body.definition.media?.["5"],clip);
 for(const m of [{"3":null,"4":null,"5":"https://example.com/a.mp4"},{"3":null,"4":null,"5":clip+"?x=1"},{"3":null,"4":null},{"3":null,"4":null,"5":clip,"6":null}]){
 const bad=withMedia(m);assert.throws(()=>parsePolicyHead({...head,latestDraft:bad,pendingDraft:bad}));
 }
 const empty=withMedia({"3":null,"4":null,"5":null});
 assert.deepEqual(parsePolicyHead({...head,latestDraft:empty,pendingDraft:empty}).pendingDraft?.value.definition,definition);
 const command=savePolicyDraft(parsePolicyHead(head).pendingDraft!.value,"QA",parsePolicyHead(head));
 const next={...empty,version:2};
 assert.equal(confirmSavedWishDraft(command,{centerId:id(1),draftVersion:2,basePointerVersion:0},{...head,latestDraft:next,pendingDraft:next}).pendingDraft?.version,2);
});
test("record audit never substitutes revision actor or accepts partial metadata",()=>{
 const audit={createdAt:time,updatedAt:"2026-11-17T01:00:00.000Z",createdByUserId:id(2),updatedByUserId:id(8),createdByUser:null,updatedByUser:"QA Verified"};
 assert.equal(parsePolicyHead(head).audit,null);
 assert.deepEqual(parsePolicyHead({...head,...audit}).audit,audit);
 for(const bad of [{...head,createdAt:time},{...head,...audit,updatedByUserId:"bad"},{...head,...audit,updatedAt:"2026-11-16T00:00:00.000Z"},{...head,...audit,createdByUser:""}])assert.throws(()=>parsePolicyHead(bad));
});

test("publish readback pins exact draft, new immutable revision and pointer, rejects other values",()=>{
 const before=parsePolicyHead(head),cmd=publishWishDraft("policy",before),receipt={centerId:id(1),revisionId:id(3),version:1};
 const published={...policy,id:id(3),sequence:1},fresh={...head,pointerVersion:1,active:true,published,pendingDraft:null};
 assert.equal(confirmWishLifecycle(cmd,before,receipt,fresh).published?.id,id(3));
 for(const bad of [{...receipt,version:2},{...receipt,centerId:id(8)},{...receipt,revisionId:id(8)}])assert.throws(()=>confirmWishLifecycle(cmd,before,bad,fresh));
 for(const bad of [{...fresh,active:false},{...fresh,published:{...published,unit_cost:11}},{...fresh,published:{...published,sequence:2}},{...fresh,pendingDraft:draft,staleDraft:true}])assert.throws(()=>confirmWishLifecycle(cmd,before,receipt,bad));
});
test("retire readback must retain immutable revision, exact pointer and inactive status",()=>{
 const published={...policy,id:id(3),sequence:1},active={...head,pointerVersion:1,active:true,published,pendingDraft:null};
 const before=parsePolicyHead(active),cmd=retireWishRevision("policy",before,"QA"),receipt={centerId:id(1),revisionId:id(3),version:2,active:false};
 const fresh={...active,pointerVersion:2,active:false};
 assert.equal(confirmWishLifecycle(cmd,before,receipt,fresh).active,false);
 assert.throws(()=>confirmWishLifecycle(cmd,before,{...receipt,active:true},fresh));
 assert.throws(()=>confirmWishLifecycle(cmd,before,receipt,{...fresh,active:true}));
 assert.throws(()=>confirmWishLifecycle(cmd,before,receipt,{...fresh,published:{...published,name:"Changed"}}));
});
test("banner publication accepts server-only rarity but no change to pool or scope",()=>{
 const v={...base,banner_id:id(4),center_id:null,family_id:"default",starts_at:time,ends_at:"2026-12-17T00:00:00.000Z"},pool=[{itemId:id(5),revision:2,weight:1,featured:true}];
 const d={...v,pool_json:JSON.stringify(pool),version:1,base_pointer_version:0},h={...head,recordId:id(4),latestDraft:d,pendingDraft:d};
 const before=parseBannerHead(h),cmd=publishWishDraft("banner",before),receipt={bannerId:id(4),revisionId:id(6),version:1};
 const published={...v,id:id(6),sequence:1,pool_json:JSON.stringify(pool.map(x=>({...x,rarity:5})))},fresh={...h,pointerVersion:1,active:true,published,pendingDraft:null};
 assert.equal(confirmWishLifecycle(cmd,before,receipt,fresh).published?.id,id(6));
 assert.throws(()=>confirmWishLifecycle(cmd,before,receipt,{...fresh,published:{...published,center_id:id(1)}}));
 assert.throws(()=>confirmWishLifecycle(cmd,before,receipt,{...fresh,published:{...published,pool_json:JSON.stringify(pool.map(x=>({...x,weight:2,rarity:5})))}}));
});
