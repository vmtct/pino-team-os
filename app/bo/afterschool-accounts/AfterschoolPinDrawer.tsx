"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { DrawerFrame } from "@/app/components/workspace-renderer/DrawerFrame";
import { PropertySections } from "@/app/components/workspace-renderer/Properties";
import type { BoField, BoRecord } from "@/lib/bo-registration";
import { loadNativeParentDirectory, type NativeParentRow } from "@/app/bo/parents/parent-native-data";

// PAP-1886 — use the canonical in-flow drawer property renderer, not the off-canvas settings panel.
const pinFields: BoField[] = [
  { key: "search", label: "Tìm phụ huynh", type: "text", icon: "Aa", w: 160 },
  { key: "parent", label: "Phụ huynh", type: "text", icon: "Aa", w: 160 },
  { key: "phone", label: "Số điện thoại đã xác minh", type: "text", icon: "Aa", w: 160 },
  { key: "confirmation", label: "Xác minh danh tính", type: "text", icon: "Aa", w: 160 },
];
type Parent = { id: string; name: string };

export function AfterschoolPinDrawer({ centerId, parent, onClose, onChanged, onExisting }: {
  centerId: string;
  parent: Parent | null;
  onClose: () => void;
  onChanged: () => void;
  onExisting: (parentId: string) => Promise<boolean>;
}) {
  const [parents, setParents] = useState<NativeParentRow[] | null>(null);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<{ pin: string; expiresAt: string } | null>(null);
  const selected = parent ?? parents?.find((item) => item.id === selectedId);
  const title = parent ? "Cấp lại PIN" : "Tạo tài khoản";

  useEffect(() => {
    if (parent) return;
    const controller = new AbortController();
    void loadNativeParentDirectory(centerId, controller.signal).then(
      (items) => { if (!controller.signal.aborted) setParents(items); },
      () => { if (!controller.signal.aborted) setError("Không thể tải danh sách phụ huynh tại cơ sở này."); },
    );
    return () => controller.abort();
  }, [centerId, parent]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || submitting.current || receipt) return;
    const form = event.currentTarget;
    const confirmedPhone = String(new FormData(form).get("confirmedPhone") ?? "").trim();
    setError("");
    submitting.current = true;
    setBusy(true);
    try {
      const action = parent ? "reset" : "issue-initial";
      const query = new URLSearchParams({ centerId });
      const response = await fetch("/api/bo/identity/afterschool-users/" + encodeURIComponent(selected.id) + "/pin/" + action + "?" + query, {
        method: "POST",
        credentials: "same-origin",
        redirect: "error",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmedPhone }),
      });
      form.reset();
      if (response.status === 409 && !parent) {
        if (!(await onExisting(selected.id))) setError("Tài khoản đã tồn tại hoặc số điện thoại bị trùng. Kiểm tra lại danh sách Tài khoản.");
        return;
      }
      if (!response.ok) {
        setError(response.status === 403 || response.status === 404
          ? "Không thể xác nhận phụ huynh, số điện thoại hoặc quyền tại cơ sở này."
          : "Chưa thể cấp PIN. Vui lòng kiểm tra lại.");
        return;
      }
      const { data } = await response.json();
      if (data?.parentId !== selected.id || data.centerId !== centerId
        || typeof data.temporaryPin !== "string" || !/^\d{6}$/.test(data.temporaryPin)
        || typeof data.expiresAt !== "string" || !Number.isFinite(Date.parse(data.expiresAt))) {
        setError("Cấp PIN chưa được xác minh. Kiểm tra trạng thái tài khoản trước khi thử lại.");
        return;
      }
      setReceipt({ pin: data.temporaryPin, expiresAt: data.expiresAt });
      onChanged();
    } catch {
      form.reset();
      setError("Chưa xác nhận được kết quả. Kiểm tra trạng thái tài khoản trước khi thử lại.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  const filtered = parents?.filter((item) =>
    item.name.toLocaleLowerCase("vi").includes(search.trim().toLocaleLowerCase("vi")));
  const close = () => { if (!submitting.current) onClose(); };
  const pinRecord: BoRecord = { id: parent?.id ?? "", name: parent?.name ?? "", parent: parent?.name ?? "" };
  return <DrawerFrame title={title} path="Tài khoản" onClose={close} footer={receipt
    ? <button type="button" className="primary-btn" onClick={close}>Đóng</button>
    : <>
      <button type="button" className="secondary-btn" disabled={busy} onClick={close}>Hủy</button>
      <button type="submit" form="afterschool-pin-form" className="primary-btn"
        disabled={!selected || busy}>{title}</button>
    </>}>
    {receipt ? <section className="property-section" role="status">
      <p>PIN tạm chỉ hiện một lần.</p>
      <output aria-label="PIN tạm">{receipt.pin}</output>
      <p>Hết hạn lúc {new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh",
      }).format(new Date(receipt.expiresAt))}.</p>
    </section> : <form id="afterschool-pin-form" onSubmit={submit} aria-busy={busy}>
      {!parent && !parents && !error && <p role="status">Đang tải danh sách phụ huynh…</p>}
      {!parent && parents?.length === 0 && <p role="status">Không có phụ huynh tại cơ sở này.</p>}
      {!parent && parents && parents.length > 0 && filtered?.length === 0 && <p role="status">Không tìm thấy phụ huynh phù hợp.</p>}
      <PropertySections variant="drawer" fields={pinFields} record={pinRecord}
        sections={[{ id: "account", label: "Thông tin tài khoản", fields: parent ? ["parent", "phone", "confirmation"] : ["search", "parent", "phone", "confirmation"] }]}
        createFields={{
          ...(!parent ? {
            search: { id: "afterschool-parent-search", value: search, onChange: setSearch,
              control: <input id="afterschool-parent-search" className="property-control" type="search" value={search} disabled={busy || !parents} onChange={event => { setSearch(event.target.value); setSelectedId(""); }} /> },
            parent: { id: "afterschool-parent", value: selectedId, onChange: setSelectedId,
              control: <select id="afterschool-parent" className="property-control" value={selectedId} required disabled={busy || !parents || parents.length === 0} onChange={event => setSelectedId(event.target.value)}>
                <option value="">Chọn phụ huynh</option>
                {filtered?.map(item => <option key={item.id} value={item.id}>{item.name}{item.maskedContact ? " · " + item.maskedContact : ""}</option>)}
              </select> },
          } : {}),
          phone: { id: "afterschool-confirmed-phone", value: "", onChange: () => {},
            control: <input id="afterschool-confirmed-phone" className="property-control" name="confirmedPhone" type="tel" autoComplete="off" maxLength={32} required disabled={!selected || busy} /> },
          confirmation: { id: "afterschool-confirmation", value: "", onChange: () => {},
            label: parent ? "Xác nhận danh tính và thu hồi các phiên hiện tại." : "Đã xác minh danh tính phụ huynh.",
            control: <input id="afterschool-confirmation" type="checkbox" required disabled={!selected || busy} /> },
        }} />
      {error && <p className="edit-error" role="alert">{error}</p>}
    </form>}
  </DrawerFrame>;
}
