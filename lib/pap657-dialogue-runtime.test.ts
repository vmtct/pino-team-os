import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduleDialogue} from './pap657-dialogue-runtime';
const pair=(n:number,zoneId=`zone${n}`)=>({actorA:`a${n}`,actorB:`b${n}`,zoneId,lines:['Xin chào','Chào bạn']});
test('one active dialogue per zone, three total, no actor overlap',()=>{
 const output=scheduleDialogue({now:1000,durationMs:5000,candidates:[pair(1),pair(2,'zone1'),pair(3),pair(4),pair(5)],active:[]});
 assert.equal(output.length,3);assert.equal(new Set(output.map(x=>x.zoneId)).size,3);
 assert.equal(output[0].expiresAt,6000);
});
test('expired conversations release zones and actors deterministically',()=>{
 const old=scheduleDialogue({now:1000,durationMs:1000,candidates:[pair(1)],active:[]});
 const next=scheduleDialogue({now:2000,durationMs:1000,candidates:[pair(1)],active:old});
 assert.equal(next.length,1);assert.equal(next[0].startedAt,2000);
});
test('untrusted active list cannot double-book a zone or actor',()=>{
 const first=scheduleDialogue({now:1000,durationMs:3000,candidates:[pair(1)],active:[]})[0];
 const collision={...first,actorA:'a9',actorB:'b9'};
 const output=scheduleDialogue({now:2000,durationMs:3000,candidates:[pair(4,'zone1'),pair(5)],active:[first,collision]});
 assert.equal(output.length,2);
 assert.deepEqual(output.map(x=>x.zoneId),['zone1','zone5']);
});
test('reject invalid text, actor, and duration without side effects',()=>{
 assert.deepEqual(scheduleDialogue({now:1000,durationMs:0,candidates:[pair(1)],active:[]}),[]);
 assert.deepEqual(scheduleDialogue({now:1000,durationMs:2000,candidates:[{...pair(1),lines:['<script>','test']}],active:[]}),[]);
 assert.deepEqual(scheduleDialogue({now:1000,durationMs:2000,candidates:[{...pair(1),actorB:'a1'}],active:[]}),[]);
});
