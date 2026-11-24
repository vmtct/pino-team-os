/** PAP-2342 / PLT-M1-DELIVERY: synthetic UI review only, never a Core record. */
export type PreviewSurface = "BO" | "HO";
export type PreviewRecord = {
  id: string;
  fixture: true;
  createdAt: null;
  createdBy: null;
  updatedAt: null;
  updatedBy: null;
};
export type PreviewOperation = "create" | "replace" | "remove";
export type PreviewFeature<R extends PreviewRecord> = {
  feature: string;
  jiraTask: string;
  surface: PreviewSurface;
  idPrefix: string;
  seed: R;
  operations: readonly PreviewOperation[];
};
export function validatePreviewRecord(record: PreviewRecord, prefix: string): void {
  const suffix = record.id.startsWith(prefix) ? record.id.slice(prefix.length) : "";
  if (!/^[1-9][0-9]*$/.test(suffix) && !/^0+[1-9][0-9]*$/.test(suffix)) {
    throw new Error("Invalid synthetic ID");
  }
  if (record.fixture !== true || [record.createdAt, record.createdBy, record.updatedAt, record.updatedBy].some(value => value !== null)) {
    throw new Error("Synthetic record must not assert real audit values");
  }
}
export function validatePreviewFeature<R extends PreviewRecord>(feature: PreviewFeature<R>): void {
  if (!/^[A-Z][A-Z0-9-]+$/.test(feature.feature) || !/^PAP-[1-9][0-9]*$/.test(feature.jiraTask) ||
      !/^[A-Z][A-Z0-9-]*-MOCK-$/.test(feature.idPrefix) ||
      feature.seed.id !== feature.idPrefix + "001" ||
      (feature.surface !== "BO" && feature.surface !== "HO") ||
      feature.operations.some(action => !["create", "replace", "remove"].includes(action))) {
    throw new Error("Invalid M1 feature registration");
  }
  validatePreviewRecord(feature.seed, feature.idPrefix);
}
