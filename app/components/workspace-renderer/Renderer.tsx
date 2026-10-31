"use client";
import { allows, type FieldSchema } from "@/lib/workspace-schema";
import type { ReactNode } from "react";
import { TddDrawer, TddDetail, registeredSchema, RecordState } from "./Record";
import { TddTable, type TddTableProps } from "./Table";
import { TddActionHost } from "./ActionHost";

export type TddStage<F extends readonly FieldSchema[] = readonly FieldSchema[]> =
  | { readonly kind: "table"; readonly props: TddTableProps<F>; readonly mobileMenu?: ReactNode }
  | { readonly kind: "drawer"; readonly props: Parameters<typeof TddDrawer<F>>[0]; readonly table?: TddTableProps<F> }
  | { readonly kind: "detail"; readonly props: Parameters<typeof TddDetail<F>>[0] };
/** Controlled stage seam: hosting adapters retain URL, selection, scroll and server paging. */
export function TddRenderer<F extends readonly FieldSchema[]>({ view }: { readonly view: TddStage<F> }) {
  const schema = registeredSchema(view.props.registry, view.props.schema);
  if (!allows(schema, view.props.context, "read")) return <RecordState status="denied" />;
  switch (view.kind) {
    case "table": return <section id="list-screen"><div className="page-heading"><div className="page-heading-left">{view.mobileMenu}<h1>{view.props.schema.label}</h1></div>{view.props.actionBindings ? <TddActionHost schema={schema} context={view.props.context} slot="table.header" bindings={view.props.actionBindings} /> : null}</div><TddTable {...view.props} /></section>;
    case "drawer": {
      if (view.table && (view.table.schema !== view.props.schema || view.table.context !== view.props.context)) throw Error("TDD Drawer background scope mismatch");
      return <>{view.table ? <TddTable {...view.table} /> : null}<TddDrawer {...view.props} /></>;
    }
    case "detail": return <TddDetail {...view.props} />;
    default: throw Error("Unknown TDD renderer stage");
  }
}
