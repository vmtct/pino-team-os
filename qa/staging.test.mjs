import {test} from "node:test";
import assert from "node:assert/strict";
import {verifyJourney} from "./staging.mjs";

const proof = () => ({authorized:true, actorId:"synthetic-actor", scope:"synthetic-center", teamSha:"a".repeat(40), coreSha:"b".repeat(40)});
async function scenario({fail=false, write=false, after, before=proof(), readError=false} = {}) {
  let ran=0, reads=0;
  const outcome=await verifyJourney({
    before,
    run:async () => {ran++; if(fail) throw Error("synthetic journey");},
    readback:async () => {reads++; if(readError) throw Error("synthetic unavailable"); return after ?? proof();},
    hasUnexpectedWrite:() => write
  });
  return {outcome,ran,reads};
}
test("successful native journey requires matching post-proof", async () => {
  assert.deepEqual(await scenario(), {outcome:{phase:"readback",result:"PASS"},ran:1,reads:1});
});
test("journey error still obtains post-proof before reporting FAIL", async () => {
  assert.deepEqual(await scenario({fail:true}), {outcome:{phase:"journey",result:"FAIL"},ran:1,reads:1});
});
test("serving, actor, scope or authorization drift blocks both success and failures", async () => {
  for(const fail of [false,true]) for(const delta of [
    {teamSha:"c".repeat(40)}, {coreSha:"d".repeat(40)}, {actorId:"other"}, {scope:"other"},
    {authorized:false}, {teamSha:"missing"}
  ]) {
    assert.deepEqual(await scenario({fail,after:{...proof(),...delta}}),
      {outcome:{phase:"readback",result:"BLOCKED"},ran:1,reads:1});
  }
});
test("missing readback blocks even a failing journey or attempted write", async () => {
  for(const fail of [false,true]) {
    assert.deepEqual(await scenario({fail,write:true,readError:true}),
      {outcome:{phase:"readback",result:"BLOCKED"},ran:1,reads:1});
  }
});
test("unexpected write with stable proof fails the journey", async () => {
  assert.deepEqual(await scenario({write:true}), {outcome:{phase:"journey",result:"FAIL"},ran:1,reads:1});
});
test("invalid initial admission performs no journey or post-read", async () => {
  assert.deepEqual(await scenario({before:{...proof(),authorized:false}}),
    {outcome:{phase:"admission",result:"BLOCKED"},ran:0,reads:0});
});
