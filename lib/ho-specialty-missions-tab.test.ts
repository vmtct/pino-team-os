import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HoSpecialtyMissionsTab } from "../app/ho/learning/specialties/HoSpecialtyMissionsTab";
import type { SpecialtyMissionOption } from "./specialty-mission-picker";

const mission:SpecialtyMissionOption={
  id:"mission-1",code:"ART-208",name:"Vẽ vật thể 3D",
  status:"ACTIVE",reconciliation:"READY",pathProgramId:"art",
};
function html(disabled=false,invalidCatalog=false){
  return renderToStaticMarkup(createElement(HoSpecialtyMissionsTab,{
    pathProgramId:"art",
    levels:[{id:"level-1",name:"Cấp 1",order:1,missionIds:["mission-1"]}],
    missionCatalog:invalidCatalog?[]:[mission],
    disabled,
    onLink:async()=>({verified:true as const,version:2}),
    onUnlink:async()=>({verified:true as const,version:3}),
    onOpenMission:()=>{},
  }));
}
test("PAP-1495: approved HO relation form is above the linked Mission table",()=>{
  const text=html();
  assert.ok(text.indexOf("Liên kết nhiệm vụ")>=0);
  assert.ok(text.indexOf("Liên kết nhiệm vụ")<text.indexOf("Nhiệm vụ liên kết"));
  assert.match(text,/Cấp 1/);
  assert.match(text,/ART-208/);
  assert.match(text,/Vẽ vật thể 3D/);
  assert.match(text,/Gỡ liên kết Vẽ vật thể 3D/);
});
test("PAP-1495: canonical Mission missing from catalog is not opened as valid",()=>{
  const text=html(false,true);
  assert.match(text,/Nhiệm vụ không tồn tại/);
  assert.match(text,/disabled=""/);
});
test("PAP-1495: readonly integration cannot link or remove until Core writer is verified",()=>{
  const text=html(true);
  assert.match(text,/Liên kết/);
  assert.match(text,/disabled=""/);
});
