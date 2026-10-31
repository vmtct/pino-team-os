"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { BoField, BoRecord } from "@/lib/bo-registration";
import { allows, allowsField, authorizedTabs, validateModule, type AuthorizationContext, type FieldSchema, type HistorySubject, type ModuleRow, type ModuleSchema, type TddRegistry, type TddActionBindings } from "@/lib/workspace-schema";
import { DetailFrame } from "./DetailFrame";
import { DrawerFrame } from "./DrawerFrame";
import { PropertySections, type OverviewProperties } from "./Properties";
import { TddHistory } from "./History";
import { BusinessFormPanel, BusinessPanel, type BusinessFormBinding, type SlotLoaders } from "./Slots";
import { recordProjection, renderScope } from "./projection";
import { PropertyEditor, type TddWrites } from "./Editor";
import { latestRequest } from "./resource";

export type TddRecordProps<F extends readonly FieldSchema[]> = {
  readonly registry: TddRegistry; readonly schema: ModuleSchema<F>; readonly context: AuthorizationContext;
  readonly record: ModuleRow<F>; readonly actionBindings?: TddActionBindings; readonly status?: "ready" | "loading" | "error" | "denied" | "not-found";
  readonly onRetry?: () => void;
};
export function registeredSchema<F extends readonly FieldSchema[]>(registry: TddRegistry, schema: ModuleSchema<F>): ModuleSchema {
  validateModule(schema);
  if (registry.get(schema.surface, schema.key) !== schema) throw Error("Renderer requires an admitted TDD registration");
  // Heterogeneous renderer only reads shared metadata; typed adapters retain their query type.
  return schema as unknown as ModuleSchema;
}
export function RecordState({ status, onRetry }: { readonly status: string; readonly onRetry?: () => void }) {
  return status === "error" ? <div role="alert">Không thể tải chi tiết. {onRetry ? <button type="button" onClick={onRetry}>Thử lại</button> : null}</div>
    : <p role="status">{status === "loading" ? "Đang tải chi tiết…" : status === "not-found" ? "Không tìm thấy bản ghi." : "Không có quyền xem bản ghi."}</p>;
}
type DrawerOptions<F extends readonly FieldSchema[]> = { readonly headerActions?: ReactNode; readonly onClose: () => void; readonly onDetail: () => void; readonly writes?: TddWrites<F>; readonly actions?: Readonly<Record<string, (record: BoRecord, context: AuthorizationContext, signal: AbortSignal) => Promise<void>>> };
export function TddDrawer<F extends readonly FieldSchema[]>(props: TddRecordProps<F> & DrawerOptions<F>) {
  const schema = registeredSchema(props.registry, props.schema);
  return <DrawerRecord key={renderScope(schema, props.context, props.record.id)} {...props} />;
}
function DrawerRecord<F extends readonly FieldSchema[]>({ registry, schema: input, context, record, status = "ready", onRetry, onClose, onDetail, writes, actions, headerActions }: TddRecordProps<F> & DrawerOptions<F>) {
  const schema = registeredSchema(registry, input);
  const [edit, setEdit] = useState<{ field: BoField; anchor: HTMLElement } | null>(null);
  const [actionState, setActionState] = useState("");
  const request = useRef(latestRequest<void>());
  useEffect(() => { const current = request.current; return () => current.cancel(); }, []);
  const projection = status === "ready" ? recordProjection(schema, context, record) : null;
  return <><DrawerFrame path={allows(schema, context, "read") ? schema.label : ""} title={projection?.title ?? "Chi tiết"} onClose={onClose} headerActions={projection ? headerActions : null}
    footer={<><button type="button" id="full-detail" className="primary-btn" disabled={!projection} onClick={onDetail}>↗ Full Detail</button>{projection ? schema.drawer.actions.filter(a => allows(schema, context, a.capability) && actions?.[a.id]).map(action => <button type="button" className="secondary-btn" key={action.id} disabled={actionState === "pending"} onClick={() => {
      if (!allows(schema, context, action.capability)) return;
      setActionState("pending"); void request.current.run(signal => actions![action.id](projection.record, context, signal), () => setActionState(""), () => setActionState("error"));
    }}>{action.label}</button>) : null}</>}>
    {projection ? <PropertySections variant="drawer" fields={projection.fields} record={projection.record} sections={schema.drawer.sections}
      canEdit={field => Boolean(writes?.version.trim()) && allowsField(schema, context, field.key, "inlineEdit")} onEdit={writes ? (field, anchor) => setEdit({ field, anchor }) : undefined} /> : <RecordState status={allows(schema, context, "read") ? status === "ready" ? "denied" : status : "denied"} onRetry={onRetry} />}
    {actionState === "error" ? <p role="alert">Không thể thực hiện thao tác. Thử lại sau.</p> : actionState === "pending" ? <p role="status">Đang thực hiện…</p> : null}
  </DrawerFrame>{edit && writes && projection ? <PropertyEditor schema={input} context={context} record={record} writes={writes} selection={edit} onClose={() => setEdit(null)} /> : null}</>;
}
export function TddDetail<F extends readonly FieldSchema[]>(props: TddRecordProps<F> & { readonly onBack: () => void; readonly subject: HistorySubject; readonly headerActions?: ReactNode; readonly renderActionSlot?: (slot: "overview.section" | "businessTab.toolbar", targetId: string) => ReactNode; readonly mobileMenu?: ReactNode; readonly loaders?: SlotLoaders; readonly businessForms?: BusinessFormBinding; readonly overviewAfter?: ReactNode; readonly renderOverviewProperties?: (properties: OverviewProperties) => ReactNode; readonly renderApprovedExtension?: (record: BoRecord, context: AuthorizationContext, activeTab: string) => ReactNode; readonly activeTab?: string; readonly onTabChange?: (id: string) => void; readonly returnFocus?: () => HTMLElement | null }) {
  const schema = registeredSchema(props.registry, props.schema);
  if (!allows(schema, props.context, "read")) return <RecordState status="denied" />;
  return <DetailRecord key={renderScope(schema, props.context, props.record.id)} {...props} schema={schema} />;
}
function DetailRecord({ schema, context, record, status = "ready", onRetry, onBack, subject, headerActions, renderActionSlot, mobileMenu, loaders, businessForms, overviewAfter, renderOverviewProperties, renderApprovedExtension, activeTab, onTabChange, returnFocus }: Omit<TddRecordProps<readonly FieldSchema[]>, "registry"> & { readonly onBack: () => void; readonly subject: HistorySubject; readonly headerActions?: ReactNode; readonly renderActionSlot?: (slot: "overview.section" | "businessTab.toolbar", targetId: string) => ReactNode; readonly mobileMenu?: ReactNode; readonly loaders?: SlotLoaders; readonly businessForms?: BusinessFormBinding; readonly overviewAfter?: ReactNode; readonly renderOverviewProperties?: (properties: OverviewProperties) => ReactNode; readonly renderApprovedExtension?: (record: BoRecord, context: AuthorizationContext, activeTab: string) => ReactNode; readonly activeTab?: string; readonly onTabChange?: (id: string) => void; readonly returnFocus?: () => HTMLElement | null }) {
  const [selected, setSelected] = useState("overview");
  const projection = status === "ready" ? recordProjection(schema, context, record) : null;
  const tabs = authorizedTabs(schema, context, projection?.record);
  const invalidSelected = Boolean(projection && activeTab && !tabs.some(tab => tab.id === activeTab));
  useEffect(() => { if (invalidSelected) onTabChange?.("overview"); }, [invalidSelected, activeTab, onTabChange]);
  const active = tabs.find(t => t.id === (activeTab ?? selected)) ?? tabs[0];
  if (subject.id !== record.id) throw Error("History subject does not match selected record");
  // Explicit, Founder-approved business extension: TDD still owns registration, tabs,
  // authorization, navigation and the DetailFrame. Keep one editor mounted across tabs
  // so unsaved metadata + permission membership remain one draft.
  const approvedExtension = active?.owner === "business" && active.slot.kind === "approved-extension";
  const hasApprovedExtension = schema.detail.businessTabs.some(slot => slot.kind === "approved-extension");
  if (renderApprovedExtension && !hasApprovedExtension) throw Error("TDD approved extension registration required");
  return <DetailFrame title={projection?.title ?? "Chi tiết"} subtitle={projection?.record.id} mobileMenu={mobileMenu} onBack={onBack} returnFocus={returnFocus} actions={projection ? headerActions : null}
    tabs={tabs.map(t => ({ id: t.id, label: t.label }))} selected={active?.id} onSelect={id => { setSelected(id); onTabChange?.(id); }}>
    {projection && renderApprovedExtension && hasApprovedExtension
      ? <>
          <div hidden={active?.id !== "overview" && !approvedExtension}>
            {renderApprovedExtension(projection.record, context, active?.id ?? "overview")}
          </div>
          {active?.id === "history" ? <TddHistory schema={schema} context={context} subject={subject} /> : null}
        </>
      : !projection ? <RecordState status={allows(schema, context, "read") ? status === "ready" ? "denied" : status : "denied"} onRetry={onRetry} />
      : active?.id === "overview" ? <>{renderOverviewProperties ? renderOverviewProperties({ fields: projection.fields, record: projection.record, sections: schema.detail.overview.sections.map(section => ({ ...section, fields: section.fields.filter(key => projection.fields.some(field => field.key === key)) })).filter(section => section.fields.length > 0) }) : <PropertySections variant="detail" fields={projection.fields} record={projection.record} sections={schema.detail.overview.sections} sectionActions={id => renderActionSlot?.("overview.section", id)} />}{overviewAfter}</>
      : active?.id === "history" ? <TddHistory schema={schema} context={context} subject={subject} />
      : active?.owner === "business" && allowsField(schema, context, schema.table.identity.field, "display") ? active.slot.kind === "form"
        ? <>{renderActionSlot?.("businessTab.toolbar", active.id)}<BusinessFormPanel key={active.id} schema={schema} context={context} record={projection.record} slot={active.slot} binding={businessForms} /></>
        : <>{renderActionSlot?.("businessTab.toolbar", active.id)}<BusinessPanel key={active.id} schema={schema} context={context} record={projection.record} slot={active.slot} loaders={loaders} /></> : null}
  </DetailFrame>;
}
