"use client";

// PAP-1886 · BO Users TDD / PAP-1832 · Piner Identity.
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import { useContext, useEffect, useState } from "react";
import { BoApplicationShellContext } from "@/app/bo/shell/BoApplicationShellContext";
import { BoDataTable } from "@/app/bo/components/registration/BoDataTable";
import { useBoStagingUser } from "@/app/bo/components/registration/BoRuntimeBoundary";
import { AfterschoolPinDrawer } from "./AfterschoolPinDrawer";
import { BoQuickView } from "@/app/bo/components/registration/BoQuickView";
import { BoTableSettings, type BoSavedView } from "@/app/bo/components/registration/BoTableSettings";
import { useBoCenterSelection } from "@/app/bo/components/registration/BoCenterSelection";
import { defaultTable, type BoModule, type BoRecord, type BoTableState } from "@/lib/bo-registration";

const directory: BoModule = {
  label: "Tài khoản", group: "Học viên",
  fields: [
    { key: "name", label: "Phụ huynh", type: "text", icon: "Aa", w: 230, readonly: true },
    { key: "maskedPhone", label: "Số điện thoại", type: "text", icon: "Aa", w: 155, readonly: true },
    { key: "pinStatus", label: "Trạng thái PIN", type: "text", icon: "Aa", w: 150, readonly: true },
    { key: "temporaryPinExpiresAt", label: "PIN tạm hết hạn", type: "datetime", icon: "▦", w: 170, readonly: true },
    { key: "createdAt", label: "Created Time", type: "datetime", icon: "▦", w: 170, readonly: true },
    { key: "createdBy", label: "Created By", type: "text", icon: "Aa", w: 175, readonly: true },
    { key: "updatedAt", label: "Last Modified Time", type: "datetime", icon: "▦", w: 170, readonly: true },
    { key: "updatedBy", label: "Last Modified By", type: "text", icon: "Aa", w: 175, readonly: true },
  ],
};

const pinLabels: Readonly<Record<string, string>> = {
  ACTIVE: "Đã kích hoạt", TEMPORARY: "PIN tạm", EXPIRED: "Đã hết hạn", LOCKED: "Tạm khóa", REVOKED: "Đã thu hồi",
};
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const timestamp = (value: unknown) =>
  typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;
const label = (value: unknown) => typeof value === "string" && value.trim() ? value : "—";

function accountRecord(item: Record<string, unknown>): BoRecord {
  if (typeof item.parentId !== "string" || !idPattern.test(item.parentId) ||
      typeof item.pinStatus !== "string" || !Object.hasOwn(pinLabels, item.pinStatus)) {
    throw new Error("Dữ liệu tài khoản từ Core không hợp lệ.");
  }
  return {
    id: item.parentId, name: label(item.parentName),
    maskedPhone: typeof item.maskedPhone === "string" && /^\+?\d{0,2}••••\d{0,2}$/.test(item.maskedPhone)
      ? item.maskedPhone : "—",
    pinStatus: pinLabels[item.pinStatus]!,
    temporaryPinExpiresAt: timestamp(item.temporaryPinExpiresAt),
    createdAt: timestamp(item.createdAt), createdBy: label(item.createdBy),
    updatedAt: timestamp(item.updatedAt), updatedBy: label(item.updatedBy),
  };
}

export function AfterschoolAccounts() {
  const selection = useBoCenterSelection();
  if (selection?.error) return <p role="alert">{selection.error}</p>;
  if (selection?.loading) return <p role="status">Đang xác thực cơ sở…</p>;
  if (!selection?.selected) return <p role="status">Chọn cơ sở để xem tài khoản.</p>;
  return <ScopedAccounts key={selection.selected} centerId={selection.selected} />;
}

