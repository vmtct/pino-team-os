import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
test("PAP-2387 native Parent M1 entry preserves isolated renderer and async Detail",()=>{
 const entry=readFileSync("scripts/native-m1-local/parent-entry.tsx","utf8"),tabs=readFileSync("app/bo/components/registration/BoParentReadTabs.tsx","utf8"),context=readFileSync("app/bo/parents/parent-m1-context.tsx","utf8");
 assert.ok(entry.includes("content={<ParentDirectoryDsa/>}"));
 assert.ok(entry.includes("ephemeral:true,readOnly:true"));
 assert.ok(entry.includes('load:async()=>{throw Error("No live transport")'));
 assert.ok(context.includes('self.origin!=="null"'));
 assert.ok(tabs.includes("await Promise.resolve();const value=fixture.detail"));
});
