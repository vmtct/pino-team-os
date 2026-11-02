import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderV4 } from "./test-support/v4-render";

test("PAP-1344 Station TV uses existing desktop shell and shared authorized TV Launcher, not fake disabled preview",async()=>{
  const html=await renderV4("TosVNextStation",{desktop:true,onHome:()=>{},centerName:"Cần Thơ",initialTab:"tv"});
  assert.match(html,/data-tos-vnext-station="desktop"/);
  assert.match(html,/data-tos-station-tv-launcher="true"/);
  assert.match(html,/data-tv-launcher="station"/);
  assert.match(html,/Đang tải danh sách TV/);
  assert.doesNotMatch(html,/KHÔNG KẾT NỐI TV THẬT|CHƯA XÁC MINH DỮ LIỆU TV/);
  const launcher=readFileSync("app/tv/TvLauncher.tsx","utf8");
  assert.match(launcher,/\/api\/tos-learning\/tv\/displays/);
  assert.match(launcher,/\/api\/tv\/\$\{tv\.id\}\/launch/);
  assert.match(launcher,/credentials:"same-origin"/);
  assert.match(launcher,/window\.location\.assign/);
  assert.doesNotMatch(launcher,/019d9880-1025-7000-8000-000000000071/);
});
test("PAP-1343 CP1 TV runtime has only ambient artwork/actors, no audience labels, metrics, footer",()=>{
  const tv=readFileSync("app/pinoria-tv/reception-tv.tsx","utf8");
  const ambient=readFileSync("app/pinoria-tv/ambient-house-runtime.tsx","utf8");
  assert.match(tv,/showText=\{false\}/);
  assert.match(tv,/data-tv-build-manifest-provenance/);
  assert.match(tv,/data-tv-connection-state/);
  assert.doesNotMatch(tv,/<header className=\{styles\.status\}>|<footer>|<section className=\{styles\.idle\}>/);
  assert.doesNotMatch(tv,/Piner đang ở House|PINORIA HOUSE IS ALIVE/);
  assert.match(ambient,/\{showText \? <span>\{actor\.name\}<\/span> : null\}/);
  assert.match(ambient,/showText && dialogues\.filter/);
  assert.match(ambient,/data-ambient-runtime-character/);
  assert.match(ambient,/HOUSE_ASSETS\.back/);
});
