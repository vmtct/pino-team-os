"use client";

// PAP-1886 · BO Users TDD / PAP-1832 · Piner Identity.
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import { useContext, useEffect, useRef, useState } from "react";
import { BoApplicationShellContext } from "@/app/bo/shell/BoApplicationShellContext";
import { BoDataTable } from "@/app/bo/components/registration/BoDataTable";
import { useBoStagingUser } from "@/app/bo/components/registration/BoRuntimeBoundary";
import { AfterschoolHistory } from "./AfterschoolHistory";
import { AfterschoolPinDrawer } from "./AfterschoolPinDrawer";
import { DrawerFrame } from "@/app/components/workspace-renderer/DrawerFrame";
import { DetailFrame } from "@/app/components/workspace-renderer/DetailFrame";
import { PropertySections } from "@/app/components/workspace-renderer/Properties";
import { BoQuickView } from "@/app/bo/components/registration/BoQuickView";
import { BoTableSettings, type BoSavedView } from "@/app/bo/components/registration/BoTableSettings";
import { useBoCenterSelection } from "@/app/bo/components/registration/BoCenterSelection";
import { defaultTable, type BoModule, type BoRecord, type BoTableState } from "@/lib/bo-registration";

const directory: BoModule = {
  label: "Tài khoản", group: "Học viên",
  fields: [
    { key: "name", label: "Phụ huynh", type: "text", icon: "Aa", w: 230, readonly: true },
    { key: "maskedPhone", label: "Số điện thoại", type: "text", icon: "Aa", w: 155, readonly: true },
    { key: "center", label: "Chi nhánh", type: "text", icon: "Aa", w: 170, readonly: true },
    { key: "lastLoginAt", label: "Đăng nhập gần nhất", type: "datetime", icon: "▦", w: 175, readonly: true },
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
    center: label(item.centerName), lastLoginAt: timestamp(item.lastLoginAt),
    pinStatus: pinLabels[item.pinStatus]!,
    temporaryPinExpiresAt: timestamp(item.temporaryPinExpiresAt),
    createdAt: timestamp(item.createdAt), createdBy: label(item.createdBy),
    updatedAt: timestamp(item.updatedAt), updatedBy: label(item.updatedBy),
  };
}

