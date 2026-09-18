import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("WFM-TIME-BO F1 stays a BO read-only split view over Core facts",async()=>{
 const [view,api,handler,nav,note]=await Promise.all([readFile("app/bo/workforce/timekeeping/TimekeepingView.tsx","utf8"),readFile("lib/bo-api.ts","utf8"),readFile("lib/bo-read-handler.ts","utf8"),readFile("app/bo/navigation.ts","utf8"),readFile("docs/implementation-notes/wfm-time-bo-f1.md","utf8")]);
 assert.match(nav,/\/bo\/workforce\/timekeeping/);
 assert.match(api,/timekeeping:[\s\S]*workforce\/timekeeping/);
 assert.match(handler,/path === "workforce\/timekeeping"/);
 assert.match(view,/Today/); assert.match(view,/History/); assert.match(view,/TimekeepingSession/); assert.match(view,/Recorded/); assert.match(view,/Assignment linkage/); assert.match(view,/durationSeconds/);
 assert.doesNotMatch(view,/checkOutAt\s*[-+]\s*checkInAt|Date\.parse\(row\.checkOutAt|\/api\/workforce|checkIn\(|checkOut\(|method:\s*["']POST/);
 assert.match(note,/surface: BO/); assert.match(note,/primary_device: DESKTOP/); assert.match(note,/primary_layout: SPLIT_VIEW/); assert.match(note,/staff\.timekeeping\.view/);
});
