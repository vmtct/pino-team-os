import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { callBoAccessCoreWithStaffPassword, type BoAccessCoreBinding } from "./bo-core";

test("PAP-1347 HO Staff Role is bound exclusively to BO Access Core and preserves Founder guard",()=>{
  const s=readFileSync("lib/ho-staff-role-facade.ts","utf8");
  const wrangler=readFileSync("wrangler.staging.jsonc","utf8");
  assert.match(s,/HoStaffRoleEnv extends HoEnv \{ PINO_BO_CORE: BoAccessCoreBinding \}/);
  assert.match(s,/import \{ callBoAccessCoreWithStaffPassword, type BoAccessCoreBinding \} from "\.\/bo-core"/);
  assert.equal((s.match(/callBoAccessCoreWithStaffPassword\(env\.PINO_BO_CORE/g)??[]).length,3);
  assert.doesNotMatch(s,/callFounderCoreWithStaffPassword|env\.PINO_CORE|PinoCoreBinding/);
  assert.match(wrangler,/"binding": "PINO_BO_CORE", "service": "pino-core-staging", "entrypoint": "BoAccessControlPlane"/);
  assert.match(s,/authorizeHoShell\(request\.headers, env\)/);
  assert.match(s,/env\.APP_ENV !== "staging"/);
  assert.match(s,/request\.headers\.get\("origin"\) !== "https:\/\/" \+ HO_STAGING_HOSTNAME/);
  assert.match(s,/if \(input\.userId === principal\.userId\)|linkedRoleUser\(/);
  assert.match(s,/idempotency-key/);
  assert.match(s,/path = "access\/assignments\/remove"/);
  assert.match(s,/path = "access\/assignments"/);
});

test("PAP-1347 BO Access binding forwards credential and canonical read without fallback to Founder plane",async()=>{
  const calls:Array<{method:string,path:string,token:string}>=[];
  const b:BoAccessCoreBinding={
    async executeWithStaffPassword(request,token) {
      calls.push({method:request.method,path:request.path,token});
      return {status:200,body:{data:[]},requestId:"pap1347-read"};
    },
  };
  const result=await callBoAccessCoreWithStaffPassword(b,{method:"GET",path:"access/users"},"synthetic-only");
  assert.equal(result.status,200);
  assert.deepEqual(calls,[{method:"GET",path:"access/users",token:"synthetic-only"}]);
});
