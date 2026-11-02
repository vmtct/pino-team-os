import { allowsField, fieldValueErrors, type AuthorizationContext, type EditablePatch, type FieldSchema, type ModuleRow, type ModuleSchema, type MutationAdapter } from "@/lib/workspace-schema";
import type { BoValue } from "@/lib/bo-registration";

export function dispatchCellEdit(schema: ModuleSchema, context: AuthorizationContext, key: string, dispatch: () => void) {
  if (!schema.table.inlineEdit.enabled || !schema.table.inlineEdit.fields.includes(key) || !allowsField(schema, context, key, "inlineEdit")) return false;
  dispatch(); return true;
}
/** Recheck current rights immediately before and after the authenticated adapter call. */
export async function writeProperty<F extends readonly FieldSchema[]>(schema: ModuleSchema<F>, context: AuthorizationContext, record: ModuleRow<F>, key: string, value: BoValue, version: string, adapter: MutationAdapter<F>, signal: AbortSignal) {
  const field = schema.fields.find(f => f.key === key);
  if (!field || !version.trim() || !allowsField(schema, context, key, "inlineEdit") || fieldValueErrors(field, value).length) throw Error("Invalid or unauthorized TDD edit");
  signal.throwIfAborted();
  const result = await adapter.update(record.id, { [key]: value } as EditablePatch<F>, version, context, signal);
  signal.throwIfAborted();
  if (!allowsField(schema, context, key, "inlineEdit")) throw Error("TDD edit permission changed");
  if (result.status === "saved" && (result.row.id !== record.id || typeof result.version !== "string" || !result.version.trim())) throw Error("Invalid TDD mutation identity/version");
  return result;
}
