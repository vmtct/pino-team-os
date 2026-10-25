import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyBoV23Foundation } from "./verify-bo-v23-foundation.mjs";

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const PATHS=[
 "app/bo/design-system/foundation.css",
 "app/bo/layout.tsx",
 "app/components/tos-shell/BoShell.tsx",
 "app/components/tos-shell/bo-shell.module.css",
 "app/bo/components/data-grid/bo-data-grid.module.css",
 "app/layout.tsx",
 ".github/workflows/pr-validation.yml",
 "scripts/build-bo-public-views.mjs"
];
function fixture(fn){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"pap874-bo-foundation-"));
 const read=p=>fs.readFileSync(path.join(root,p),"utf8");
 const write=(p,s)=>{const full=path.join(root,p);fs.mkdirSync(path.dirname(full),{recursive:true});fs.writeFileSync(full,s)};
 for(const p of PATHS)write(p,fs.readFileSync(path.join(repo,p),"utf8"));
 try{return fn({root,read,write})}finally{fs.rmSync(root,{recursive:true,force:true})}
}
const check=fn=>fixture(({root,read,write})=>{
 fn({read,write});
 return verifyBoV23Foundation(root).issues;
});
test("PAP-874 BO scoped Foundation Lock current source PASS",()=>{
 const result=verifyBoV23Foundation(repo);
 assert.deepEqual(result.issues,[]);
 assert.ok(result.tokens>=40);
 assert.equal(result.scope,"BO_ONLY");
 assert.equal(result.certification,"SOURCE_FOUNDATION_PASS_NOT_UI_PARITY");
});
test("required semantic color or spacing token removal FAILS",()=>{
 const errors=check(({read,write})=>{
  const p=PATHS[0];
  write(p,read(p).replace("  --bo-v23-space-2: 8px;",""));
 });
 assert.ok(errors.some(x=>x.includes("Missing required BO foundation token: --bo-v23-space-2")));
});
test("unapproved typography/density change FAILS against Founder target",()=>{
 const errors=check(({read,write})=>{
  const p=PATHS[0];
  write(p,read(p).replace("--bo-v23-font-display: 30px","--bo-v23-font-display: 31px"));
 });
 assert.ok(errors.some(x=>x.includes("Founder V2.3 density target drift: --bo-v23-font-display")));
});
test("global :root or second rule is rejected (TOS/Founder safety)",()=>{
 const errors=check(({read,write})=>{
  const p=PATHS[0];
  write(p,read(p)+"\n:root { --bo-v23-space-1: 4px; }\n");
 });
 assert.ok(errors.some(x=>x.includes("must be one scoped")));
});
test("BO layout missing legacy CSS distribution FAILS",()=>{
 const errors=check(({read,write})=>{
  const p=PATHS[1];
  write(p,read(p).replace('<link rel="stylesheet" href="/bo-legacy-foundation.css" />',""));
 });
 assert.ok(errors.some(x=>x.includes("BO layout must import")));
});
test("legacy stylesheet without exact canonical byte-copy mapping FAILS",()=>{
 const errors=check(({read,write})=>{
  const p="scripts/build-bo-public-views.mjs";
  write(p,read(p).replace("copyFile('app/bo/design-system/foundation.css','public/bo-legacy-foundation.css')","copyFile('unapproved.css','public/bo-legacy-foundation.css')"));
 });
 assert.ok(errors.some(x=>x.includes("BO layout must import")));
});
test("no BO shell marker FAILS; cannot assume global CSS inheritance",()=>{
 const errors=check(({read,write})=>{
  const p=PATHS[2];
  write(p,read(p).replace('data-bo-design-system="v23"',""));
 });
 assert.ok(errors.some(x=>x.includes("BO shell missing v23 scope")));
});
test("global root layout acquiring BO tokens FAILS closed",()=>{
 const errors=check(({read,write})=>{
  const p=PATHS[5];
  write(p,read(p)+'\nimport "./bo/design-system/foundation.css";\n');
 });
 assert.ok(errors.some(x=>x.includes("Root app layout must not")));
});
test("fallback value drift is rejected, preventing accidental legacy restyle",()=>{
 const errors=check(({read,write})=>{
  const p=PATHS[3];
  write(p,read(p).replace("--bo-v23-color-accent, #6f5bd6","--bo-v23-color-accent, #123456"));
 });
 assert.ok(errors.some(x=>x.includes("Missing or visually changed BO bridge")));
});
test("bridge token value differing from runtime fallback FAILS",()=>{
 const errors=check(({read,write})=>{
  const p=PATHS[0];
  write(p,read(p).replace("--bo-v23-color-accent: #6f5bd6","--bo-v23-color-accent: #ffffff"));
 });
 assert.ok(errors.some(x=>x.includes("Token differs from backward-compatible fallback")));
});
test("legacy Grid alias removed FAILS",()=>{
 const errors=check(({read,write})=>{
  const p=PATHS[4];
  write(p,read(p).replace("var(--bo-v23-color-border, #e2e1e5)","#e2e1e5"));
 });
 assert.ok(errors.some(x=>x.includes("Missing or visually changed BO bridge")));
});
test("new tokens require schema approval, not loose CSS append",()=>{
 const errors=check(({read,write})=>{
  const p=PATHS[0];
  write(p,read(p).replace("  --bo-v23-radius-popover: 9px;","  --bo-v23-radius-popover: 9px;\n  --bo-v23-unknown-token: 42px;"));
 });
 assert.ok(errors.some(x=>x.includes("Unreviewed extra BO token")));
});
test("CI must keep this source verifier and regression tests",()=>{
 const errors=check(({read,write})=>{
  const p=PATHS[6];
  write(p,read(p).replace("node --test scripts/verify-bo-v23-foundation.test.mjs","node --test scripts/unused.test.mjs"));
 });
 assert.ok(errors.some(x=>x.includes("Required CI foundation verification missing")));
});
