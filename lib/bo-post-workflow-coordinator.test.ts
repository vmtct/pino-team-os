import {test} from "node:test";
import assert from "node:assert/strict";
import {createWorkflowCoordinator,WorkflowPending} from "../app/bo/piner-posts/workflow-coordinator";
import {PostWorkflowError,type WorkflowCommand} from "../app/bo/piner-posts/workflow-client";
import {createSessionDraftJournal} from "../app/bo/piner-posts/draft-retry-journal";
const uid=(n:number)=>"01800000-0000-7000-8000-"+String(n).padStart(12,"0");
const command:WorkflowCommand={kind:"submit",postId:uid(1),expectedVersion:4,attachmentIds:[uid(3)],idempotencyKey:"workflow-fence-00001"},signal=new AbortController().signal;
function setup(){
 const map=new Map<string,string>(),journal=createSessionDraftJournal({getItem:k=>map.get(k)??null,setItem:(k,v)=>{map.set(k,v);},removeItem:k=>{map.delete(k);}});
 const grants=new Set(["piner.post.view","piner.post.submit"]);const scope={actorId:uid(2),centerId:uid(4),authorize:(p:string)=>grants.has(p)};
 return {journal,scope,grants,map};
}
test("PAP-2386 uncertain submission persists receipt, explicit exact replay and readback clear",async()=>{
 const x=setup();let calls=0,confirmed=false;
 const execute=async(c:WorkflowCommand)=>{calls++;if(calls===1)throw new PostWorkflowError(0,true);return {command:c,committedVersion:5,replayed:true};};
 let s=createWorkflowCoordinator(x.scope,()=>x.scope,execute,async()=>confirmed,x.journal);
 await assert.rejects(s.run(command,signal));assert.equal(await s.hasPending(signal),true);
 assert(!JSON.stringify([...x.map]).includes(command.postId));s.dispose();
 s=createWorkflowCoordinator(x.scope,()=>x.scope,execute,async()=>confirmed,x.journal);
 await assert.rejects(s.run(command,signal),WorkflowPending);
 await assert.rejects(s.retry({...command,expectedVersion:5},signal),WorkflowPending);assert.equal(calls,1);
 await assert.rejects(s.retry(command,signal),WorkflowPending);assert.equal(calls,2);assert.equal(await s.hasPending(signal),true);
 confirmed=true;assert.equal((await s.retry(command,signal)).committedVersion,5);assert.equal(await s.hasPending(signal),false);
});
test("PAP-2386 distinct permissions, first rejection vs later denial and no parallel commands",async()=>{
 const x=setup();let calls=0,uncertain=false;const execute=async(c:WorkflowCommand)=>{calls++;throw new PostWorkflowError(uncertain?0:403,uncertain);};
 const s=createWorkflowCoordinator(x.scope,()=>x.scope,execute,async()=>true,x.journal);
 await assert.rejects(s.run({...command,kind:"diary-selection",diaryIds:[uid(5)]},signal));assert.equal(calls,0);
 await assert.rejects(s.run(command,signal));assert.equal(await s.hasPending(signal),false);
 uncertain=true;const first=s.run(command,signal);await assert.rejects(s.run(command,signal),WorkflowPending);await assert.rejects(first);
 uncertain=false;await assert.rejects(s.retry(command,signal));assert.equal(await s.hasPending(signal),true);
 x.grants.delete("piner.post.submit");await assert.rejects(s.retry(command,signal));assert.equal(await s.hasPending(signal),true);
});
