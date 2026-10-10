import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("PAP-448 BO catch-all dispatches Syllabus media GET list and preview through the scoped special handler", async () => {
  const source = await readFile("app/api/bo/[...path]/route.ts", "utf8");
  const dispatch = 'if (joined === "learning/syllabi/media" || /^learning\\/syllabi\\/media\\/[0-9a-f-]{36}\\/preview$/.test(joined)) return handleBoSyllabusMediaRequest(request, env, joined);';
  assert.ok(source.includes(dispatch));
  assert.ok(source.indexOf(dispatch) < source.indexOf("return handleBoOperationalReadRequest(request, env, joined)"));
});