const initial = () => ({ ...defaultTable(directory.fields), pageSize: 15 });
function ScopedAccounts({ centerId }: { centerId: string }) {
  const menu = useContext(BoApplicationShellContext);
  const stagingUser = useBoStagingUser();
  const [pinDrawer, setPinDrawer] = useState<{ parent: { id: string; name: string } | null } | null>(null);
  const [cursor, setCursor] = useState<string>();
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ cursor?: string; rows: BoRecord[]; next: string | null }>();
  const [error, setError] = useState("");
  const [table, setTable] = useState<BoTableState>(initial);
  const [page, setPage] = useState(1);
  const [drawer, setDrawer] = useState<BoRecord | null>(null);
  const [settings, setSettings] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [views, setViews] = useState<BoSavedView[]>([]);
  const [activeView, setActiveView] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ centerId, limit: "50" });
    if (cursor) query.set("afterParentId", cursor);
    async function read() {
      const response = await fetch("/api/bo/identity/afterschool-users?" + query, {
        credentials: "same-origin", cache: "no-store", signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(response.status === 403 ? "Bạn không có quyền xem tài khoản tại cơ sở này." : "Không thể tải tài khoản.");
      }
      const { data } = await response.json() as { data?: {
        scopeCenterId?: unknown; items?: Record<string, unknown>[]; nextParentId?: unknown;
      } };
      if (data?.scopeCenterId !== centerId || !Array.isArray(data.items) ||
          (data.nextParentId !== null && (typeof data.nextParentId !== "string" ||
            !idPattern.test(data.nextParentId) || (cursor !== undefined && data.nextParentId <= cursor)))) {
        throw new Error("Không thể xác minh cơ sở hoặc trang dữ liệu.");
      }
      const rows = data.items.map(accountRecord);
      if (!controller.signal.aborted) {
        setResult(previous => ({ cursor, rows: cursor ? [...(previous?.rows ?? []), ...rows] : rows, next: data.nextParentId as string | null }));
      }
    }
    void read().catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không thể tải tài khoản.");
    });
    return () => controller.abort();
  }, [centerId, cursor, retry]);

  const rows = result?.rows ?? [];
  const loading = !error && (!result || result.cursor !== cursor);
  const update = (change: Partial<BoTableState>) => {
    setTable(old => ({ ...old, ...change }));
    setPage(1);
    setActiveView(null);
  };
  const applyView = (view: BoSavedView | null) => {
    setTable(view?.state ?? initial());
    setPage(1);
    setActiveView(view?.id ?? null);
  };
  return <section id="list-screen" aria-label="Tài khoản" data-bo-afterschool-directory="PAP-1886">
    <div className="page-heading"><div className="page-heading-left">{menu?.("menu-btn")}<h1>Tài khoản</h1></div>
      {stagingUser && result && !error && <button type="button" className="primary-btn"
        onClick={() => setPinDrawer({ parent: null })}>Tạo tài khoản</button>}
    </div>
    {error && <p role="alert">{error} <button type="button" className="ghost-btn"
      onClick={() => { setError(""); setRetry(value => value + 1); }}>Thử lại</button></p>}
    <BoDataTable module={directory} rows={rows} loadState={loading ? "loading" : error ? "error" : "ready"}
      value={table} update={update} page={page} setPage={setPage}
      onOpen={setDrawer} selected={drawer?.id} onSettings={setSettings}
      filterOpen={filterOpen} setFilterOpen={setFilterOpen}
      views={views} changeViews={setViews} activeView={activeView} applyView={applyView}
      reset={() => applyView(null)} undo={() => {}} canUndo={false}
      builtInViews={result?.next && <button type="button" className="ghost-btn" disabled={loading || Boolean(error)}
        onClick={() => setCursor(result.next!)}>Tải thêm tài khoản</button>} />
    {drawer && !pinDrawer && <BoQuickView module={directory} record={drawer}
      onClose={() => setDrawer(null)} hideDetailAction
      extraSection={stagingUser && !error && <button type="button" className="secondary-btn"
        onClick={() => setPinDrawer({ parent: { id: drawer.id, name: drawer.name } })}>Cấp lại PIN</button>} />}
    {pinDrawer && <AfterschoolPinDrawer centerId={centerId} parent={pinDrawer.parent}
      onClose={() => setPinDrawer(null)}
      onChanged={() => { setCursor(undefined); setRetry((value) => value + 1); }}
      onExisting={(id) => {
        const existing = rows.find((row) => row.id === id);
        if (!existing) return false;
        setDrawer(existing); setPinDrawer(null);
        return true;
      }} />}
    {settings && <BoTableSettings screen={settings} setScreen={setSettings}
      onClose={() => setSettings(null)} fields={directory.fields} rows={rows}
      value={table} update={update} views={views} setViews={setViews} applyView={applyView} />}
  </section>;
}
