import { FIELD_TYPES, FILTER_OPERATORS, isFieldValue, type FieldSchema } from "./fields";
import type { AuthorizationContext, Capability, ModuleSchema, TableQuery } from "./schema";

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`TDD contract: ${message}`);
}
function object(value: unknown, keys: readonly string[], required: readonly string[] = keys): asserts value is Record<string, unknown> {
  check(value && typeof value === "object" && !Array.isArray(value), "expected object");
  check(Object.keys(value).every(k => keys.includes(k)), "unknown property or shell override");
  check(required.every(k => Object.hasOwn(value, k)), "missing property");
}
function nonempty(value: unknown): asserts value is string { check(typeof value === "string" && value.trim().length > 0, "expected nonempty string"); }
function array(value: unknown): asserts value is unknown[] { check(Array.isArray(value), "expected array"); }
function unique(values: readonly unknown[]) { check(new Set(values).size === values.length, "duplicate identifier"); }
function source(value: unknown) { object(value, ["adapter", "permission"]); nonempty(value.adapter); nonempty(value.permission); }
export function validateApproval(value: unknown) {
  object(value, ["jira", "owner", "designAuthority", "files", "tests", "reviewBy"]);
  check(typeof value.jira === "string" && /^PAP-\d+$/.test(value.jira), "approval must reference Jira");
  nonempty(value.owner); nonempty(value.designAuthority);
  for (const entries of [value.files, value.tests]) { array(entries); check(entries.length > 0, "bounded files/tests required"); entries.forEach(nonempty); check(!entries.some(x => (x as string).includes("*")), "wildcard exception"); }
  check(typeof value.reviewBy === "string" && Number.isFinite(Date.parse(value.reviewBy)), "review date required");
}
const operations = ["display", "search", "filter", "sort", "group", "inlineEdit"] as const;
export function validateFields(value: unknown): asserts value is readonly FieldSchema[] {
  array(value); check(value.length > 0, "fields required");
  for (const field of value) {
    object(field, ["key", "label", "type", "icon", "width", "permission", "readOnly", "capabilities", "options", "required", "sensitive", "hint", "validation"], ["key", "label", "type", "icon", "width", "permission", "readOnly", "capabilities"]);
    for (const k of ["key", "label", "icon", "permission"]) nonempty(field[k]);
    check(FIELD_TYPES.includes(field.type as FieldSchema["type"]), "unsupported field type");
    check(typeof field.width === "number" && Number.isFinite(field.width) && field.width > 0, "invalid width");
    check(typeof field.readOnly === "boolean", "readonly required");
    object(field.capabilities, operations);
    operations.forEach(op => check(typeof (field.capabilities as Record<string, unknown>)[op] === "boolean", "invalid field capability"));
    const caps = field.capabilities as Record<string, boolean>;
    check(!caps.inlineEdit || (!field.readOnly && field.type !== "id" && field.type !== "formula"), "protected/readonly field cannot edit");
    check(!["id", "formula"].includes(String(field.type)) || field.readOnly === true, "id/formula must be readonly");
    check(!caps.inlineEdit || caps.display, "hidden field cannot edit");
    check(!field.sensitive || (!caps.search && !caps.filter && !caps.sort && !caps.group), "sensitive field query capability");
    for (const k of ["required", "sensitive"]) check(field[k] === undefined || typeof field[k] === "boolean", "invalid field flag");
    check(field.hint === undefined || typeof field.hint === "string", "invalid hint");
    if (field.validation !== undefined) {
      const numeric = ["number", "currency", "formula"].includes(String(field.type));
      const multi = ["multiselect", "multirelation"].includes(String(field.type));
      check(field.type !== "boolean", "boolean has no validation options");
      object(field.validation, numeric ? ["min", "max", "integer"] : multi ? ["minItems", "maxItems"] : ["minLength", "maxLength"], []);
      for (const [k, v] of Object.entries(field.validation)) check(k === "integer" ? typeof v === "boolean" : typeof v === "number" && Number.isFinite(v) && (numeric || (Number.isInteger(v) && v >= 0)), "invalid validation bound");
      const low = field.validation[numeric ? "min" : multi ? "minItems" : "minLength"];
      const high = field.validation[numeric ? "max" : multi ? "maxItems" : "maxLength"];
      check(low === undefined || high === undefined || (low as number) <= (high as number), "reversed validation bounds");
    }
    if (field.options !== undefined) {
      check(["select", "multiselect", "relation", "multirelation", "person"].includes(String(field.type)), "options unsupported for type");
      array(field.options); field.options.forEach(nonempty); unique(field.options);
    }
  }
  unique(value.map(f => (f as FieldSchema).key));
}
type PermissionModule = Pick<ModuleSchema, "surface" | "capabilities" | "fields">;
export function allows(module: PermissionModule, context: AuthorizationContext, capability: Capability): boolean {
  if (context.surface !== module.surface || (context.surface === "BO" && !context.centerId.trim())) return false;
  const permission = module.capabilities[capability];
  return Boolean(permission && context.authorize(module.capabilities.read) && context.authorize(permission));
}
export function allowsField(module: PermissionModule, context: AuthorizationContext, key: string, operation: typeof operations[number]): boolean {
  const field = module.fields.find(f => f.key === key);
  return Boolean(field && allows(module, context, "read") && context.authorize(field.permission) && field.capabilities[operation] &&
    (operation !== "inlineEdit" || (!field.readOnly && allows(module, context, "edit"))));
}

