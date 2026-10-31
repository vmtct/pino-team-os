import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { approvedSuccessorImages } from "./tdd-g3-golden-successor.mjs";

const root = new URL("../docs/visual-goldens/pap1073/successor-41071808375/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", root), "utf8"));
const readAsset = path => readFileSync(new URL(path, root));

test("approved successor selects only two exact Linux CI mobile Table PNGs", () => {
  const images = approvedSuccessorImages(manifest, readAsset);
  assert.deepEqual([...images.keys()].sort(), ["ho/320/table.png", "ho/390/table.png"]);
  for (const path of ["bo/390/table.png", "ho/390/drawer.png", "ho/1440/table.png"]) assert.equal(images.has(path), false);
});

for (const key of ["schemaVersion", "sourceRun", "sourceSha", "artifactId", "artifactName", "founderApprovalDate", "approvalIssue", "approvalComment"]) {
  test(`successor rejects changed or absent ${key}`, () => {
    assert.throws(() => approvedSuccessorImages({ ...manifest, [key]: "unapproved" }, readAsset));
    assert.throws(() => approvedSuccessorImages({ ...manifest, [key]: undefined }, readAsset));
  });
}

test("successor rejects extra, missing, duplicate, foreign and traversal paths before reading", () => {
  for (const files of [[], manifest.files.slice(0, 1), [...manifest.files, manifest.files[0]], [manifest.files[0], manifest.files[0]], [{ ...manifest.files[0], path: "bo/390/table.png" }, manifest.files[1]], [{ ...manifest.files[0], path: "../manifest.json" }, manifest.files[1]]]) {
    assert.throws(() => approvedSuccessorImages({ ...manifest, files }, readAsset));
  }
});

test("candidate manifest cannot self-approve changed image hashes or bytes", () => {
  for (const change of [{ sha256: "0".repeat(64) }, { bytes: 1 }]) {
    assert.throws(() => approvedSuccessorImages({ ...manifest, files: [{ ...manifest.files[0], ...change }, manifest.files[1]] }, readAsset));
  }
});

test("successor rejects tampered, truncated and missing image data", () => {
  assert.throws(() => approvedSuccessorImages(manifest, path => { const data = Buffer.from(readAsset(path)); data[0] ^= 255; return data; }));
  assert.throws(() => approvedSuccessorImages(manifest, path => readAsset(path).subarray(1)));
  assert.throws(() => approvedSuccessorImages(manifest, () => { throw new Error("missing"); }));
});
