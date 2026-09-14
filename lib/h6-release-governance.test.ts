import test from "node:test"; import assert from "node:assert/strict"; import { readdirSync, readFileSync } from "node:fs";
const root=new URL("../",import.meta.url); const at=(path:string)=>new URL(path,root);
test("H6 release workflow scalars remain valid and Core unresolved recovery blocks mutation",()=>{
 for(const name of readdirSync(at(".github/workflows/")).filter(v=>v.endsWith(".yml"))) assert.doesNotMatch(readFileSync(at(`.github/workflows/${name}`),"utf8"),/^run-name:\s+\$\{\{/m);
 const guard=readFileSync(at("scripts/assert-no-core-verification-in-flight.sh"),"utf8"); assert.match(guard,/status=completed/); assert.match(guard,/run_attempt/);
 const release=readFileSync(at(".github/workflows/team-runtime-production-release.yml"),"utf8"); assert.match(release,/EVALUATOR_SHA/);
});
