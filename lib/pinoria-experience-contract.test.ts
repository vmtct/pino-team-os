import assert from"node:assert/strict";
import test from"node:test";
import{PINORIA_EXPERIENCE_FIXTURE,PINORIA_EXPERIENCE_STAGES}from"./pinoria-experience-contract";

test("Pinoria future shell keeps the approved stage order",()=>{
  assert.deepEqual(PINORIA_EXPERIENCE_STAGES.map(stage=>stage.id),[
    "quick-choice","session","rewards","companion","ritual","ambient-house",
  ]);
});

test("Arrival remains prior context rather than a replayable stage",()=>{
  assert.equal(PINORIA_EXPERIENCE_STAGES.some(stage=>stage.id==="arrival" as never),false);
  assert.equal(PINORIA_EXPERIENCE_FIXTURE.arrival.state,"arrived");
});

test("fixture marks non-canonical rewards companion ritual and house state",()=>{
  assert.ok(PINORIA_EXPERIENCE_FIXTURE.rewards.items.every(item=>item.tag==="fixture"));
  assert.equal(PINORIA_EXPERIENCE_FIXTURE.companion.tag,"fixture");
  assert.equal(PINORIA_EXPERIENCE_FIXTURE.ritual.tag,"fixture");
  assert.equal(PINORIA_EXPERIENCE_FIXTURE.ambientHouse.tag,"fixture");
});

test("presentation contract exposes no business command function",()=>{
  const value=PINORIA_EXPERIENCE_FIXTURE as unknown as Record<string,unknown>;
  assert.equal(Object.values(value).some(item=>typeof item==="function"),false);
  const serialized=JSON.stringify(value);
  assert.equal(/check[- ]?in|check[- ]?out|insert|update|delete/i.test(serialized),false);
});