async function readAccountPage(centerId: string, cursor?: string, signal?: AbortSignal) {
  const query = new URLSearchParams({ centerId, limit: "50" });
  if (cursor) query.set("afterParentId", cursor);
  const response = await fetch("/api/bo/identity/afterschool-users?" + query, {
    credentials: "same-origin", redirect: "error", cache: "no-store", ...(signal ? { signal } : {}),
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
  return { rows: data.items.map(accountRecord), next: data.nextParentId as string | null };
}

async function locateAccount(centerId: string, parentId: string) {
  let cursor: string | undefined;
  for (let page = 0; page < 100; page++) {
    const { rows, next } = await readAccountPage(centerId, cursor);
    const existing = rows.find((row) => row.id === parentId);
    if (existing) return existing;
    if (!next || next >= parentId) return null;
    cursor = next;
  }
  return null;
}

const overview = [{ id: "account", label: "Thông tin tài khoản", fields: directory.fields.map((field) => field.key) }];

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
  const [detail, setDetail] = useState<BoRecord | null>(null);
  const [personPicker, setPersonPicker] = useState(false);
  const [historyTab, setHistoryTab] = useState<string>("overview");
  const [settings, setSettings] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [views, setViews] = useState<BoSavedView[]>([]);
  const [activeView, setActiveView] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function read() {
      const { rows, next } = await readAccountPage(centerId, cursor, controller.signal);
      if (!controller.signal.aborted) {
        setResult(previous => ({ cursor, rows: cursor ? [...(previous?.rows ?? []), ...rows] : rows, next }));
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
  const actionsEnabled = Boolean(stagingUser && result && !error);
  const pinActionDrawer = pinDrawer && <AfterschoolPinDrawer centerId={centerId} parent={pinDrawer.parent}
    onClose={() => setPinDrawer(null)}
    onChanged={() => {
      setCursor(undefined); setRetry((value) => value + 1);
      if (detail) {
        void locateAccount(centerId, detail.id).then((fresh) => {
          setDetail((shown) => shown?.id === detail.id ? fresh : shown);
        }).catch(() => {
          setDetail((shown) => shown?.id === detail.id ? null : shown);
        });
      }
    }}
    onExisting={async (id) => {
      const existing = rows.find((row) => row.id === id) ?? await locateAccount(centerId, id);
      if (!existing) return false;
      setDrawer(null); setHistoryTab("overview"); setDetail(existing); setPinDrawer(null);
      return true;
    }} />;

  if (detail) return <DetailFrame title={detail.name} mobileMenu={menu?.("detail-menu-btn")}
    onBack={() => {setDetail(null);setHistoryTab("overview");}} tabs={[{ id: "overview", label: "Tổng quan" },{id:"history",label:"Lịch sử"}]} selected={historyTab} onSelect={setHistoryTab}
    after={pinActionDrawer}>
    {historyTab==="history" ? <AfterschoolHistory parentId={detail.id} centerId={centerId} revision={retry}/> : <PropertySections variant="detail" fields={directory.fields} record={detail} sections={overview} />}
    {actionsEnabled && <div className="afterschool-detail-actions" style={{ display: "flex", justifyContent: "flex-start", flexWrap: "wrap", gap: "8px", marginTop: "24px" }}>
      <button type="button" className="secondary-btn"
      onClick={() => setPinDrawer({ parent: { id: detail.id, name: detail.name } })}>Cấp lại PIN</button>
    </div>}
  </DetailFrame>;

  return <section id="list-screen" aria-label="Tài khoản" data-bo-afterschool-directory="PAP-1886">
    <div className="page-heading"><div className="page-heading-left">{menu?.("menu-btn")}<h1>Tài khoản</h1></div>
      <div className="heading-actions">{actionsEnabled && <button type="button" className="primary-btn"
        onClick={() => { setDrawer(null); setPinDrawer(null); setPersonPicker(true); }}>Tạo tài khoản</button>}
      </div>
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
      onClose={() => setDrawer(null)} onDetail={() => { setHistoryTab("overview"); setDetail(drawer); setDrawer(null); }} />}
    {pinActionDrawer}
    {personPicker && <PersonOptionsDrawer centerId={centerId} onClose={() => setPersonPicker(false)}
      onActivated={() => { setCursor(undefined); setRetry(value => value + 1); }} />}
    {settings && <BoTableSettings screen={settings} setScreen={setSettings}
      onClose={() => setSettings(null)} fields={directory.fields} rows={rows}
      value={table} update={update} views={views} setViews={setViews} applyView={applyView} />}
  </section>;
}

// PAP-2211 · Person-linked Piner User. Reads use the selected BO Center.
function PersonOptionsDrawer({ centerId, onClose, onActivated }: {
  centerId: string;
  onClose: () => void;
  onActivated: () => void;
}) {
  type Option = { personId: string; displayName: string | null; mobileLastFour: string | null; roles: string[] };
  const [options, setOptions] = useState<Option[]>([]);
  const [selected, select] = useState("");
  const [cursor, setCursor] = useState("");
  const [next, setNext] = useState<string | null>(null);
  const [loadedCursor, setLoadedCursor] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [activationError, setActivationError] = useState("");
  const [receipt, setReceipt] = useState<{ pin: string; expiresAt: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ centerId });
    if (cursor) query.set("afterPersonId", cursor);
    void (async () => {
      const response = await fetch("/api/bo/identity/afterschool-users/person-options?" + query, {
        credentials: "same-origin", cache: "no-store", signal: controller.signal,
      });
      if (!response.ok) throw new Error("Person picker unavailable");
      const { data } = await response.json() as {
        data?: { items?: Option[]; scopeCenterId?: string; nextPersonId?: string | null };
      };
      if (data?.scopeCenterId !== centerId || !Array.isArray(data.items)) throw new Error("Invalid picker scope");
      const items = data.items;
      if (!controller.signal.aborted) {
        setOptions(previous => cursor ? [...previous, ...items] : items);
        setNext(data.nextPersonId ?? null);
        setLoadedCursor(cursor);
      }
    })().catch(() => {
      if (!controller.signal.aborted) setError(true);
    });
    return () => controller.abort();
  }, [centerId, cursor, retry]);

  const pending = loadedCursor !== cursor && !error;
  const selectedOption = options.find(option => option.personId === selected);
  const hasParentActor = Boolean(selectedOption?.roles.includes("Parent"));

  async function activate() {
    if (!selectedOption || !hasParentActor || submitting.current || receipt) return;
    submitting.current = true;
    setBusy(true);
    setActivationError("");
    try {
      const query = new URLSearchParams({ centerId });
      const response = await fetch("/api/bo/identity/afterschool-users/person/" +
        encodeURIComponent(selectedOption.personId) + "/pin/issue-initial?" + query, {
        method: "POST",
        credentials: "same-origin",
        redirect: "error",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        setActivationError(response.status === 409
          ? "Không thể kích hoạt: tài khoản đã tồn tại hoặc số điện thoại chính của Parent chưa được xác minh."
          : response.status === 403 || response.status === 404
            ? "Không thể xác nhận Person hoặc quyền tại cơ sở đã chọn."
            : "Chưa thể kích hoạt tài khoản. Vui lòng thử lại sau.");
        return;
      }
      const { data } = await response.json() as {
        data?: { personId?: string; centerId?: string; temporaryPin?: string; expiresAt?: string };
      };
      if (data?.personId !== selectedOption.personId || data.centerId !== centerId
        || typeof data.temporaryPin !== "string" || !/^\d{6}$/.test(data.temporaryPin)
        || typeof data.expiresAt !== "string" || !Number.isFinite(Date.parse(data.expiresAt))) {
        setActivationError("Không thể xác minh biên nhận kích hoạt. Kiểm tra danh sách tài khoản trước khi thử lại.");
        return;
      }
      setReceipt({ pin: data.temporaryPin, expiresAt: data.expiresAt });
      onActivated();
    } catch {
      setActivationError("Chưa xác nhận được kết quả. Kiểm tra danh sách tài khoản trước khi thử lại.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  const close = () => { if (!submitting.current) onClose(); };
  return <DrawerFrame title={receipt ? "Tài khoản đã kích hoạt" : "Chọn Person"} path="Tài khoản" onClose={close}
    footer={receipt
      ? <button type="button" className="primary-btn" onClick={close}>Đóng</button>
      : <>
        <button type="button" className="secondary-btn" disabled={busy} onClick={close}>Hủy</button>
        <button type="button" className="primary-btn" disabled={!selectedOption || !hasParentActor || pending || error || busy}
          onClick={() => void activate()}>Kích hoạt tài khoản</button>
      </>}>
    {receipt ? <section className="property-section" role="status">
      <p>PIN tạm chỉ hiển thị một lần. Nhân viên nhận và chuyển PIN cho người dùng.</p>
      <output aria-label="PIN tạm">{receipt.pin}</output>
      <p>Hết hạn lúc {new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh",
      }).format(new Date(receipt.expiresAt))}.</p>
    </section> : <>
      <label htmlFor="account-person-options">Person</label>
      <select id="account-person-options" className="edit-input" value={selected}
        disabled={pending || Boolean(error) || busy}
        onChange={event => { select(event.target.value); setActivationError(""); }}>
        <option value="">Chọn một Person</option>
        {options.map(option => <option key={option.personId} value={option.personId}>
          {[option.displayName ?? "Chưa có tên", option.roles.join(" / "),
            option.mobileLastFour ? "•••• " + option.mobileLastFour : null].filter(Boolean).join(" · ")}
        </option>)}
      </select>
      {pending && <p role="status">Đang tải danh sách…</p>}
      {error && <p role="alert">Không thể tải danh sách.{" "}
        <button type="button" className="ghost-btn" onClick={() => { setError(false); setRetry(value => value + 1); }}>Thử lại</button>
      </p>}
      {!pending && !error && options.length === 0 && <p>Chưa có Person trong cơ sở này.</p>}
      {!pending && !error && next && <button type="button" className="ghost-btn" disabled={busy} onClick={() => setCursor(next)}>Tải thêm</button>}
      {selectedOption && hasParentActor && <p role="status">
        Chỉ cấp PIN khi mobile Person khớp với số điện thoại chính Parent đã xác minh tại cơ sở này.
      </p>}
      {selectedOption && !hasParentActor && <p role="status">
        Person này chưa đủ điều kiện đi qua luồng tương thích. Student/Guest cần credential Person và xác minh mobile theo PAP-1832 · PNR-IDENTITY.
      </p>}
      {activationError && <p role="alert">{activationError}</p>}
    </>}
  </DrawerFrame>;
}
