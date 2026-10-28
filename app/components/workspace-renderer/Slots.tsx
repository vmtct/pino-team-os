"use client";
import { Children, Fragment, isValidElement, useCallback, type ReactNode } from "react";
import { BoDataTable } from "../../bo/components/registration/BoDataTable";
import { BoValue } from "../../bo/components/registration/BoValue";
import type { BoRecord } from "@/lib/bo-registration";
import type { AuthorizationContext, BusinessSlot, ModuleSchema } from "@/lib/workspace-schema";
import { allows } from "@/lib/workspace-schema";
import { PropertySections } from "./Properties";
import { recordProjection } from "./projection";
import { useResource } from "./useResource";

export type SlotLoaders = Readonly<Record<string, (slot: BusinessSlot<string>, record: BoRecord, context: AuthorizationContext, signal: AbortSignal) => Promise<ReactNode>>>;
/** Content-only bindings use DS primitives, never another shell or opaque component. */
export function checkedSlotContent(content: ReactNode): ReactNode {
  Children.forEach(content, node => {
    if (!isValidElement(node)) return;
    if (typeof node.type !== "string" && ![Fragment, BoDataTable, BoValue, PropertySections].includes(node.type as typeof Fragment)) throw Error("Unapproved business content component");
    const props = node.props as { className?: string; id?: string; role?: string; children?: ReactNode; style?: unknown; dangerouslySetInnerHTML?: unknown; "data-tdd-shell"?: unknown };
    if (["style", "script", "iframe", "object"].includes(String(node.type)) || props.style !== undefined || props.dangerouslySetInnerHTML !== undefined ||
      /(?:^|\s)(?:detail-(?:cover|hero[\w-]*|tabs?|main|panel)|drawer[\w-]*|bo-full-detail|v25-full-width)(?:\s|$)/.test(props.className ?? "") ||
      ["tab", "tablist", "tabpanel", "dialog"].includes(props.role ?? "") || /^(?:detail-(?:screen|body|title|tabs?)|drawer)(?:-|$)/.test(props.id ?? "") || props["data-tdd-shell"] !== undefined) throw Error("Business content cannot own a TDD shell");
    const inspect = (value: unknown) => { if (isValidElement(value)) checkedSlotContent(value); else if (Array.isArray(value)) value.forEach(inspect); };
    Object.values(props).forEach(inspect);
  });
  return content;
}
function SlotRequest({ load }: { readonly load: (signal: AbortSignal) => Promise<ReactNode> }) {
  const { result, retry } = useResource(load);
  if (result.status === "loading") return <p role="status">Đang tải nội dung…</p>;
  if (result.status === "error") return <div role="alert">Không thể tải nội dung. <button type="button" onClick={retry}>Thử lại</button></div>;
  return <>{checkedSlotContent(result.value)}</>;
}
export function BusinessPanel({ schema, context, record, slot, loaders }: { readonly schema: ModuleSchema; readonly context: AuthorizationContext; readonly record: BoRecord; readonly slot: BusinessSlot<string>; readonly loaders?: SlotLoaders }) {
  const provider = loaders?.[slot.source.adapter];
  const load = useCallback(async (signal: AbortSignal) => checkedSlotContent(await provider!(slot, record, context, signal)), [provider, slot, record, context]);
  if (!allows(schema, context, "read") || !context.authorize(slot.source.permission)) return <p role="status">Không có quyền xem nội dung.</p>;
  const projection = recordProjection(schema, context, record);
  if (!projection) return <p role="status">Không có quyền xem nội dung.</p>;
  if (slot.kind === "field-group") return <PropertySections variant="detail" fields={projection.fields} record={projection.record} sections={slot.sections} />;
  if (slot.kind === "form" && (!allows(schema, context, "edit") || !context.authorize(slot.submitPermission))) return <PropertySections variant="detail" fields={projection.fields} record={projection.record} sections={[{ id: slot.id, label: slot.label, fields: slot.fields }]} />;
  if (!provider) return <p className="v24-audit-empty" role="status">Nội dung chưa khả dụng.</p>;
  return <SlotRequest load={load} />;
}
