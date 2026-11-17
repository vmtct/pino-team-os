import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderV4 } from "./test-support/v4-render";

test("PAP-1753 supersedes PAP-1344 physical Station launcher with authorized logical-only FE",async()=>{
  // PAP-650 / PNR-TV Founder-approved V3.2, FSG0 PAP-1651.
  const centerId="019b1126-0001-7000-8000-000000000001";
  const html=await renderV4("TosVNextStation",{
    desktop:true,onHome:()=>{},centerName:"Cần Thơ",centerId,
    authorizedCenterIds:[centerId],initialTab:"tv",
  });
  assert.match(html,/data-tos-vnext-station="desktop"/);
  assert.match(html,/data-pnr-tv-model="logical"/);
  assert.match(html,/data-pnr-tv-source="loading"/);
  assert.match(html,/TV tại Center/);
  assert.match(html,/Đang tải danh sách TV được Core xác thực cho Center/);
  assert.doesNotMatch(html,/data-tos-station-tv-launcher|data-tv-launcher="station"/);
  assert.doesNotMatch(html,/data-pnr-tv-logical-id|data-pnr-tv-model="physical"/);
  // The previous physical TV launcher is still available for unrelated legacy
  // consumers. Retirement in this Epic is limited to the Station UI mount.
  const legacy=readFileSync("app/tv/TvLauncher.tsx","utf8");
  assert.match(legacy,/\/api\/tos-learning\/tv\/displays/);
  assert.match(legacy,/\/api\/tv\/\$\{tv\.id\}\/launch/);
  assert.match(legacy,/credentials:"same-origin"/);
  assert.doesNotMatch(legacy,/019d9880-1025-7000-8000-000000000071/);
});
test("PAP-1343 CP1 TV runtime has only ambient artwork/actors, no audience labels, metrics, footer",()=>{
  const tv=readFileSync("app/pinoria-tv/reception-tv.tsx","utf8");
  const ambient=readFileSync("app/pinoria-tv/ambient-house-runtime.tsx","utf8");
  assert.match(tv,/showText=\{false\}/);
  assert.match(tv,/data-tv-build-manifest-provenance/);
  assert.match(tv,/data-tv-connection-state/);
  assert.doesNotMatch(tv,/<header className=\{styles\.status\}>|<footer>|<section className=\{styles\.idle\}>/);
  assert.doesNotMatch(tv,/Piner đang ở House|PINORIA HOUSE IS ALIVE/);
  assert.doesNotMatch(tv,/<div className=\{styles\.copy\}>|CHÀO ĐẾN|HẸN GẶP LẠI/);
  assert.match(ambient,/\{showText \? <span>\{actor\.name\}<\/span> : null\}/);
  assert.match(ambient,/showText && dialogues\.filter/);
  assert.match(ambient,/data-ambient-runtime-character/);
  assert.match(ambient,/HOUSE_ASSETS\.back/);
});
