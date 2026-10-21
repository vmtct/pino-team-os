import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceSpatialDialogue} from './pap657-dialogue-proximity-engine';
const published={revision:3,durationMs:4000,proximityPx:90,maxTvBubbles:3,maxZoneBubbles:1,pool:[['Chào bạn','Chào cậu']]};
const actors=[{id:'a',zoneId:'art',x:0,y:0},{id:'b',zoneId:'art',x:40,y:30}];
test('approved spatial proximity drives actual scheduler',()=>{
 const result=advanceSpatialDialogue({published,now:100,active:[],actors});
 assert.equal(result.length,1);assert.equal(result[0].zoneId,'art');
});
test('existing dialogues close when an actor leaves the approved zone or proximity',()=>{
 const active=advanceSpatialDialogue({published,now:100,active:[],actors});
 assert.equal(advanceSpatialDialogue({published,now:200,active,actors:[actors[0],{...actors[1],zoneId:'piano'}]}).length,0);
 assert.equal(advanceSpatialDialogue({published,now:200,active,actors:[actors[0],{...actors[1],x:200}]}).length,0);
});
test('distance, zone and invalid publish fail closed',()=>{
 assert.equal(advanceSpatialDialogue({published,now:100,active:[],actors:[actors[0],{...actors[1],x:200}]}).length,0);
 assert.equal(advanceSpatialDialogue({published,now:100,active:[],actors:[actors[0],{...actors[1],zoneId:'piano'}]}).length,0);
 assert.equal(advanceSpatialDialogue({published:{...published,revision:0},now:100,active:[],actors}).length,0);
});
