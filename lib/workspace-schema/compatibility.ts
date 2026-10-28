import type { BoModule, BoTableState } from "../bo-registration";
import type { FieldSchema } from "./fields";
import type { AuthorizationContext, CompatibilityScreen, ModuleSchema, TableQuery } from "./schema";
import { validateModule, validateQuery } from "./validate";

/** Metadata bridge only: no route, renderer, authorization or current module is changed. */
export function toLegacyModule(module: ModuleSchema): BoModule {
  validateModule(module);
  return { label: module.label, group: module.group, fields: module.fields.map(f => ({
    key: f.key, label: f.label, type: f.type, icon: f.icon, w: f.width,
    readonly: f.readOnly || !f.capabilities.inlineEdit,
    ...(f.options ? { options: [...f.options] } : {}),
  })) };
}
/** Opt-in legacy inventory; does not manufacture TDD compliance or infer field permissions. */
export type LegacyBoundary = {
  readonly screen: Extract<CompatibilityScreen, { classification: "GRANDFATHERED" }>;
  readonly module: BoModule;
  readonly renderer: "registration" | "factory";
};
/** Legacy any/all rules split on commas and trim each token; they have no escape syntax. */
function legacyMultiOperand(values: readonly string[]): string {
  if (!values.length || values.some(value => !value || value !== value.trim() || value.includes(","))) {
    throw Error("TDD contract: unrepresentable legacy multi-value operand");
  }
  return values.join(",");
}
export function toLegacyTableState<F extends readonly FieldSchema[]>(module: ModuleSchema<F>, query: TableQuery<F>, context: AuthorizationContext): BoTableState {
  validateModule(module); validateQuery<F>(module, query, context);
  const operand = (value: unknown) => Array.isArray(value) ? legacyMultiOperand(value) : value == null ? "" : String(value);
  return {
    search: query.search, rules: query.filters.rules.map(r => ({ field: r.field, op: r.op, value: operand(r.value), second: operand(r.second) })), logic: query.filters.logic,
    sort: query.sort?.field ?? "", desc: query.sort?.direction === "desc", order: [...query.order], visible: [...query.visible],
    group: query.group?.field ?? "", groupDesc: query.group?.direction === "desc", collapsed: [...(query.group?.collapsed ?? [])], hiddenGroups: [...(query.group?.hidden ?? [])], hideEmpty: query.group?.hideEmpty ?? true, pageSize: query.pageSize,
    ...(query.frozenThrough ? { frozenThrough: query.frozenThrough } : {}),
  };
}
/** Parsing is explicit and fail-closed; legacy string operators cannot expand the contract. */
export function fromLegacyTableState<F extends readonly FieldSchema[]>(module: ModuleSchema<F>, state: BoTableState, context: AuthorizationContext, page = 1): TableQuery<F> {
  validateModule(module);
  const operand = (key: string, value: string, op?: string): unknown => {
    const field = module.fields.find(f => f.key === key);
    if (!field) throw Error("TDD contract: unregistered legacy field");
    if (["number", "currency", "formula"].includes(field.type)) return value.trim() ? Number(value) : NaN;
    if (field.type === "boolean") { if (!["true", "false"].includes(value)) throw Error("TDD contract: invalid legacy boolean"); return value === "true"; }
    if (["multiselect", "multirelation"].includes(field.type)) {
      if (op === "not_contains") return value;
      const values = value.split(",").map(v => v.trim());
      legacyMultiOperand(values);
      return values;
    }
    return value;
  };
  const query: unknown = {
    search: state.search, filters: { logic: state.logic, rules: state.rules.map(r => ({ field: r.field, op: r.op,
      ...(["empty", "not_empty"].includes(r.op) ? {} : { value: operand(r.field, r.value, r.op), ...(r.op === "between" ? { second: operand(r.field, r.second) } : {}) }),
    })) },
    sort: state.sort ? { field: state.sort, direction: state.desc ? "desc" : "asc" } : null,
    group: state.group ? { field: state.group, direction: state.groupDesc ? "desc" : "asc", collapsed: state.collapsed, hidden: state.hiddenGroups, hideEmpty: state.hideEmpty } : null,
    order: state.order, visible: state.visible, ...(state.frozenThrough ? { frozenThrough: state.frozenThrough } : {}), page, pageSize: state.pageSize,
  };
  validateQuery<F>(module, query, context); return query;
}
