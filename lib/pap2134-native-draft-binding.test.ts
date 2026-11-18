import {test} from "node:test";
import assert from "node:assert/strict";
import {bindNativeDraft,draftSchema,draftQuery} from "../app/bo/piner-posts/native-draft-binding";
import {createDraftController,type DraftActorScope} from "../app/bo/piner-posts/draft-controller";
import {postFields,postDefinition} from "../app/bo/piner-posts/schema";
import {allowsField,type AuthorizationContext} from "../lib/workspace-schema";
const A="01900000-0000-7000-8000-000000000001",S="01900000-0000-7000-8000-000000000003",P="01900000-0000-7000-8000-000000000004",Q="01900000-0000-7000-8000-000000000005";
const stamp="2026-11-18T00:00:00.000Z",sig=()=>new AbortController().signal;
const row={id:P,studentId:S,centerId:A,studentName:"QA",centerName:"A",caption:"",status:"DRAFT",publisher:"PINO Afterschool",version:1,createdAt:stamp,updatedAt:stamp,createdBy:null,updatedBy:null};
function setup(fetcher:typeof fetch,edit=true){
 const actor:DraftActorScope={actorId:"qa",centerId:A,authorize:p=>p==="piner.post.view"||edit};
 const ctx:AuthorizationContext={surface:"BO",centerId:A,authorize:p=>actor.authorize(p as Parameters<typeof actor.authorize>[0])};
 const controller=createDraftController(actor,()=>actor,fetcher,()=>"draft-command-00001");
 return {ctx,...bindNativeDraft(controller,ctx)};
}
test("native schema reuses M1 columns/groups, permits only caption edit and hides deferred tabs",()=>{
 const x=setup(async()=>{throw Error("unexpected fetch")});
 assert.deepEqual(x.schema.fields.map(f=>[f.key,f.label,f.width]),postFields.map(f=>[f.key,f.label,f.width]));
 assert.deepEqual(x.schema.drawer.sections,postDefinition.drawer.sections);
 assert.deepEqual(x.schema.detail.overview,postDefinition.detail.overview);
 assert.equal(x.schema.detail.businessTabs.length,0);
 assert.deepEqual(x.schema.fields.filter(f=>allowsField(x.schema,x.ctx,f.key,"inlineEdit")).map(f=>f.key),["caption"]);
 assert(!allowsField(x.schema,{...x.ctx,authorize:p=>p==="local.posts.preview"},"caption","inlineEdit"));
});
test("canonical inline mutation accepts blank caption, uses CAS and readback",async()=>{
 const result={...row,version:2};let calls=0;
 const x=setup(async(_p,i)=>{calls++;if(i?.method==="PATCH"){assert.deepEqual(JSON.parse(String(i.body)),{caption:"",expectedVersion:1});return Response.json({data:{post:result,committedVersion:2,replayed:false}});}return Response.json({data:result});});
 const saved=await x.mutation.update(P,{caption:""},"1",x.ctx,sig());
 assert.equal(saved.status,"saved");if(saved.status==="saved")assert.equal(saved.version,"2");assert.equal(calls,2);
 assert.equal((await x.mutation.update(P,{caption:"x"},"bad",x.ctx,sig())).status,"invalid");assert.equal(calls,2);
});
test("read-only context or substituted context cannot mutate",async()=>{
 let calls=0;const x=setup(async()=>{calls++;throw Error("unexpected");},false);
 assert.equal((await x.mutation.update(P,{caption:""},"1",x.ctx,sig())).status,"denied");
 const y=setup(async()=>{calls++;throw Error("unexpected");});
 assert.equal((await y.mutation.update(P,{caption:""},"1",{...y.ctx},sig())).status,"denied");
 assert.equal(calls,0);
});
test("complete keyset collection with actual native list shape; denied context blocks data",async()=>{
 let calls=0;const x=setup(async()=>{calls++;return Response.json({data:calls===1?{posts:[{...row,id:Q}],nextBeforeId:Q}:{posts:[row],nextBeforeId:null}});});
 const list=await x.schema.data.list(draftQuery,x.ctx,sig());assert.equal(list.total,2);assert.deepEqual(list.rows.map(r=>r.id),[Q,P]);
 await assert.rejects(x.schema.data.list(draftQuery,{...x.ctx},sig()));assert.equal(calls,2);
});

test("exported native schema is the actual bound runtime and disposed scope is denied",async()=>{let calls=0;const x=setup(async()=>{calls++;return Response.json({data:{posts:[row],nextBeforeId:null}});});assert.equal(x.schema,draftSchema);assert.equal((await draftSchema.data.list(draftQuery,x.ctx,sig())).total,1);x.unbind();await assert.rejects(draftSchema.data.list(draftQuery,x.ctx,sig()));assert.equal((await x.mutation.update(P,{caption:"x"},"1",x.ctx,sig())).status,"denied");assert.equal(calls,1);});
