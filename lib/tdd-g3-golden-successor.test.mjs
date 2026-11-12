import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { approvedSuccessorImages } from "./tdd-g3-golden-successor.mjs";

for (const [run, expected] of [
  [41071808375, ["ho/320/table.png", "ho/390/table.png"]],
  [41253524859, ["bo/1024/table.png", "bo/768/table.png"]],
]) {
const root = new URL("../docs/visual-goldens/pap1073/successor-" + run + "/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", root), "utf8"));
const readAsset = path => readFileSync(new URL(path, root));

test("approved successor selects only exact Founder-approved Linux CI Table PNGs", () => {
  const images = approvedSuccessorImages(manifest, readAsset);
  assert.deepEqual([...images.keys()].sort(), expected);
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

test("approval profiles cannot borrow another run identity or image set", () => {
  const otherRun = run === 41071808375 ? 41253524859 : 41071808375;
  const otherRoot = new URL("../docs/visual-goldens/pap1073/successor-" + otherRun + "/", import.meta.url);
  const other = JSON.parse(readFileSync(new URL("manifest.json", otherRoot), "utf8"));
  assert.throws(() => approvedSuccessorImages({ ...manifest, sourceRun: otherRun }, readAsset));
  assert.throws(() => approvedSuccessorImages({ ...manifest, files: other.files }, readAsset));
});
}

// PAP-1890 — Founder approved only 6 BO/HO Full Detail successor images, 2026-11-12.
{
 const run=43133601626;
 const root=new URL("../docs/visual-goldens/pap1073/successor-"+run+"/",import.meta.url);
 const signed=JSON.parse(readFileSync(new URL("manifest.json",root),"utf8"));
 const read=part=>readFileSync(new URL(part,root));
 const expected=["bo/768/detail.png","bo/390/detail.png","bo/320/detail.png","ho/768/detail.png","ho/390/detail.png","ho/320/detail.png"].sort();
 test("PAP-1890 six Founder-approved Detail screenshots, no Table/Drawer",()=>{
  assert.deepEqual([...approvedSuccessorImages(signed,read).keys()].sort(),expected);
  assert.equal(signed.approvalIssue,"PAP-1890");
  assert.equal(signed.approvalComment,"27411");
  assert.equal(signed.sourceRun,43133601626);
 });
 test("PAP-1890 reject foreign identity, extra, missing and duplicate files",()=>{
  for(const key of ["sourceRun","sourceSha","artifactId","artifactName","founderApprovalDate","approvalIssue","approvalComment"]){
   assert.throws(()=>approvedSuccessorImages({...signed,[key]:"unapproved"},read));
  }
  for(const files of [[],signed.files.slice(1),[...signed.files,signed.files[0]],[...signed.files.slice(0,5),{...signed.files[5],path:"bo/768/table.png"}],[...signed.files.slice(0,5),{...signed.files[5],sha256:"0".repeat(64)}]]){
   assert.throws(()=>approvedSuccessorImages({...signed,files},read));
  }
 });
 test("PAP-1890 reject tampered and truncated asset bytes",()=>{
  assert.throws(()=>approvedSuccessorImages(signed,key=>{const b=Buffer.from(read(key));b[0]^=255;return b}));
  assert.throws(()=>approvedSuccessorImages(signed,()=>Buffer.from("wrong")));
 });
}
