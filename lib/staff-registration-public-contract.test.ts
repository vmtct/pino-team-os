import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("public Staff registration status exposes only the intake decision", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "app/api/staff-registration/route.ts"),
    "utf8",
  );
  assert.match(source, /data: \{ enabled: state\.enabled \}/);
  assert.doesNotMatch(source, /data: state/);
  assert.doesNotMatch(source, /updatedByUserId|version: state\.version|updatedAt: state\.updatedAt/);
});
