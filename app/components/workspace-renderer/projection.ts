import { allows, allowsField, isFieldValue, toLegacyModule, validateModule, type AuthorizationContext, type ModuleSchema } from "@/lib/workspace-schema";
import type { BoRecord } from "@/lib/bo-registration";
/** Read only registered and authorized properties; never discover keys in the payload. */
export function recordProjection(schema: ModuleSchema, context: AuthorizationContext, row: Readonly<Record<string, unknown>>) {
  validateModule(schema);
  if (!allows(schema, context, "read") || !allowsField(schema, context, schema.table.identity.field, "display")) return null;
  if (typeof row.id !== "string" || !row.id.trim()) throw Error("Invalid TDD record identity");
  const fields = schema.fields.filter(f => allowsField(schema, context, f.key, "display"));
  const record: BoRecord = { id: row.id, name: "" };
  for (const field of fields) {
    const value = row[field.key];
    if (!isFieldValue(field.type, value)) throw Error("Invalid TDD field value");
    record[field.key] = Array.isArray(value) ? [...value] : value as string | number | boolean | null | undefined;
  }
  const identity = record[schema.table.identity.field];
  const title = identity == null ? "—" : String(identity);
  if (!fields.some(f => f.key === "name")) record.name = title;
  else if (typeof record.name !== "string") throw Error("Legacy name field requires a string projection");
  const legacy = toLegacyModule(schema);
  return { record, title, fields: legacy.fields.filter(f => fields.some(p => p.key === f.key)), schemaFields: fields };
}
const contexts = new WeakMap<AuthorizationContext, number>(); let nextContext = 0;
export function renderScope(schema: ModuleSchema, context: AuthorizationContext, id: string) {
  if (!contexts.has(context)) contexts.set(context, ++nextContext);
  return JSON.stringify([schema.surface, schema.key, context.surface, context.surface === "BO" ? context.centerId : "", contexts.get(context), id]);
}
