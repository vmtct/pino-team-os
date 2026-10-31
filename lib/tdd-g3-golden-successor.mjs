// PAP-1073 / PAP-1229: exact two-image Founder approval, Jira comment 18831.
// Never accept a candidate manifest as authority for its own provenance or hashes.
import { createHash } from "node:crypto";

const approvedFiles = [
  { path: "ho/390/table.png", sha256: "1f379eb8c63ef954d5c260b4edcfd464cedea0e9bb24e12b26b170b6b25ac4ad", bytes: 44329 },
  { path: "ho/320/table.png", sha256: "27b05a0de49c0263d8c26e7e117a267624fa6815608c55004d4b621435577b6d", bytes: 41222 },
];

export function approvedSuccessorImages(manifest, readAsset) {
  if (manifest?.schemaVersion !== 1 || manifest.sourceRun !== 41071808375 ||
      manifest.sourceSha !== "877d578ef00334617043e09d14f851717fa25329" ||
      manifest.artifactId !== 12984978572 || manifest.artifactName !== "pap1073-g3-geometry" ||
      manifest.founderApprovalDate !== "2026-10-31" || manifest.approvalIssue !== "PAP-1073" ||
      manifest.approvalComment !== "18831") throw new Error("Unapproved G3 successor identity");
  if (!Array.isArray(manifest.files) || manifest.files.length !== 2 ||
      new Set(manifest.files.map(file => file.path)).size !== 2) throw new Error("G3 successor requires exactly two distinct approved images");
  const images = new Map();
  for (const file of manifest.files) {
    const approved = approvedFiles.find(pin => pin.path === file.path);
    if (!approved || file.sha256 !== approved.sha256 || file.bytes !== approved.bytes) throw new Error("Unapproved G3 successor asset");
    const data = readAsset(approved.path);
    if (data.length !== approved.bytes || createHash("sha256").update(data).digest("hex") !== approved.sha256) throw new Error("G3 successor image was modified");
    images.set(approved.path, data);
  }
  return images;
}
