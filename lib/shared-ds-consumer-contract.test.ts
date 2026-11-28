import { test } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TableFrame, DrawerFrame, DetailFrame, TosCard, TosButton, TosBottomNav } from "@pino/design-system/react";
const require = createRequire(import.meta.url);
const config=JSON.parse(readFileSync(resolve("config/pino-shared-ds-consumer.json"),"utf8"));
test("PAP-1170 PINO package exact artifact",()=>{
 const archive=readFileSync(resolve(config.vendoredTarball));
 assert.equal(createHash("sha256").update(archive).digest("hex"),config.tarballSha256);
 const manifest=JSON.parse(readFileSync(require.resolve("@pino/design-system/manifest.json"),"utf8"));
 assert.equal(manifest.version,config.version);
 // PAP-2363 / PLT-LEAD: pin exact released artifact and retain every historical digest.
 const expected = [
   [
     "0.4.4",
     "77bd9b23a85e6d9167a14bb7ea8f7385411de424",
     "577d43110b781afd954a1d3d3eb3d5dac53e4f",
     9,
     "b9b3c59eab59fe820727e4c1fdeafe71390b6e8fd6757830aaa72cf0902bad54"
   ],
   [
     "0.4.3",
     "9af10aa2df5f64b6bf74f96eac8e12171bf26e0a",
     "2427d0c5b92e62542f8e185f0a90fa887b402156",
     8,
     "5aff8cd7c77aa2d30fbb671b039ad6b1c4406645dbf7df93a7efe3a59237fc87"
   ],
   [
     "0.4.2",
     "db034e81fba8aaccf7c63b98de9e5dc07cb55ffa",
     "10ed47b028d5f77702a0051154cdb6cec1b0ed5b",
     7,
     "77a0a6e1cd5f56e431788407600fe19b79d48f55c57df6fd9ea86e880d7fb799"
   ],
   [
     "0.4.1",
     "5590b5205effcc0ade93ac3fcb55c07a4ecf135f",
     "72637d7a0e0ae92d97541c23b2c438b52391a4df",
     6,
     "e2eed0afb3dc39ff943a7b57bedf444e1523aa3100bd55d090b186502369f7d8"
   ],
   [
     "0.3.0",
     "906e4a38070169223df7fc21ed841f5d57111362",
     "ce28e29f3c657251679b9577889730bcdd9e9542",
     4,
     "2b7cd14fed8804685379facc0f92f82008d4bc2f825974c34ee20af4deeca6d5"
   ]
 ] as const;
 let release=config;
 for(const [version,sourceCommit,sourceMainSha,pr,digest] of expected){
  assert.ok(release,version);
  assert.equal(release.version,version);
  assert.equal(release.sourceCommit,sourceCommit);
  assert.equal(release.sourceMainSha,sourceMainSha);
  assert.equal(release.sourcePullRequest,"https://github.com/vmtct/pino-design-system/pull/"+pr);
  assert.equal(release.vendoredTarball,"vendor/pino-design-system/pino-design-system-"+version+".tgz");
  assert.equal(release.tarballSha256,digest);
  assert.equal(createHash("sha256").update(readFileSync(resolve(release.vendoredTarball))).digest("hex"),digest);
  release=release.previousRelease;
 }
 assert.equal(release,undefined);
 assert.equal(manifest.sourceOwner,"PINO");
});
test("PAP-1170 shared TDD and TOS React SSR",()=>{
 const markup=renderToStaticMarkup(h("div",null,
  h(TableFrame,{caption:"Demo",columns:[{key:"name",label:"Name"}],rows:[{name:"Fixture"}]}),
  h(DetailFrame,{title:"Fixture",tabs:[{id:"overview",label:"Tổng quan"}],selected:"overview",children:"detail"}),
  h(DrawerFrame,{title:"Fixture",onClose:()=>{},children:"drawer"}),
  h(TosCard,null,h(TosButton,null,"Open")),
  h(TosBottomNav,{items:[{id:"today",label:"Hôm nay"}],active:"today",onChange:()=>{}})
 ));
 for(const marker of ['data-pds-component="table"','data-pds-component="detail"','aria-modal="true"','data-pds-component="tos-card"','data-pds-component="tos-bottom-nav"'])assert.ok(markup.includes(marker),marker);
});
