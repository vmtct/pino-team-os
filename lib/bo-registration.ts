/** Shared presentation state. Domain values always come from authorized adapters. */
export type BoValue = string | number | boolean | string[] | null | undefined;
export type BoRecord = { id: string; name: string; [key: string]: BoValue };
export type BoFieldType = "text" | "id" | "select" | "number" | "currency" | "date" | "relation" | "boolean" | "textarea" | "datetime" | "multirelation" | "person" | "multiselect" | "email" | "url" | "formula";
export type BoField = { key: string; label: string; type: BoFieldType; icon: string; w: number; readonly?: boolean; options?: string[] };
export type BoModule = { label: string; group: string; fields: BoField[] };
export type BoRule = { field: string; op: string; value: string; second: string };
export type BoTableState = { search: string; rules: BoRule[]; logic: "AND" | "OR"; sort: string; desc: boolean; order: string[]; visible: string[]; group: string; collapsed: string[]; hiddenGroups: string[]; hideEmpty: boolean; pageSize: number; groupDesc: boolean; frozenThrough?: string | null };
export const norm = (value: unknown) => String(value ?? "").toLocaleLowerCase("vi").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
export const empty = (value: BoValue) => value == null || value === "" || (Array.isArray(value) && value.length === 0);
export const display = (value: BoValue): string => value == null ? "—" : Array.isArray(value) ? value.join(", ") : String(value);
export const opLabels: Record<string, string> = { contains: "chứa", not_contains: "không chứa", eq: "bằng", neq: "khác", starts: "bắt đầu bằng", ends: "kết thúc bằng", gt: "lớn hơn", gte: "lớn hơn hoặc bằng", lt: "nhỏ hơn", lte: "nhỏ hơn hoặc bằng", between: "trong khoảng", before: "trước", after: "sau", any: "có một trong", all: "có tất cả", empty: "trống", not_empty: "không trống" };
export function operators(type: BoFieldType) {
  return [...(["number", "currency", "formula"].includes(type) ? ["eq", "neq", "gt", "gte", "lt", "lte", "between"] : ["date", "datetime"].includes(type) ? ["eq", "before", "after", "between"] : type === "boolean" || type === "select" ? ["eq", "neq"] : ["multiselect", "multirelation"].includes(type) ? ["any", "all", "not_contains"] : ["contains", "not_contains", "eq", "neq", "starts", "ends"]), "empty", "not_empty"];
}
export function rulePass(row: BoRecord, rule: BoRule, fields: readonly BoField[]) {
  const field = fields.find(f => f.key === rule.field);
  if (!field) return false;
  const v = row[rule.field], a = norm(display(v)), b = norm(rule.value);
  if (rule.op === "empty") return empty(v);
  if (rule.op === "not_empty") return !empty(v);
  if (!rule.value) return true;
  if (rule.op === "contains") return a.includes(b);
  if (rule.op === "not_contains") return !a.includes(b);
  if (rule.op === "starts") return a.startsWith(b);
  if (rule.op === "ends") return a.endsWith(b);
  if (["any", "all"].includes(rule.op)) { const chosen = rule.value.split(",").map(x => norm(x.trim())); const actual = Array.isArray(v) ? v.map(norm) : [norm(v)]; return rule.op === "any" ? chosen.some(x => actual.includes(x)) : chosen.every(x => actual.includes(x)); }
  if (rule.op === "eq") return a === b;
  if (rule.op === "neq") return a !== b;
  if (empty(v)) return false;
  const numeric = ["number", "currency", "formula"].includes(field.type);
  const left = numeric ? Number(v) : Date.parse(String(v)), right = numeric ? Number(rule.value) : Date.parse(rule.value), upper = numeric ? Number(rule.second) : Date.parse(rule.second);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
  return rule.op === "between" ? Number.isFinite(upper) && left >= right && left <= upper : ["gt", "after"].includes(rule.op) ? left > right : rule.op === "gte" ? left >= right : ["lt", "before"].includes(rule.op) ? left < right : rule.op === "lte" ? left <= right : false;
}
export function defaultTable(fields: readonly BoField[]): BoTableState {
  return { search: "", rules: [], logic: "AND", sort: "", desc: false, order: fields.map(f => f.key), visible: fields.map(f => f.key), group: "", collapsed: [], hiddenGroups: [], hideEmpty: true, pageSize: 8, groupDesc: false };
}
export function tableRows(rows: readonly BoRecord[], fields: readonly BoField[], state: BoTableState) {
  const found = rows.filter(row => (!state.search || fields.some(f => norm(display(row[f.key])).includes(norm(state.search)))) && (!state.rules.length || (state.logic === "AND" ? state.rules.every(r => rulePass(row, r, fields)) : state.rules.some(r => rulePass(row, r, fields)))));
  if (state.sort) { const f = fields.find(f => f.key === state.sort); found.sort((a, b) => { const av = a[state.sort], bv = b[state.sort]; const d = f && ["number", "currency", "formula"].includes(f.type) ? Number(av ?? 0) - Number(bv ?? 0) : display(av).localeCompare(display(bv), "vi", { numeric: true }); return state.desc ? -d : d; }); }
  return found;
}
/** Unknown actions stay localized, never expose machine event codes as UI copy. */
export function auditActionLabel(action: string) {
  // The admitted Core projection already supplies these safe Vietnamese labels.
  if (["Tạo học viên", "Cập nhật học viên", "Tạo lớp học", "Cập nhật lớp học", "Cập nhật bản ghi"].includes(action)) return action;
  const verb = action.toLowerCase();
  if (/creat|intake|register/.test(verb)) return "Tạo hồ sơ";
  if (/archiv|retir|delet|neutraliz/.test(verb)) return "Lưu trữ hồ sơ";
  if (/status|activat|deactivat/.test(verb)) return "Đổi trạng thái";
  if (/updat|edit|patch|chang/.test(verb)) return "Cập nhật thông tin";
  if (/assign|enroll|place/.test(verb)) return "Cập nhật phân công";
  if (/read|view|list/.test(verb)) return "Xem hồ sơ";
  return "Thao tác hồ sơ";
}
export function editorPosition(anchor: { left: number; top: number }, panel: { width: number; height: number }, viewport: { width: number; height: number }) {
  return { left: Math.max(8, Math.min(anchor.left, viewport.width - panel.width - 8)), top: Math.max(8, Math.min(anchor.top, viewport.height - panel.height - 8)), maxHeight: Math.max(130, viewport.height - 16) };
}
