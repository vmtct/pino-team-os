import type { NotionPage } from "@/lib/notion/types";

type RecordValue = Record<string, unknown>;

function record(value: unknown): RecordValue | null {
  return value && typeof value === "object" ? (value as RecordValue) : null;
}

function richText(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => record(item)?.plain_text)
    .filter((text): text is string => typeof text === "string")
    .join("");
}

export function textProp(page: NotionPage, name: string): string {
  const property = record(page.properties[name]);
  if (!property) return "";

  if (property.type === "title") return richText(property.title);
  if (property.type === "rich_text") return richText(property.rich_text);
  if (property.type === "email") return typeof property.email === "string" ? property.email : "";
  if (property.type === "phone_number") return typeof property.phone_number === "string" ? property.phone_number : "";
  return "";
}

export function selectProp(page: NotionPage, name: string): string {
  const property = record(page.properties[name]);
  const select = record(property?.select);
  return typeof select?.name === "string" ? select.name : "";
}

export function multiSelectProp(page: NotionPage, name: string): string[] {
  const property = record(page.properties[name]);
  if (!Array.isArray(property?.multi_select)) return [];
  return property.multi_select
    .map((item) => record(item)?.name)
    .filter((name): name is string => typeof name === "string");
}

export function relationIds(page: NotionPage, name: string): string[] {
  const property = record(page.properties[name]);
  if (!Array.isArray(property?.relation)) return [];
  return property.relation
    .map((item) => record(item)?.id)
    .filter((id): id is string => typeof id === "string");
}

export function dateStartProp(page: NotionPage, name: string): string {
  const property = record(page.properties[name]);
  const date = record(property?.date);
  return typeof date?.start === "string" ? date.start : "";
}

export function checkboxProp(page: NotionPage, name: string, fallback = false): boolean {
  const property = record(page.properties[name]);
  return typeof property?.checkbox === "boolean" ? property.checkbox : fallback;
}
