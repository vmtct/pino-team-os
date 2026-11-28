import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import {ASSIGNMENT_M1_CENTER,ASSIGNMENT_M1_ROUTE} from "../app/bo/missions/assignment-m1-fixture";
test("PAP-2428 exact synthetic route pair only under original opaque local guard",()=>{
 const source=readFileSync("app/bo/components/registration/BoCenterSelection.tsx","utf8");
 const guard=source.split("export function BoLocalReviewCenter")[1]?.split("return <Context.Provider")[0]??"";
 assert.match(guard,/typeof window==="undefined"\|\|self.origin!=="null"/);
 assert.match(guard,/http:\/\/desktop-isrdren:8800/);
 assert.match(guard,/\(location.pathname==="\/bo\/missions"&&center.id==="ASSIGNMENT-MOCK-CENTER"\)/);
 assert.equal(ASSIGNMENT_M1_CENTER,"ASSIGNMENT-MOCK-CENTER");
 assert.equal(ASSIGNMENT_M1_ROUTE,"/bo/missions");
 const entry=readFileSync("scripts/native-m1-local/assignment-entry.tsx","utf8");
 assert.match(entry,/<BoLocalReviewCenter center=\{\{id:ASSIGNMENT_M1_CENTER,/);
 assert.match(entry,/self.origin!=="null"/);
 assert.match(entry,/throw Error\("No live transport"\)/);
});
