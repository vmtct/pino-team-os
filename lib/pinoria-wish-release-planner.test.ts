import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("Wish release planner encodes the approved Mid-Autumn staging preflight",()=>{
  const view=read("app/bo/pinoria-wish/WishBoView.tsx");
  assert.match(view,/mid-autumn-female-2026/);
  assert.match(view,/mid-autumn-male-2026/);
  assert.match(view,/autumn-phase-b-2026/);
  assert.match(view,/phasePeers\.length>=2/);
  assert.match(view,/mismatchedPeers\.length/);
  assert.match(view,/same Economy Rule Version|cùng Economy Rule Version/);
  assert.match(view,/Companion.*Egg\/Hatch\/Ritual/);
  assert.match(view,/Sex-neutral/);
});

test("release planner stays BO-only and does not invent a Companion Wish family",()=>{
  const view=read("app/bo/pinoria-wish/WishBoView.tsx");
  const activity=read("app/pinoria/activity-panel.tsx");
  assert.match(view,/familyKey:"LIMITED_WARDROBE"/);
  assert.doesNotMatch(view,/COMPANION_WISH|COMPANION_GACHA/);
  assert.doesNotMatch(activity,/RELEASE_PRESETS|phasePeers|autumn-phase-b-2026/);
});
