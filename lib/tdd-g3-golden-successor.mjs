// PAP-1073 / PAP-1229 / PAP-1105: exact Founder approvals, comments 18831 and 19586.
// Never accept a candidate manifest as authority for its own provenance or hashes.
import { createHash } from "node:crypto";

// Each profile is pinned independently to its exact Founder receipt and immutable bytes.
const approvals = [
  {
    sourceRun: 41071808375,
    sourceSha: "877d578ef00334617043e09d14f851717fa25329",
    artifactId: 12984978572,
    founderApprovalDate: "2026-10-31",
    approvalComment: "18831",
    files: [
      { path: "ho/390/table.png", sha256: "1f379eb8c63ef954d5c260b4edcfd464cedea0e9bb24e12b26b170b6b25ac4ad", bytes: 44329 },
      { path: "ho/320/table.png", sha256: "27b05a0de49c0263d8c26e7e117a267624fa6815608c55004d4b621435577b6d", bytes: 41222 },
    ],
  },
  {
    sourceRun: 41253524859,
    sourceSha: "b869f451eaf91277fc0b9a5fb124f65cd18cdf39",
    artifactId: 13062402017,
    founderApprovalDate: "2026-11-01",
    approvalComment: "19586",
    files: [
      { path: "bo/1024/table.png", sha256: "02c3417d55792e373ed7f2a6bdad0f669c6eb255bcf4353b3bd7dcf08d6c8109", bytes: 44646 },
      { path: "bo/768/table.png", sha256: "bbf2f731523181e43fa9983e7995af1ba286074c58cbb04afa5d527788bf1596", bytes: 43859 },
    ],
  },
  {
    // PAP-1073 Founder approval comment 21890, i5 reviewed exact CI screenshots.
    sourceRun: 41852649875,
    sourceSha: "92c2e5495c86b02f69b7bb56580cdbac4d8909f2",
    artifactId: 13336202755,
    founderApprovalDate: "2026-11-04",
    approvalComment: "21890",
    files: [
      { path: "bo/1440/table.png", sha256: "e351df2b9834ede83dd50f39c8f8365de11131d8494dfca24cd44f4b8870f89f", bytes: 46826 },
      { path: "bo/1024/table.png", sha256: "b0c39ea832da94d7ce5b67e49e3f3961eb6d5404e4505972340f1e23c03b4969", bytes: 44947 },
      { path: "bo/768/table.png", sha256: "7097992285f92a5d28ec8010a6ef154587ece845253d8bc3baf760df3e7e2bab", bytes: 44273 },
      { path: "bo/390/table.png", sha256: "59375631bb63d559809e73324c31ae0243c5ca663da4490e89062c4677547b4c", bytes: 38769 },
      { path: "bo/320/table.png", sha256: "778295515937f609590ea8b9371139c9acca06f3204cb54d3d5bd9c9e815644f", bytes: 36189 },
      { path: "ho/1440/table.png", sha256: "a6349caa6857d6984a8597ad05f43585f6041042a3c644d54e5867a97a5dfb3c", bytes: 46895 },
      { path: "ho/1024/table.png", sha256: "63555d7c9bc695d55e7d67885ed05e43ff18cf69c6739e09254d7d78654a8938", bytes: 45034 },
      { path: "ho/768/table.png", sha256: "f4147ccf93c71b62ad7d4f9a551cb1106cd3d9802f3a41d8d90c01bb5c9eb5d0", bytes: 44352 },
      { path: "ho/390/table.png", sha256: "7461e1336c1385b3fe89ab0e04649cad5d80b203c4e1b00154bcfd5fddd570a8", bytes: 38793 },
      { path: "ho/320/table.png", sha256: "85c427c89269177b8523752156c51ecd671ae2590e62efc6925cd3067931433b", bytes: 36220 }
    ],
  },
];

export function approvedSuccessorImages(manifest, readAsset) {
  const approval = approvals.find(pin => pin.sourceRun === manifest?.sourceRun);
  if (!approval || manifest.schemaVersion !== 1 ||
      manifest.sourceSha !== approval.sourceSha ||
      manifest.artifactId !== approval.artifactId || manifest.artifactName !== "pap1073-g3-geometry" ||
      manifest.founderApprovalDate !== approval.founderApprovalDate || manifest.approvalIssue !== "PAP-1073" ||
      manifest.approvalComment !== approval.approvalComment) throw new Error("Unapproved G3 successor identity");
  if (!Array.isArray(manifest.files) || manifest.files.length !== approval.files.length ||
      new Set(manifest.files.map(file => file.path)).size !== approval.files.length) throw new Error("G3 successor requires exact count of distinct Founder-approved images");
  const images = new Map();
  for (const file of manifest.files) {
    const approved = approval.files.find(pin => pin.path === file.path);
    if (!approved || file.sha256 !== approved.sha256 || file.bytes !== approved.bytes) throw new Error("Unapproved G3 successor asset");
    const data = readAsset(approved.path);
    if (data.length !== approved.bytes || createHash("sha256").update(data).digest("hex") !== approved.sha256) throw new Error("G3 successor image was modified");
    images.set(approved.path, data);
  }
  return images;
}
