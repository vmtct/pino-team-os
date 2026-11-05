import assert from "node:assert/strict";
import test from "node:test";
import { boPublicViewCoreRoute } from "./bo-public-view-route-guard";
const id="12345678-1234-4123-8123-123456789abc";
test("only expected module-scoped paths and methods pass",()=>{
  for(const [p,m] of [["views/students","GET"],["views/students","POST"],["views/students/reorder","PUT"],[`views/students/${id}`,"PATCH"],[`views/students/${id}`,"DELETE"],[`views/students/${id}/rename`,"PATCH"]] as const) assert.equal(boPublicViewCoreRoute(p,m),p);
});
test("malformed, traversal and unauthorized methods fail closed",()=>{
  for(const [p,m] of [["views/students","DELETE"],["views/students/reorder","GET"],["views/../students","GET"],["views/students/a","PATCH"],["views/students/a/rename","PATCH"],["views/students/other/deeper","PATCH"],["views/students?role=manager","GET"],["views/students","OPTIONS"]] as const) assert.equal(boPublicViewCoreRoute(p,m),null);
});