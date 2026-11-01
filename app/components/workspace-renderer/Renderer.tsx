"use client";
import { allows, type FieldSchema, type TddRegistry } from "@/lib/workspace-schema";
import type { ReactNode } from "react";
import { TddDrawer, TddDetail, registeredSchema, RecordState } from "./Record";
import { DrawerFrame } from "./DrawerFrame";
import { TddTable, type TddTableProps } from "./Table";
import { TosButton } from "@pino/design-system/react";
import { useRef, useState } from "react";
import { authorizedHostActions, tddActionFeedback, type AuthorizationContext, type ModuleSchema, type TddActionDescriptor, type TddActionBindings } from "@/lib/workspace-schema";

export type TddStage<F extends readonly FieldSchema[] = readonly FieldSchema[]> =
  | { readonly kind: "table"; readonly props: TddTableProps<F>; readonly mobileMenu?: ReactNode }
  | { readonly kind: "drawer"; readonly props: Parameters<typeof TddDrawer<F>>[0]; readonly table?: TddTableProps<F> }
  | { readonly kind: "detail"; readonly props: Parameters<typeof TddDetail<F>>[0] }
  | { readonly kind: "form"; readonly props: { readonly registry: TddRegistry; readonly schema: ModuleSchema<F>; readonly context: AuthorizationContext; readonly mode: "create" | "edit"; readonly recordId?: string; readonly title: string; readonly content: ReactNode; readonly onClose: () => void; readonly actionBindings: TddActionBindings } };
/** Controlled stage seam: hosting adapters retain URL, selection, scroll and server paging. */
export function TddRenderer<F extends readonly FieldSchema[]>({ view }: { readonly view: TddStage<F> }) {
  const schema = registeredSchema(view.props.registry, view.props.schema);
  if (!allows(schema, view.props.context, "read")) return <RecordState status="denied" />;
  switch (view.kind) {
    case "table": return <section id="list-screen"><div className="page-heading"><div className="page-heading-left">{view.mobileMenu}<h1>{view.props.schema.label}</h1></div>{view.props.actionBindings ? <TddActionHost schema={schema} context={view.props.context} slot="table.header" bindings={view.props.actionBindings} /> : null}</div><TddTable {...view.props} /></section>;
    case "drawer": {
      if (view.table && (view.table.schema !== view.props.schema || view.table.context !== view.props.context)) throw Error("TDD Drawer background scope mismatch");
      return <>{view.table ? <TddTable {...view.table} /> : null}<TddDrawer {...view.props} headerActions={view.props.actionBindings && view.props.status !== "denied" ? <TddActionHost schema={schema} context={view.props.context} slot="drawer.header" bindings={view.props.actionBindings} /> : null} /></>;
    }
    case "form": {
      const { mode, recordId, actionBindings, onClose, title, content } = view.props;
      if (!allows(schema, view.props.context, mode) || (mode === "edit" && !recordId?.trim()) || (mode === "create" && recordId !== undefined)) return <RecordState status="denied" />;
      const footer = authorizedHostActions(schema, view.props.context, "drawer.footer", actionBindings, undefined, mode);
      // A destructive confirmation is a valid form submit when its authorized action is danger-only.
      if (!footer.some(action => action.variant === "primary" || action.variant === "danger")) return <RecordState status="denied" />;
      return <DrawerFrame title={title} path={schema.label} onClose={onClose} footer={<TddActionHost schema={schema} context={view.props.context} slot="drawer.footer" formMode={mode} bindings={actionBindings} />}>{content}</DrawerFrame>;
    }
    case "detail": return <TddDetail {...view.props} renderActionSlot={view.props.actionBindings && view.props.status !== "denied" ? (slot, targetId) => <TddActionHost schema={schema} context={view.props.context} slot={slot} targetId={targetId} bindings={view.props.actionBindings!} /> : undefined} headerActions={view.props.actionBindings && view.props.status !== "denied" ? <TddActionHost schema={schema} context={view.props.context} slot="detail.header" bindings={view.props.actionBindings} /> : null} />;
    default: throw Error("Unknown TDD renderer stage");
  }
}
/** Shared engine action chrome: one deterministic order, authorization rechecked at invocation. */
export function TddActionHost({ schema, context, slot, bindings, targetId, formMode }: {
  schema: ModuleSchema; context: AuthorizationContext; slot: TddActionDescriptor["slot"];
  bindings: TddActionBindings; targetId?: string; formMode?: "create" | "edit";
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const pending = useRef(false);
  const actions = authorizedHostActions(schema, context, slot, bindings, targetId, formMode);
  if (!actions.length) return null;
  return <div className="tdd-action-host" data-tdd-action-slot={slot} role="group"
    aria-label="Thao tác" aria-busy={busy !== null}>
    {actions.map(action => {
      const binding = bindings[action.handler];
      if (!binding) return null;
      const disabled = Boolean(busy || binding.disabled);
      return <TosButton key={action.id} type="button"
        variant={action.variant === "primary" ? "primary" : "secondary"}
        disabled={disabled} onClick={() => {
          if (disabled || pending.current || !allows(schema, context, action.capability)) return;
          pending.current = true;
          setBusy(action.id); setError(""); setNotice("");
          void Promise.resolve().then(() => binding.run())
            .then(result => {
              const feedback = tddActionFeedback(binding, result);
              if (feedback.kind === "error") setError(feedback.message);
              else if (feedback.kind === "success") setNotice(feedback.message);
            })
            .catch(() => setError("Chưa xác minh được kết quả. Đọc lại dữ liệu trước khi thử lại."))
            .finally(() => { pending.current = false; setBusy(null); });
        }}>{action.label}</TosButton>;
    })}
    {error ? <p role="alert">{error}</p> : null}
    {notice ? <p role="status">{notice}</p> : null}
  </div>;
}
