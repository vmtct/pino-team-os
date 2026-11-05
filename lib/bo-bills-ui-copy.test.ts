import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";

const component = readFileSync(fileURLToPath(new URL("../app/bo/bills/BoBillsTdd.tsx", import.meta.url)), "utf8");

test("PAP-1512: BO Bills Table contains no implementation or legacy API narration", () => {
 assert.doesNotMatch(component, /<p role="note">/u);
 assert.doesNotMatch(component, /API danh s|Bills c.u ngo.i Draft|t.i .a 100 Draft/iu);
});

test("PAP-1512: real authorization, loading and retry messages remain available", () => {
 assert.match(component, /role="alert"/u);
 assert.match(component, /role="status"/u);
 assert.match(component, /Thử lại/u);
 assert.match(component, /<SurfaceWorkspace/u);
});
