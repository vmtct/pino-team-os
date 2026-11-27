// PAP-2377: deterministic build-time synthetic content only; never imported by Worker.
import {mockProjection} from "../test/portfolio-fixture.mjs";
import {createHash} from "node:crypto";
import {writeFileSync,readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
const revision="a478a508612c3455f7237740c5e93ba6cb90c911";
const sha=b=>createHash("sha256").update(b).digest("hex");
for(const p of ["piner-shell/test/portfolio-fixture.mjs","piner-shell/src/view.mjs","piner-shell/src/portfolio-view.mjs","piner-shell/src/portfolio-styles.mjs","piner-shell/src/portfolio-client.mjs","piner-shell/src/styles.mjs","piner-shell/src/client.mjs","piner-shell/src/adapter.mjs"]){
  if(sha(readFileSync(p))!==sha(execFileSync("git",["show",revision+":"+p])))throw Error("Approved source mismatch: "+p);
}
const artifacts={}, registrations={};
for(const [route,space] of [["/piner/house","house"],["/piner/house/grid","house"],["/piner/mytime","mytime"],["/piner/mytime/grid","mytime"]]){
 const model=mockProjection(space);
 if(model.posts.length!==1||model.posts[0].key!=="PORTFOLIO-MOCK-001"||model.posts[0].synthetic!==true)throw Error("Invalid fixture");
 const photoCount=model.posts[0].media.length;
 const data={route,fixtureId:"PORTFOLIO-MOCK-001",photoCount,sourceRevision:revision,space,posts:model.posts};
 const bytes=JSON.stringify(data);
 artifacts[route]=bytes;
 registrations[route]={route,fixtureId:data.fixtureId,photoCount,sourceRevision:revision,sha256:sha(bytes)};
}
const text="// Generated static synthetic artifact; PAP-2377; no member or session identity.\nexport const approvedSourceRevision="+JSON.stringify(revision)+";\nexport const registrations=Object.freeze("+JSON.stringify(registrations,null,2)+");\nexport const artifacts=Object.freeze("+JSON.stringify(artifacts,null,2)+");\n";
const out="piner-shell/src/static-review-artifacts.mjs";
if(process.argv.includes("--check")){if(readFileSync(out,"utf8")!==text)throw Error("Static artifact drift");}
else writeFileSync(out,text);
