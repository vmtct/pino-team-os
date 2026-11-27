import { validatePreviewFeature, validatePreviewRecord, type PreviewFeature, type PreviewRecord } from "./contract";

export type PreviewState<R extends PreviewRecord> = Readonly<{
  feature: string;
  scopeKey: string;
  idPrefix: string;
  operations: readonly ("create" | "replace" | "remove")[];
  records: readonly R[];
  nextNumber: number;
}>;
export type PreviewAction<R extends PreviewRecord> =
  | { type: "create"; record: Omit<R, "id"> }
  | { type: "replace"; id: string; record: R }
  | { type: "remove"; id: string };

export function createPreviewState<R extends PreviewRecord>(definition: PreviewFeature<R>, scopeKey: string): PreviewState<R> {
  validatePreviewFeature(definition);
  if (!scopeKey.trim()) throw new Error("Missing preview scope");
  return {
    feature: definition.feature, scopeKey, idPrefix: definition.idPrefix,
    operations: [...definition.operations], records: [structuredClone(definition.seed)], nextNumber: 2,
  };
}
export function readPreviewRecord<R extends PreviewRecord>(state: PreviewState<R>, id: string): R | undefined {
  const record = state.records.find(row => row.id === id);
  return record ? structuredClone(record) : undefined;
}
export function reducePreview<R extends PreviewRecord>(state: PreviewState<R>, action: PreviewAction<R>): PreviewState<R> {
  if (!state.operations.includes(action.type)) throw new Error("Preview operation not registered");
  if (action.type === "create") {
    const record = { ...structuredClone(action.record), id: state.idPrefix + String(state.nextNumber).padStart(3, "0") } as R;
    validatePreviewRecord(record, state.idPrefix);
    return { ...state, records: [...state.records, record], nextNumber: state.nextNumber + 1 };
  }
  const index = state.records.findIndex(row => row.id === action.id);
  if (index < 0) return state;
  if (action.type === "remove") return { ...state, records: state.records.filter(row => row.id !== action.id) };
  if (action.record.id !== action.id) throw new Error("Cannot change synthetic record identity");
  validatePreviewRecord(action.record, state.idPrefix);
  return { ...state, records: state.records.map((row, i) => i === index ? structuredClone(action.record) : row) };
}
/** Remount/reset on feature, principal or authorized scope change; never persist. */
export function reconcilePreviewScope<R extends PreviewRecord>(state: PreviewState<R>, definition: PreviewFeature<R>, scopeKey: string): PreviewState<R> {
  return state.feature === definition.feature && state.scopeKey === scopeKey
    ? state : createPreviewState(definition, scopeKey);
}
