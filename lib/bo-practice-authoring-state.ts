import type { BoPracticeResourceDetail, BoPracticeResourceVersion } from "./bo-practice-model";

export type StableClientPage = { clientKey: string };

export type PracticeOperationFence = { current: string | null };

export function tryStartPracticeOperation(fence: PracticeOperationFence, operation: string): boolean {
  if (fence.current !== null) return false;
  fence.current = operation;
  return true;
}

export function finishPracticeOperation(fence: PracticeOperationFence, operation: string): boolean {
  if (fence.current !== operation) return false;
  fence.current = null;
  return true;
}


export function patchPageByClientKey<T extends StableClientPage>(
  pages: readonly T[],
  clientKey: string,
  patch: Partial<T>,
): T[] {
  return pages.map(page => page.clientKey === clientKey ? { ...page, ...patch } : page);
}

export function canAdoptEnsuredDraft(
  displayed: BoPracticeResourceDetail,
  ensured: BoPracticeResourceVersion,
): boolean {
  const published = displayed.currentPublished;
  if (displayed.draft || !published) return false;
  if (ensured.resourceId !== displayed.id || ensured.status !== "DRAFT" || ensured.revision !== 1) return false;
  if (ensured.versionNumber !== published.versionNumber + 1) return false;
  if (ensured.title !== published.title || ensured.formatDefinition !== published.formatDefinition) return false;

  const sourcePages = [...published.pages].sort((a, b) => a.order - b.order);
  const draftPages = [...ensured.pages].sort((a, b) => a.order - b.order);
  if (sourcePages.length !== draftPages.length) return false;
  return sourcePages.every((source, index) => {
    const draft = draftPages[index];
    return draft?.order === source.order
      && draft.sheetMediaAssetId === source.sheetMediaAssetId
      && draft.worksheetMediaAssetId === source.worksheetMediaAssetId;
  });
}
