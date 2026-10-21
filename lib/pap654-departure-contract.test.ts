import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../app/pinoria-tv/reception-tv.tsx", import.meta.url), "utf8");
test("departure uses matching source and policy-gated canonical projection", () => {
 assert.match(source, /sceneHasMatchingSource = Boolean\(scene && sceneActor && actorHasSource\(/);
 assert.match(source, /departurePath = policy\.visibleContext\.path && scene\?\.kind === "departure" && sceneHasMatchingSource/);
 assert.match(source, /departureCompanion = policy\.visibleContext\.companion && scene\?\.kind === "departure" && sceneHasMatchingSource/);
 assert.match(source, /data-departure-companion="canonical"/);
 assert.doesNotMatch(source, /departureCompanion.*(?:Mori|PLS\s*[=:]\s*[0-9])/);
});
test("departure removal is scoped to exact learner AND originating presence source", () => {
 assert.match(source, /current\.filter\(\(actor\) => actor\.pinoriaSelfId !== scene\.pinoriaSelfId\s*\|\| !actorHasSource\(actor, scene\.sourceType, scene\.sourceId\)/);
});test("departure extraction uses measured matching actor with a motion-safe fallback", () => {
 assert.match(source, /if \(!sceneHasMatchingSource\) \{ setDepartureOrigin\(null\); return; \}/);
 assert.match(source, /element\.dataset\.ambientRuntimeSelf === scene\.pinoriaSelfId/);
 assert.match(source, /setDepartureOrigin\(\{/);
 assert.match(source, /visualScene\.kind === "departure" \? departureStyle : handoffStyle/);
 const css = readFileSync(new URL("../app/pinoria-tv/reception-tv.module.css", import.meta.url), "utf8");
 assert.match(css, /@keyframes departureExtract/);
 assert.match(css, /prefers-reduced-motion:reduce\)\{\.departure \.character\{animation:none/);
});test("re-entered learner with changed source cancels stale departure", () => {
 assert.match(source, /scene\.kind === "departure" && sceneActor && !sceneHasMatchingSource \? false/);
 assert.match(source, /if \(!sceneIsCurrent\) \{/);
 assert.match(source, /queue\[0\]\?\.id === scene\.id \? queue\.slice\(1\) : queue/);
});test("repeated delivery of same presence event does not duplicate queued farewell",()=>{
 assert.match(source,/!queue\.some\(existing=>existing\.id===`\$\{event\.sequence\}`/);
 assert.match(source,/existing\.sourceType===event\.sourceType && existing\.sourceId===event\.sourceId/);
});