export function validateQuery<F extends readonly FieldSchema[]>(module: ModuleSchema<F>, input: unknown, context?: AuthorizationContext): asserts input is TableQuery<F> {
  object(input, ["search", "filters", "sort", "group", "order", "visible", "page", "pageSize"]);
  const query = input as unknown as TableQuery<F>;
  const field = (key: unknown, op: typeof operations[number]) => {
    const found = module.fields.find(f => f.key === key);
    check(found && found.capabilities[op], `unregistered/unsupported ${op} field`);
    if (context) check(allowsField(module, context, found.key, op), "unauthorized field capability");
    return found;
  };
  if (context) check(allows(module, context, "read"), "unauthorized module");
  check(typeof query.search === "string", "invalid search");
  if (query.search) {
    check(module.table.search.fields.length > 0, "search requires a configured searchable field");
    module.table.search.fields.forEach(k => field(k, "search"));
  }
  for (const keys of [query.order, query.visible]) { array(keys); unique(keys); keys.forEach(k => field(k, "display")); }
  const columns = module.table.columns.map(c => c.field);
  check(query.order.length === columns.length && columns.every(k => query.order.includes(k)), "order must contain registered columns only");
  check(query.visible.every(k => columns.includes(k)), "unregistered visible column");
  check(query.order[0] === module.table.identity.field && query.visible.includes(module.table.identity.field), "protected identity cannot hide/reorder");
  check(Number.isInteger(query.page) && query.page >= 1 && [8, 15, 30].includes(query.pageSize), "invalid pagination");
  object(query.filters, ["logic", "rules"]);
  check(["AND", "OR"].includes(query.filters.logic), "flat filter logic required"); array(query.filters.rules);
  for (const rule of query.filters.rules) {
    object(rule, ["field", "op", "value", "second"], ["field", "op"]);
    const f = field(rule.field, "filter");
    check(module.table.filters.fields.includes(f.key), "filter field not configured");
    check((FILTER_OPERATORS[f.type] as readonly unknown[]).includes(rule.op), "invalid filter operator");
    if (["empty", "not_empty"].includes(String(rule.op))) check(rule.value === undefined && rule.second === undefined, "empty operator has no operand");
    else {
      const multiText = ["multiselect", "multirelation"].includes(f.type) && rule.op === "not_contains";
      check(rule.value != null && (multiText ? typeof rule.value === "string" : isFieldValue(f.type, rule.value)), "invalid filter operand");
      if (rule.op === "between") check(rule.second != null && isFieldValue(f.type, rule.second), "between requires typed upper bound");
      else check(rule.second === undefined, "unexpected upper bound");
    }
  }
  if (query.sort !== null) {
    object(query.sort, ["field", "direction"]); field(query.sort.field, "sort");
    check(module.table.sort.fields.includes(query.sort.field) && ["asc", "desc"].includes(query.sort.direction), "invalid single sort");
  }
  if (query.group !== null) {
    object(query.group, ["field", "direction", "collapsed", "hidden", "hideEmpty"]); field(query.group.field, "group");
    check(module.table.group.fields.includes(query.group.field) && ["asc", "desc"].includes(query.group.direction), "invalid single group");
    for (const values of [query.group.collapsed, query.group.hidden]) { array(values); values.forEach(nonempty); unique(values); }
    check(typeof query.group.hideEmpty === "boolean", "invalid group state");
  }
}

