import assert from "node:assert/strict";
import test from "node:test";
import { canAdoptEnsuredDraft, finishPracticeOperation, patchPageByClientKey, tryStartPracticeOperation } from "./bo-practice-authoring-state";
import type { BoPracticeResourceDetail, BoPracticeResourceVersion } from "./bo-practice-model";

const published: BoPracticeResourceVersion = {
  id: "018f7f5a-0000-7abc-8def-000000000001",
  resourceId: "018f7f5a-0000-7abc-8def-000000000010",
  versionNumber: 1,
  title: "Always With Me",
  formatDefinition: "PIANO_SHEET_176X250_8ROW_V1",
  status: "PUBLISHED",
  revision: 4,
  publishedAt: "2026-09-01T00:00:00.000Z",
  pages: [
    { id: "p1", versionId: "v1", order: 1, sheetMediaAssetId: "s1", worksheetMediaAssetId: "w1", revision: 1 },
    { id: "p2", versionId: "v1", order: 2, sheetMediaAssetId: "s2", worksheetMediaAssetId: null, revision: 1 },
  ],
};

const displayed: BoPracticeResourceDetail = {
  id: published.resourceId,
  pathProgramId: "path-1",
  pianoRepertoireItemId: "item-1",
  family: "JOURNEY",
  title: published.title,
  currentPublishedVersionId: published.id,
  revision: 3,
  draft: null,
  currentPublished: published,
};
test("does not adopt a draft another editor has already changed", () => {
  const unseen: BoPracticeResourceVersion = {
    ...published,
    id: "018f7f5a-0000-7abc-8def-000000000002",
    versionNumber: 2,
    status: "DRAFT",
    revision: 2,
    publishedAt: null,
    title: "Other editor title",
    pages: published.pages.map(page => ({ ...page, id: `draft-${page.id}`, versionId: "v2" })),
  };
  assert.equal(canAdoptEnsuredDraft(displayed, unseen), false);
});

test("may adopt only an untouched clone of the displayed published snapshot", () => {
  const fresh: BoPracticeResourceVersion = {
    ...published,
    id: "018f7f5a-0000-7abc-8def-000000000003",
    versionNumber: 2,
    status: "DRAFT",
    revision: 1,
    publishedAt: null,
    pages: published.pages.map(page => ({ ...page, id: `draft-${page.id}`, versionId: "v2" })),
  };
  assert.equal(canAdoptEnsuredDraft(displayed, fresh), true);
});

test("delayed upload patches the same logical page after reorder and no-ops after removal", () => {
  const first = { clientKey: "page-a", sheetMediaAssetId: "a" };
  const second = { clientKey: "page-b", sheetMediaAssetId: "b" };
  const reordered = [second, first];
  const patched = patchPageByClientKey(reordered, "page-a", { sheetMediaAssetId: "uploaded" });
  assert.deepEqual(patched.map(page => [page.clientKey, page.sheetMediaAssetId]), [["page-b", "b"], ["page-a", "uploaded"]]);
  assert.deepEqual(patchPageByClientKey([second], "page-a", { sheetMediaAssetId: "late" }), [second]);
});

test("operation fence is symmetric and only its owner may clear it", () => {
  const fence = { current: null as string | null };
  assert.equal(tryStartPracticeOperation(fence, "save"), true);
  assert.equal(tryStartPracticeOperation(fence, "upload-page-a-sheet"), false);
  assert.equal(finishPracticeOperation(fence, "upload-page-a-sheet"), false);
  assert.equal(fence.current, "save");
  assert.equal(finishPracticeOperation(fence, "save"), true);
  assert.equal(tryStartPracticeOperation(fence, "upload-page-a-sheet"), true);
  assert.equal(tryStartPracticeOperation(fence, "publish"), false);
  assert.equal(finishPracticeOperation(fence, "upload-page-a-sheet"), true);
  assert.equal(fence.current, null);
});

import { readFileSync } from "node:fs";
import { join } from "node:path";

test("production authoring UI uses one operation fence for upload, save, publish, and structural edits", () => {
  const source = readFileSync(join(process.cwd(), "app/bo/practice/PracticeAuthoringView.tsx"), "utf8");
  assert.ok(source.includes("tryStartPracticeOperation(operationInFlight, operation)"));
  assert.ok(source.includes("finishPracticeOperation(operationInFlight, operation)"));
  assert.ok(source.includes('const operation = "save";'));
  assert.ok(source.includes('const operation = "publish";'));
  assert.ok(source.includes('const operation = `upload-${clientKey}-${kind}`;'));
  assert.equal((source.match(/if \(!beginOperation\(operation\)\) return;/g) ?? []).length, 5);
  assert.ok(source.includes("disabled={!!busy} onClick={addPage}"));
  assert.ok(source.includes("disabled={!!busy} onFile="));
  assert.equal(source.includes("uploadInFlight"), false);
  assert.equal(source.includes("setUploading"), false);
});
