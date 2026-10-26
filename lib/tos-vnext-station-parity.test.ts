import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {renderV4,buttons} from "./test-support/v4-render";
import {unavailableOpsReadModel} from "./tos-ops-v4-view-model";
const props={onHome:()=>{},desktop:true,centerName:"Cơ sở được cấp quyền"};
test("PAP-943 V4 five workspaces render unknown Core facts without synthetic inventory",async()=>{
 for(const initialTab of ["overview","pinoria","students","devices","tv"]){
  const html=await renderV4("TosVNextStation",{...props,initialTab});
  assert.match(html,/data-tos-vnext-station="desktop"/);assert.match(html,/Cơ sở được cấp quyền/);assert.match(html,/Chưa xác minh node/);
  assert.doesNotMatch(html,/NODE-DEMO|PINO-HOUSE-01|Chroma Sea|Region mẫu/);
 }
 const html=await renderV4("TosVNextStation",props);assert.equal((html.match(/<strong>—<\/strong>/g)||[]).length,4);
});
test("PAP-943 supplied inventory cannot enable Wardrobe and device commands",async()=>{
 const model={...unavailableOpsReadModel(),loaded:true,outfits:["Test outfit"],assetNames:["Test device"],equipment:{"Test device":"Cần kiểm tra"}};
 const before=JSON.stringify(model);const html=await renderV4("TosVNextStation",{...props,model,initialTab:"pinoria"});
 assert.match(buttons(html,"Test outfit")[0],/disabled/);assert.equal(JSON.stringify(model),before);
 const source=readFileSync("app/components/tos-vnext/TosVNextStation.tsx","utf8");assert.doesNotMatch(source,/useOpsDemo|ops-demo-store|localStorage|fetch\(/);
});
