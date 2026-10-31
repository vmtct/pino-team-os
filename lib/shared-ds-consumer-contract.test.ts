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
 assert.equal(config.version,"0.3.0");
 assert.equal(config.sourceCommit,"40e40eca9383971f27682c233fd63e90a650bddf");
 assert.equal(config.tarballSha256,"01086f1432695feb67a7bab06f727adb39c0925ba18ad2535762e7370acab903");
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
