import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRequire } from "node:module";
const requireCss = createRequire(import.meta.url);
const cssPath = requireCss.resolve("../app/ho/learning/specialties/HoSpecialtyMissionsTab.module.css");
const pickerCssPath = requireCss.resolve("../app/ho/learning/specialties/SpecialtyMissionPicker.module.css");
const previousCss = requireCss.extensions[".css"];
requireCss.extensions[".css"] = (module, file) => {
  if (file === pickerCssPath) { module.exports = {field:"field"}; return; }
  if (file !== cssPath) { if (previousCss) return previousCss(module, file); throw new Error("Unexpected CSS import: "+file); }
  module.exports = {"stack":"stack","form":"form","field":"field","heading":"heading","list":"list","row":"row","identity":"identity"};
};
const { HoSpecialtyMissionsTab } = (() => {
  try { return requireCss("../app/ho/learning/specialties/HoSpecialtyMissionsTab") as typeof import("../app/ho/learning/specialties/HoSpecialtyMissionsTab"); }
  finally { if (previousCss) requireCss.extensions[".css"] = previousCss; else delete requireCss.extensions[".css"]; }
})();
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
  assert.match(text,/class="primary-btn"[^>]*disabled=""/);
  assert.match(text,/class="option-item"[^>]*>Vẽ vật thể 3D/);
  assert.match(text,/class="form" data-specialty-link-form="true"/);
  assert.match(text,/<div class="field"><label class="pds-property-label"[^>]*>Nhiệm vụ<\/label><input[^>]*role="combobox"/);
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
