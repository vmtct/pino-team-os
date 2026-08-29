import test from"node:test";
import assert from"node:assert/strict";
import{tosQueryParamValue}from"./tos-query-params";

test("TOS facade coerces only bounded numeric query params",()=>{
  assert.equal(tosQueryParamValue("limit","10"),10);
  assert.equal(tosQueryParamValue("limit","oops"),"oops");
  assert.equal(tosQueryParamValue("query","123"),"123");
});
