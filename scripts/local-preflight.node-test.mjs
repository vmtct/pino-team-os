import test from "node:test";
import assert from "node:assert/strict";
import {mismatch,plan,untrackedTrailingWhitespace} from "./local-preflight.mjs";
test("Core filesystem test must be Node, not Vitest",()=>{
 assert.equal(mismatch("scripts/tr41-migration-recovery-gate.test.mjs",'readFileSync("migration.yml")',"pino-core"),true);
 assert.equal(mismatch("scripts/tr41-migration-recovery-gate.node-test.mjs",'readFileSync("migration.yml")',"pino-core"),false);
});
test("Other test families are not mistaken for Core filesystem tests",()=>{
 assert.equal(mismatch("scripts/normal.test.mjs","assert.equal(1,1)","pino-core"),false);
 assert.equal(mismatch("scripts/foo.test.mjs","readdirSync('.')","pino-team-os"),false);
});
test("Changed files produce bounded runner and YAML plan",()=>{
 const p=plan([".github/workflows/new.yml",".github/workflows/new.yml","scripts/a.node-test.mjs","test/staff.test.ts","src/data.ts"],"pino-core");
 assert.deepEqual(p.workflows,[".github/workflows/new.yml"]);
 assert.deepEqual(p.nodeTests,["scripts/a.node-test.mjs"]);
 assert.deepEqual(p.coreTests,["test/staff.test.ts"]);
 assert.equal(p.ts,true);
});
test("Team uses its own targeted runner",()=>{
 const p=plan(["lib/bo.test.ts","test/unrelated.test.ts"],"pino-team-os");
 assert.deepEqual(p.teamTests,["lib/bo.test.ts"]);
 assert.deepEqual(p.coreTests,[]);
});

test("Untracked whitespace fails; binary and clean text pass",()=>{
 assert.equal(untrackedTrailingWhitespace(Buffer.from("bad  \n")),true);
 assert.equal(untrackedTrailingWhitespace(Buffer.from("clean\n")),false);
 assert.equal(untrackedTrailingWhitespace(Buffer.from([0,32,32,10])),false);
});
