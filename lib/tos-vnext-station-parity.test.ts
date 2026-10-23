import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {STATION_DESKTOP_TABS} from "./tos-vnext-station";
const station=readFileSync(new URL("../app/components/tos-vnext/TosVNextStation.tsx",import.meta.url),"utf8");
test("PAP-943 station uses full desktop shell with five canonical workspaces",()=>{
 assert.deepEqual(STATION_DESKTOP_TABS.map(x=>x.id),["overview","pinoria","students","devices","tv"]);
 assert.match(station,/if\(!desktop\)return/);
 assert.match(station,/data-tos-vnext-station="desktop"/);
 assert.match(station,/className=\{styles\.stationSidebar\}/);
 assert.match(station,/className=\{styles\.stationWorkspace\}/);
});
test("PAP-943 unverified device and TV actions stay disabled until Core truth",()=>{
 assert.match(station,/tab==="devices"\|\|tab==="tv"/);
 assert.match(station,/stationDisabledAction\} disabled/);
 assert.match(station,/Chưa có xác nhận dữ liệu\/command/);
});
