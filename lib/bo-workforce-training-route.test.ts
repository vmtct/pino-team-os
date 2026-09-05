import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("BO catch-all dispatches bounded Workforce Training GET and POST to the dedicated handler",async()=>{
  const source=await readFile("app/api/bo/[...path]/route.ts","utf8");
  const dispatch=/if \(isBoWorkforceTrainingPath\(joined\)\) return handleBoWorkforceTrainingRequest\(request, env, joined\);/g;
  assert.equal((source.match(dispatch)??[]).length,2);
  assert.ok(source.indexOf("isBoWorkforceTrainingPath(joined)")<source.indexOf("handleBoOperationalReadRequest(request, env, joined)"));
  assert.ok(source.lastIndexOf("isBoWorkforceTrainingPath(joined)")<source.indexOf("return handleBoWriteRequest(request, env, joined)"));
});
