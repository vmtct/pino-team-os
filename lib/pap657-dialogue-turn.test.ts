import test from 'node:test';
import assert from 'node:assert/strict';
import {visibleDialogueLine} from './pap657-dialogue-turn';
const dialogue={actorA:'a',actorB:'b',zoneId:'art',startedAt:100,expiresAt:4100,lines:['Chào','Chào lại']};
test('alternates one visible speaker across bounded conversation',()=>{
 assert.equal(visibleDialogueLine(dialogue,'a',100),'Chào');
 assert.equal(visibleDialogueLine(dialogue,'b',100),null);
 assert.equal(visibleDialogueLine(dialogue,'a',2100),null);
 assert.equal(visibleDialogueLine(dialogue,'b',2100),'Chào lại');
 assert.equal(visibleDialogueLine(dialogue,'b',4100),null);
});
