import test from 'node:test';
import assert from 'node:assert/strict';
import {boMissions,missionListPath} from './bo-missions';
test('PAP-723 bounded typed list query',()=>{
 assert.equal(missionListPath({search:'drawing',status:'ACTIVE',level:2,limit:26,offset:25}),'learning/missions?search=drawing&status=ACTIVE&level=2&limit=26&offset=25');
});
test('PAP-723 BO Mission write uses explicit idempotency and version',async()=>{
 const original=globalThis.fetch;
 const requests:Array<{url:string;init:RequestInit|undefined}>=[];
 globalThis.fetch=async(input,init)=>{requests.push({url:String(input),init});return new Response(JSON.stringify({data:{id:'x',version:2}}),{status:200,headers:{'content-type':'application/json'}});};
 try{
  const body={code:'M-002',name:'Art',level:2,status:'ACTIVE' as const,description:null,guideline:null,plsValue:30,paperSize:'A3' as const,pathProgramId:null,pathKeySnapshot:null,prerequisiteMissionId:null,prerequisiteCodeSnapshot:null};
  const result=await boMissions.update('mission-id',{...body,expectedVersion:1},'retry-key');
  assert.equal(result.version,2);
  assert.equal(requests[0]?.url,'/api/bo/learning/missions/mission-id');
  assert.equal(requests[0]?.init?.method,'PUT');
  assert.equal((requests[0]?.init?.headers as Record<string,string>)['idempotency-key'],'retry-key');
  assert.equal(JSON.parse(String(requests[0]?.init?.body)).expectedVersion,1);
 }finally{globalThis.fetch=original;}
});
test('PAP-723 API error does not pretend write succeeded',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({error:{message:'Concurrent update',requestId:'r1'}}),{status:409});
 try{await assert.rejects(()=>boMissions.list({limit:25}),e=>e instanceof Error&&e.message.includes('Concurrent update'));}
 finally{globalThis.fetch=original;}
});
