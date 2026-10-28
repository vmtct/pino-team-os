/** PAP-1069: the implemented i5 primitives, not the PAP-1079 scenario wishlist. */
export const FIELD_TYPES = ["text", "id", "select", "number", "currency", "date", "relation", "boolean", "textarea", "datetime", "multirelation", "person", "multiselect", "email", "url", "formula"] as const;
export type FieldType = typeof FIELD_TYPES[number];
/** Existing control families to consume in PR2; this registry adds no renderer. */
export const FIELD_METADATA = {
  text: { editor: "text", editable: true }, id: { editor: null, editable: false },
  select: { editor: "select", editable: true }, number: { editor: "number", editable: true },
  currency: { editor: "number", editable: true, currency: "VND" },
  date: { editor: "date", editable: true, calendar: "iso-date" },
  relation: { editor: "option-search", editable: true }, boolean: { editor: "checkbox", editable: true },
  textarea: { editor: "textarea", editable: true },
  datetime: { editor: "datetime-local", editable: true, timeZone: "Asia/Ho_Chi_Minh" },
  multirelation: { editor: "multi-option-search", editable: true }, person: { editor: "option-search", editable: true },
  multiselect: { editor: "multi-option-search", editable: true }, email: { editor: "email", editable: true },
  url: { editor: "url", editable: true }, formula: { editor: null, editable: false },
} as const satisfies Record<FieldType, { readonly editor: string | null; readonly editable: boolean; readonly currency?: "VND"; readonly calendar?: "iso-date"; readonly timeZone?: "Asia/Ho_Chi_Minh" }>;
export type FieldValues = {
  text: string; id: string; select: string; number: number; currency: number;
  date: string; relation: string; boolean: boolean; textarea: string; datetime: string;
  multirelation: readonly string[]; person: string; multiselect: readonly string[];
  email: string; url: string; formula: number;
};
export type FieldOperation = "display" | "search" | "filter" | "sort" | "group" | "inlineEdit";
export type FieldCapabilities = Readonly<Record<FieldOperation, boolean>>;
type Metadata = {
  readonly key: string;
  readonly label: string;
  readonly icon: string;
  readonly width: number;
  /** An existing adapter-owned permission key; never a grant. */
  readonly permission: string;
  readonly required?: boolean;
  readonly sensitive?: boolean;
  readonly hint?: string;
};
export type FieldValidation<T extends FieldType> =
  T extends "number" | "currency" | "formula" ? { readonly min?: number; readonly max?: number; readonly integer?: boolean } :
  T extends "multiselect" | "multirelation" ? { readonly minItems?: number; readonly maxItems?: number } :
  T extends "boolean" ? never : { readonly minLength?: number; readonly maxLength?: number };
export type FieldSchema = { [T in FieldType]: Metadata & { readonly type: T } &
  { readonly validation?: FieldValidation<T> } &
  (T extends "id" | "formula"
    ? { readonly readOnly: true; readonly capabilities: FieldCapabilities & { readonly inlineEdit: false } }
    : { readonly readOnly: boolean; readonly capabilities: FieldCapabilities }) &
  (T extends "select" | "multiselect" | "relation" | "multirelation" | "person"
    ? { readonly options?: readonly string[] }
    : { readonly options?: never })
}[FieldType];
export type FieldKey<F extends readonly FieldSchema[]> = F[number]["key"];
export type ModuleRow<F extends readonly FieldSchema[]> = { readonly id: string } & {
  readonly [P in F[number] as P["key"]]: FieldValues[P["type"]] | null | undefined;
};

const text = ["contains", "not_contains", "eq", "neq", "starts", "ends", "empty", "not_empty"] as const;
const numeric = ["eq", "neq", "gt", "gte", "lt", "lte", "between", "empty", "not_empty"] as const;
const date = ["eq", "before", "after", "between", "empty", "not_empty"] as const;
const choice = ["eq", "neq", "empty", "not_empty"] as const;
const multi = ["any", "all", "not_contains", "empty", "not_empty"] as const;
/** Matches bo-registration.operators; explicit field registration remains mandatory. */
export const FILTER_OPERATORS = {
  text, id: text, select: choice, number: numeric, currency: numeric, date,
  relation: text, boolean: choice, textarea: text, datetime: date,
  multirelation: multi, person: text, multiselect: multi, email: text, url: text, formula: numeric,
} as const satisfies Record<FieldType, readonly string[]>;
export type FilterOperator<T extends FieldType> = typeof FILTER_OPERATORS[T][number];
type ValueRule<P extends FieldSchema> = {
  [O in Exclude<FilterOperator<P["type"]>, "empty" | "not_empty" | "between">]: {
    readonly op: O;
    readonly value: P["type"] extends "multiselect" | "multirelation" ? O extends "not_contains" ? string : FieldValues[P["type"]] : FieldValues[P["type"]];
    readonly second?: never;
  }
}[Exclude<FilterOperator<P["type"]>, "empty" | "not_empty" | "between">];
type RuleFor<P extends FieldSchema> = P extends FieldSchema ? {
  readonly field: P["key"];
} & ({ readonly op: "empty" | "not_empty"; readonly value?: never; readonly second?: never }
  | ("between" extends FilterOperator<P["type"]> ? { readonly op: "between"; readonly value: FieldValues[P["type"]]; readonly second: FieldValues[P["type"]] } : never)
  | ValueRule<P>) : never;
export type FilterRule<F extends readonly FieldSchema[]> = RuleFor<F[number]>;

export function isFieldValue(type: FieldType, value: unknown): boolean {
  if (value == null) return true;
  if (type === "number" || type === "currency" || type === "formula") return typeof value === "number" && Number.isFinite(value);
  if (type === "boolean") return typeof value === "boolean";
  if (type === "multiselect" || type === "multirelation") return Array.isArray(value) && value.every(v => typeof v === "string");
  if (typeof value !== "string") return false;
  if (type === "date") return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  if (type === "datetime") return /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
  return true;
}

/** Presentation validation only; canonical server/domain validation remains authoritative. */
export function fieldValueErrors(field: FieldSchema, value: unknown): readonly string[] {
  if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) return field.required ? ["required"] : [];
  if (!isFieldValue(field.type, value)) return ["type"];
  const errors: string[] = [];
  const v = field.validation;
  if ((field.type === "number" || field.type === "currency" || field.type === "formula") && typeof value === "number") {
    const bounds = v as FieldValidation<"number"> | undefined;
    if (bounds?.min !== undefined && value < bounds.min) errors.push("min");
    if (bounds?.max !== undefined && value > bounds.max) errors.push("max");
    if (bounds?.integer && !Number.isInteger(value)) errors.push("integer");
  } else if (Array.isArray(value)) {
    const bounds = v as FieldValidation<"multiselect"> | undefined;
    if (bounds?.minItems !== undefined && value.length < bounds.minItems) errors.push("minItems");
    if (bounds?.maxItems !== undefined && value.length > bounds.maxItems) errors.push("maxItems");
  } else if (typeof value === "string") {
    const bounds = v as FieldValidation<"text"> | undefined;
    if (bounds?.minLength !== undefined && value.length < bounds.minLength) errors.push("minLength");
    if (bounds?.maxLength !== undefined && value.length > bounds.maxLength) errors.push("maxLength");
    if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errors.push("email");
    if (field.type === "url") { try { if (!["http:", "https:"].includes(new URL(value).protocol)) errors.push("url"); } catch { errors.push("url"); } }
  }
  if ((field.type === "select" || field.type === "multiselect") && field.options && (Array.isArray(value) ? value : [value]).some(x => !field.options!.includes(x as string))) errors.push("option");
  return errors;
}
