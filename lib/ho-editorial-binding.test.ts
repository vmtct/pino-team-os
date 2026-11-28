import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
test("PAP-2404 private Editorial RPC binding exists only in exact HO Staging config",()=>{
 const files=readdirSync(".").filter(f=>/^wrangler.*\.jsonc?$/.test(f));
 const containing=files.filter(f=>readFileSync(f,"utf8").includes("PINO_HO_EDITORIAL_CORE"));
 assert.deepEqual(containing,["wrangler.ho-staging.json"]);
 const config=JSON.parse(readFileSync(containing[0]!,"utf8"));
 assert.equal(config.name,"pino-team-os-staging");
 assert.equal(config.vars.APP_ENV,"staging");
 assert.deepEqual(config.services.filter((s:{binding:string})=>s.binding==="PINO_HO_EDITORIAL_CORE"),[{binding:"PINO_HO_EDITORIAL_CORE",service:"pino-core-staging",entrypoint:"HoEditorialControlPlane"}]);
});
