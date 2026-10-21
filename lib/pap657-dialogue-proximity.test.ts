import test from 'node:test';
import assert from 'node:assert/strict';
import {nearbyDialoguePairs} from './pap657-dialogue-proximity.ts';
const actors=[{id:'a',zoneId:'art',x:0,y:0},{id:'b',zoneId:'art',x:40,y:30},{id:'c',zoneId:'piano',x:1,y:1},{id:'d',zoneId:'art',x:200,y:200}];
test('pairs only valid actors inside same zone and proximity',()=>{
 assert.deepEqual(nearbyDialoguePairs(actors,90),[{actorA:'a',actorB:'b',zoneId:'art'}]);
});
test('invalid coordinates and unknown policy distance fail closed',()=>{
 assert.deepEqual(nearbyDialoguePairs(actors,999),[]);
 assert.deepEqual(nearbyDialoguePairs([{...actors[0],x:NaN},actors[1]],90),[]);
 assert.deepEqual(nearbyDialoguePairs([{...actors[0],zoneId:'unsafe zone'},actors[1]],90),[]);
});
