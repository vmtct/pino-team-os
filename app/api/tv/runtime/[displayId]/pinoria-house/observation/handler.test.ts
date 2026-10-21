import assert from "node:assert/strict";
import {test} from "node:test";
import {handleRuntimeObservation} from "./handler";

const response=(status:number,body:unknown)=>({status,body,requestId:"test-request"});
test("rejects missing runtime session before Core",async()=>{
  let calls=0;
  const result=await handleRuntimeObservation("","display",{}, {validateRuntimeObservation:async()=>{calls++;return response(200,{})}});
  assert.equal(result.status,401);assert.equal(calls,0);
});
test("rejects malformed telemetry before Core",async()=>{
  let calls=0;
  const result=await handleRuntimeObservation("session","display",null,{validateRuntimeObservation:async()=>{calls++;return response(200,{})}});
  assert.equal(result.status,400);assert.equal(calls,0);
});
test("delegates unchanged session and report to Core and preserves denial",async()=>{
  const report={sessionId:"foreign-session",rendererAcknowledged:true};
  let actual:unknown[];
  const result=await handleRuntimeObservation("opaque-session","display",report,{
    validateRuntimeObservation:async(...args)=>{actual=args;return response(400,{error:{code:"INVALID_INPUT"}});}
  });
  assert.deepEqual(actual!,["opaque-session","display",report]);
  assert.equal(result.status,400);assert.equal(result.headers.get("cache-control"),"no-store");
});
test("Core outage is not reported as a renderer ACK",async()=>{
  const result=await handleRuntimeObservation("session","display",{},{
    validateRuntimeObservation:async()=>{throw new Error("down");}
  });
  assert.equal(result.status,503);
});
