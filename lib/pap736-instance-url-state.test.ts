import assert from "node:assert/strict";
import {test} from "node:test";
import {parseInstanceGridParams,writeInstanceGridParams,DEFAULT_INSTANCE_GRID} from "./pap736-instance-url-state";
test("instance URL round-trip preserves unrelated World Builder navigation",()=>{
 const raw=new URLSearchParams("view=instances&world=world-123&legacy=q");
 const state={...DEFAULT_INSTANCE_GRID,query:"student",status:"REVOKED" as const,worldId:"world-123",page:3,size:50 as const,sortKey:"studentName" as const,sortDirection:"asc" as const,instanceId:"instance-456"};
 const params=writeInstanceGridParams(raw,state);
 assert.equal(params.get("view"),"instances");assert.equal(params.get("world"),"world-123");assert.equal(params.get("legacy"),"q");
 assert.deepEqual(parseInstanceGridParams(params),state);
});
test("invalid URL params are bounded and never yield invalid backend options",()=>{
 const parsed=parseInstanceGridParams(new URLSearchParams("i_page=-4&i_size=4000&i_sort=drop&i_status=UNKNOWN&i_dir=SIDEWAYS"));
 assert.equal(parsed.page,1);assert.equal(parsed.size,25);assert.equal(parsed.sortKey,"grantedAt");assert.equal(parsed.status,"");assert.equal(parsed.sortDirection,"desc");
});