export function validateModule(input: unknown): asserts input is ModuleSchema {
  object(input, ["version", "classification", "key", "label", "group", "surface", "fields", "capabilities", "data", "table", "drawer", "detail"]);
  const m = input as unknown as ModuleSchema;
  check(m.version === 1 && m.classification === "TDD_DEFAULT", "unsupported schema version/classification");
  [m.key, m.label, m.group].forEach(nonempty); check(["BO", "HO"].includes(m.surface), "invalid surface");
  validateFields(m.fields);
  object(m.capabilities, ["read", "create", "edit", "history", "manageSharedViews"], ["read"]);
  Object.values(m.capabilities).forEach(nonempty);
  object(m.data, ["id", "list", "detail"]); nonempty(m.data.id);
  check(typeof m.data.list === "function" && typeof m.data.detail === "function", "missing data adapters");
  const refs = (keys: readonly string[], op: typeof operations[number] = "display") => {
    array(keys); unique(keys); keys.forEach(k => check(m.fields.some(f => f.key === k && f.capabilities[op]), `invalid ${op} field reference`));
  };
  const sections = (items: unknown) => {
    array(items); check(items.length > 0, "sections required");
    for (const s of items) { object(s, ["id", "label", "fields"]); nonempty(s.id); nonempty(s.label); refs(s.fields as string[]); }
    unique(items.map(s => (s as { id: string }).id));
  };
  object(m.table, ["identity", "columns", "search", "filters", "sort", "group", "views", "pagination", "inlineEdit", "interaction"]);
  const t = m.table;
  object(t.identity, ["field", "pinned", "hideable", "reorderable"]);
  check(t.identity.pinned === "left" && t.identity.hideable === false && t.identity.reorderable === false, "protected identity configuration");
  array(t.columns); check(t.columns.length > 0, "columns required");
  t.columns.forEach(c => { object(c, ["field", "visible"]); check(typeof c.visible === "boolean", "invalid column visibility"); });
  refs(t.columns.map(c => c.field)); check(t.columns[0].field === t.identity.field && t.columns[0].visible, "identity must be first and visible");
  object(t.search, ["fields", "normalization"]); refs(t.search.fields, "search"); check(t.search.normalization === "vi-diacritic-insensitive", "invalid search mode");
  object(t.filters, ["fields", "mode", "logic"]); refs(t.filters.fields, "filter"); check(t.filters.mode === "flat" && ["AND", "OR"].includes(t.filters.logic), "flat filters required");
  object(t.sort, ["fields", "mode", "nulls", "tieBreak"]); refs(t.sort.fields, "sort"); check(t.sort.mode === "single" && t.sort.nulls === "last" && t.sort.tieBreak === "record-id", "single deterministic sort required");
  object(t.group, ["fields", "mode"]); refs(t.group.fields, "group"); check(t.group.mode === "single", "single grouping required");
  object(t.pagination, ["sizes", "defaultSize", "mode"]); check(JSON.stringify(t.pagination.sizes) === "[8,15,30]" && [8, 15, 30].includes(t.pagination.defaultSize) && ["local-ui", "server"].includes(t.pagination.mode), "unsupported pagination");
  object(t.inlineEdit, ["fields", "enabled"]); refs(t.inlineEdit.fields, "inlineEdit");
  check(typeof t.inlineEdit.enabled === "boolean" && (!t.inlineEdit.enabled || Boolean(m.capabilities.edit)), "unauthorized inline-edit capability");
  check(t.inlineEdit.enabled || t.inlineEdit.fields.length === 0, "disabled inline edit has fields");
  check(!m.fields.some(f => f.capabilities.inlineEdit) || Boolean(m.capabilities.edit), "field editor requires edit binding");
  object(t.interaction, ["settings", "quickView", "keyboard", "undo"]);
  check(JSON.stringify(t.interaction.settings) === '["properties","grouping","filters","quick-views"]' && t.interaction.quickView === "separate-opener" && t.interaction.keyboard === "canonical" && ["local-ui-only", "disabled"].includes(t.interaction.undo), "invalid interaction contract");
  object(t.views, ["builtIn", "saved", "actions"]); array(t.views.builtIn); unique(t.views.builtIn.map(v => v.id));
  t.views.builtIn.forEach(v => { object(v, ["id", "label", "state"]); nonempty(v.id); nonempty(v.label); validateQuery(m, v.state); });
  array(t.views.actions); unique(t.views.actions); check(t.views.actions.every(a => ["add", "apply", "rename", "delete", "reorder"].includes(a)), "unknown view action");
  if (t.views.saved.kind === "local-ui") object(t.views.saved, ["kind"]);
  else {
    object(t.views.saved, ["kind", "source", "scopes", "conflict"]); check(t.views.saved.kind === "authorized-service" && t.views.saved.conflict === "version", "invalid view service"); source(t.views.saved.source);
    array(t.views.saved.scopes); unique(t.views.saved.scopes); check(t.views.saved.scopes.length > 0 && t.views.saved.scopes.every(s => ["personal", "shared"].includes(s)), "invalid view scope");
    check(!t.views.saved.scopes.includes("shared") || Boolean(m.capabilities.manageSharedViews), "shared views require permission binding");
  }
  object(m.drawer, ["density", "sections", "actions"]); check(m.drawer.density === "one-column", "drawer density is system owned"); sections(m.drawer.sections);
  array(m.drawer.actions); unique(m.drawer.actions.map(a => a.id));
  m.drawer.actions.forEach(a => { object(a, ["id", "label", "capability"]); nonempty(a.id); nonempty(a.label); check(["create", "edit"].includes(a.capability) && Boolean(m.capabilities[a.capability]), "unauthorized drawer action"); });
  object(m.detail, ["overview", "businessTabs", "history"]); object(m.detail.overview, ["sections"]); sections(m.detail.overview.sections);
  array(m.detail.businessTabs); unique(m.detail.businessTabs.map(s => s.id));
  for (const slot of m.detail.businessTabs) {
    check(!["overview", "history"].includes(slot.id), "reserved tab ID"); nonempty(slot.id); nonempty(slot.label); source(slot.source);
    const base = ["id", "label", "kind", "source"];
    switch (slot.kind) {
      case "field-group": object(slot, [...base, "sections"]); sections(slot.sections); break;
      case "relation-grid": case "data-grid": object(slot, [...base, "relatedModule"]); nonempty(slot.relatedModule); break;
      case "form": object(slot, [...base, "fields", "submitPermission"]); refs(slot.fields); nonempty(slot.submitPermission); check(Boolean(m.capabilities.edit), "form requires edit binding"); break;
      case "timeline": object(slot, [...base, "dateField"]); check(m.fields.some(f => f.key === slot.dateField && ["date", "datetime"].includes(f.type)), "timeline requires date field"); break;
      case "media": case "metric-cards": object(slot, [...base, "fields"]); refs(slot.fields); break;
      case "audit-events": object(slot, [...base, "subjectType"]); nonempty(slot.subjectType); break;
      case "approved-extension": object(slot, [...base, "extensionId", "approval"]); nonempty(slot.extensionId); validateApproval(slot.approval); break;
      default: check(false, "unapproved slot kind");
    }
  }
  const history = m.detail.history;
  if (history?.kind === "unavailable") { object(history, ["kind", "reason"]); nonempty(history.reason); }
  else { object(history, ["kind", "source", "load"]); check(history.kind === "provider" && typeof history.load === "function" && Boolean(m.capabilities.history), "missing history provider/permission"); source(history.source); }
}
