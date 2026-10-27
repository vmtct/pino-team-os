import test from "node:test";
import assert from "node:assert/strict";
import {STATION_DESKTOP_TABS,stationHasVerifiedDeviceControl} from "./tos-vnext-station";
import {SIX_TOS_APPS} from "../app/components/tos-vnext/identity";
test("PAP-943 Station desktop has exactly the approved five sections",()=>{
 assert.deepEqual(STATION_DESKTOP_TABS.map(t=>t.id),["overview","pinoria","students","devices","tv"]);
 assert.equal(new Set(STATION_DESKTOP_TABS.map(t=>t.id)).size,5);
 assert.equal(SIX_TOS_APPS.find(a=>a.id==="station")?.mode,"desktop");
});
test("PAP-943 never enables fake device/TV commands before Core contract",()=>{
 assert.equal(stationHasVerifiedDeviceControl,false);
});
