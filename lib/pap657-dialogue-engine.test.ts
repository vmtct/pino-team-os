import test from 'node:test';
import assert from 'node:assert/strict';
import {advancePublishedDialogue} from './pap657-dialogue-engine';
const published={revision:2,durationMs:4000,proximityPx:90,maxTvBubbles:3,maxZoneBubbles:1,pool:[['Xin chào','Chào bạn']]};
const nearby=[{actorA:'a',actorB:'b',zoneId:'zone1'}];
test('published text drives a bounded dialogue without generating learner claims',()=>{
 const items=advancePublishedDialogue({published,now:100,active:[],nearby});
 assert.equal(items.length,1);assert.deepEqual(items[0].lines,published.pool[0]);
 assert.equal(items[0].expiresAt,4100);
});
test('invalid or empty published pool never starts dialogue',()=>{
 assert.deepEqual(advancePublishedDialogue({published:{...published,maxTvBubbles:9},now:100,active:[],nearby}),[]);
 assert.deepEqual(advancePublishedDialogue({published:{...published,pool:[]},now:100,active:[],nearby}),[]);
});
