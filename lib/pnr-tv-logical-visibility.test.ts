/** PAP-1753 / PAP-650 PNR-TV — logical Center visibility and deny-by-default. */
import assert from "node:assert/strict";
import test from "node:test";
import { visibleLogicalTvs, type LogicalTvListItem } from "./pnr-tv-logical-visibility";

const centerA = "019b1126-0001-7000-8000-000000000001";
const centerB = "019b1126-0001-7000-8000-000000000002";
const centerC = "019b1126-0001-7000-8000-000000000003";
const shared: LogicalTvListItem = {
  tvId: "logical-tv-one", name: "PINO TV — DEFAULT",
  visibilityScope: "CENTER", centerIds: [centerA, centerB],
};
const ids=(rows: readonly LogicalTvListItem[])=>rows.map(r=>r.tvId);
test("same logical TV is listed in A/B but not unassigned C", ()=>{
  assert.deepEqual(ids(visibleLogicalTvs([shared],centerA,[centerA,centerB,centerC])),["logical-tv-one"]);
  assert.deepEqual(ids(visibleLogicalTvs([shared],centerB,[centerA,centerB,centerC])),["logical-tv-one"]);
  assert.deepEqual(ids(visibleLogicalTvs([shared],centerC,[centerA,centerB,centerC])),[]);
});
test("removing A preserves B and never creates another TV ID",()=>{
  const edited={...shared,centerIds:[centerB]};
  assert.deepEqual(ids(visibleLogicalTvs([edited],centerA,[centerA,centerB])),[]);
  assert.deepEqual(ids(visibleLogicalTvs([edited],centerB,[centerA,centerB])),["logical-tv-one"]);
});
test("DEFAULT list-visible across authorized Centers; CENTER empty means hidden",()=>{
  const def={...shared,visibilityScope:"DEFAULT" as const,centerIds:[]};
  assert.deepEqual(ids(visibleLogicalTvs([def],centerC,[centerA,centerC])),["logical-tv-one"]);
  assert.deepEqual(visibleLogicalTvs([{...shared,centerIds:[]}],centerB,[centerB]),[]);
});
test("unknown or unauthorized Center fails closed irrespective of frontend arguments",()=>{
  assert.deepEqual(visibleLogicalTvs([shared],null,[centerA]),[]);
  assert.deepEqual(visibleLogicalTvs([shared],centerB,[centerA]),[]);
  assert.deepEqual(visibleLogicalTvs([shared],"Cần Thơ",[centerA]),[]);
  assert.deepEqual(visibleLogicalTvs([shared],centerA,[]),[]);
});
test("never confuse physical scope or duplicate identities with logical listing",()=>{
  const bad={...shared,visibilityScope:"GLOBAL" as "DEFAULT"};
  assert.deepEqual(visibleLogicalTvs([bad],centerA,[centerA]),[]);
  assert.deepEqual(ids(visibleLogicalTvs([shared,shared],centerA,[centerA])),["logical-tv-one"]);
  assert.deepEqual(visibleLogicalTvs([{...shared,tvId:""}],centerA,[centerA]),[]);
});
