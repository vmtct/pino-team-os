"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BoDataGrid, BoDataGridCanonicalId, BoDataGridSidePeek,
  type BoDataGridColumn,
} from "@/app/bo/components/data-grid";
import { requireBoModule } from "./registry";
import type { BoPublicViewRuntime } from "@/lib/bo-public-view-runtime";

/**
 * PAP-926 V1 factory: one registered entrypoint, existing canonical grid +
 * peek primitives. No new bespoke Table/Drawer shell. Read-only until the
 * PAP-874/PAP-888 property-editor and PAP-924 public tabs adapters bind.
 *
 * Domain adapter reads MUST be server-authorized; registry permissions are
 * declarations, never a client-side authorization substitute.
 */
export type BoModuleReadAdapter = {
  list(fetcher?: typeof fetch): Promise<readonly Record<string, unknown>[]>;
};
function displayValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.map(displayValue).join(", ");
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return "—";
}
export function BoModuleFactory({ moduleKey, adapter, publicViewRuntime }: { moduleKey: string; adapter: BoModuleReadAdapter; publicViewRuntime?: BoPublicViewRuntime }) {
  // Deny an unknown entrypoint BEFORE issuing a domain read.
  const definition=requireBoModule(moduleKey);
  const [rows,setRows]=useState<readonly Record<string,unknown>[]>([]);
  const [status,setStatus]=useState<"loading"|"ready"|"error">("loading");
  const [selected,setSelected]=useState<Record<string,unknown>|null>(null);
  useEffect(()=>{
    let cancelled=false;
    adapter.list().then(next=>{
      if(cancelled)return;
      if (!Array.isArray(next) || next.some(row=>typeof row.id!=="string")) {
        setStatus("error");return;
      }
      setRows(next);setStatus("ready");
    }).catch(()=>{if(!cancelled)setStatus("error");});
    return ()=>{cancelled=true;};
  },[adapter]);
  const columns=useMemo(()=>definition.fields.map(field=>({
    key:field.key,header:field.label,
    render:(row:Record<string,unknown>)=>field.type==="id"
      ? <BoDataGridCanonicalId value={String(row.id)} />
      : displayValue(row[field.key]),
    minWidth:field.type==="id"?140:110,
  } satisfies BoDataGridColumn<Record<string,unknown>>)),[definition]);
  const title=definition.label;
  return (
    <section aria-label={title}>
      <h1>{title}</h1>
      <BoDataGrid rows={rows} columns={columns} rowKey={row=>String(row.id)}
        caption={title} state={status} onRowOpen={setSelected} publicViewRuntime={publicViewRuntime}
        emptyTitle="Không có bản ghi" emptyMessage="Chưa có dữ liệu có quyền truy cập." />
      {selected && <BoDataGridSidePeek title={displayValue(selected.name??selected.id)}
        onClose={()=>setSelected(null)}>
        <dl>{definition.fields.map(field=>
          <div key={field.key}>
            <dt>{field.label}</dt>
            <dd>{displayValue(selected[field.key])}</dd>
          </div>)}</dl>
        <p>Thuộc tính chỉ xem ở V1; cần shared property editor PAP-874/888 để bật chỉnh sửa.</p>
      </BoDataGridSidePeek>}
    </section>
  );
}
