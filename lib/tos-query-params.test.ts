import test from"node:test";
import assert from"node:assert/strict";
import{tosQueryParamValue}from"./tos-query-params";

test("TOS facade coerces only bounded numeric query params",()=>{
  assert.equal(tosQueryParamValue("limit","10"),10);
  assert.equal(tosQueryParamValue("limit","oops"),"oops");
  assert.equal(tosQueryParamValue("query","123"),"123");
});

test("House Ambient event cursor is translated only for the authenticated event route",()=>{
  const path="pinoria/tv-policies/house-ambient/events";
  assert.equal(tosQueryParamValue("after","0",path),0);
  assert.equal(tosQueryParamValue("after","42",path),42);
  for(const invalid of [""," ","-1","1e2","1.5","9007199254740992"]){
    assert.equal(tosQueryParamValue("after",invalid,path),invalid);
  }
  assert.equal(tosQueryParamValue("after","42","pinoria/tv-policies/house-ambient/snapshot"),"42");
});
