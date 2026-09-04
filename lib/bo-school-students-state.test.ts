import test from "node:test";
import assert from "node:assert/strict";
import { LatestRequestFence, collectPagedDirectory } from "./bo-school-students-state";

test("latest request fence rejects stale selected-Student responses",()=>{const fence=new LatestRequestFence(),a=fence.begin("a"),b=fence.begin("b");assert.equal(fence.isCurrent(a,"a"),false);assert.equal(fence.isCurrent(b,"b"),true);fence.invalidate();assert.equal(fence.isCurrent(b,"b"),false);});

test("descending keyset pagination reaches the 201st Student",async()=>{const source=Array.from({length:201},(_,index)=>({id:`student-${String(999-index).padStart(3,"0")}`}));const cursors:Array<string|undefined>=[];const rows=await collectPagedDirectory(async(before,limit)=>{cursors.push(before);const start=before?source.findIndex(row=>row.id===before)+1:0;return source.slice(start,start+limit);});assert.equal(rows.length,201);assert.equal(new Set(rows.map(row=>row.id)).size,201);assert.deepEqual(cursors,[undefined,source[199]!.id]);});

test("keyset pagination fails visibly when a backend page does not advance",async()=>{const page=Array.from({length:200},(_,index)=>({id:`student-${index}`}));await assert.rejects(()=>collectPagedDirectory(async()=>page,200,2),/did not advance/);});
