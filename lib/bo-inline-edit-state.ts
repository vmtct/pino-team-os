/** Pure draft edit state. This does not grant server-side mutation authority. */
export type BoInlineEditValue = string | number | boolean | null;
export type BoInlineEdit<RowKey extends string = string> = Readonly<{
  rowKey: RowKey; field: string; before: BoInlineEditValue; after: BoInlineEditValue;
}>;
export type BoInlineEditState = Readonly<{
  pending: readonly BoInlineEdit[];
  undo: readonly BoInlineEdit[];
}>;
export const emptyBoInlineEditState: BoInlineEditState = { pending: [], undo: [] };
export function stageBoInlineEdit(
  state: BoInlineEditState, edit: BoInlineEdit, editableFields: ReadonlySet<string>,
): BoInlineEditState {
  if (!editableFields.has(edit.field) || !edit.rowKey || edit.before === edit.after) return state;
  const existing = state.pending.find((entry) => entry.rowKey === edit.rowKey && entry.field === edit.field);
  const before = existing?.before ?? edit.before;
  const pending = state.pending.filter((entry) => entry.rowKey !== edit.rowKey || entry.field !== edit.field);
  if (before !== edit.after) pending.push({ ...edit, before });
  return { pending, undo: [...state.undo, edit] };
}
export function undoBoInlineEdit(state: BoInlineEditState): BoInlineEditState {
  const edit = state.undo.at(-1);
  if (!edit) return state;
  const pending = state.pending.filter((entry) => entry.rowKey !== edit.rowKey || entry.field !== edit.field);
  const prior = state.pending.find((entry) => entry.rowKey === edit.rowKey && entry.field === edit.field);
  if (prior && prior.before !== edit.before) pending.push({ ...prior, after: edit.before });
  return { pending, undo: state.undo.slice(0, -1) };
}