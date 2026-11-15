"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { DrawerFrame } from "@/app/components/workspace-renderer/DrawerFrame";
import { loadNativeParentDirectory, type NativeParentRow } from "@/app/bo/parents/parent-native-data";

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
  return <DrawerFrame title={title} path="Tài khoản" onClose={close} footer={receipt
    ? <button type="button" className="primary-btn" onClick={close}>Đóng</button>
    : <>
      <button type="button" className="secondary-btn" disabled={busy} onClick={close}>Hủy</button>
      <button type="submit" form="afterschool-pin-form" className="primary-btn"
        disabled={!selected || busy}>{title}</button>
    </>}>
    {receipt ? <div className="settings-panel" role="status">
      <p>PIN tạm chỉ hiện một lần.</p>
      <output aria-label="PIN tạm">{receipt.pin}</output>
      <p>Hết hạn lúc {new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh",
      }).format(new Date(receipt.expiresAt))}.</p>
    </div> : <form id="afterschool-pin-form" className="settings-panel" onSubmit={submit} aria-busy={busy}>
      {parent ? <p>Phụ huynh: {parent.name}</p> : <>
        {!parents && !error && <p role="status">Đang tải danh sách phụ huynh…</p>}
        {parents && <>
          <label>Tìm phụ huynh
            <input type="search" value={search} disabled={busy} onChange={(event) => {
              setSearch(event.target.value); setSelectedId("");
            }} />
          </label>
          <label>Phụ huynh
            <select value={selectedId} required disabled={busy} onChange={(event) => setSelectedId(event.target.value)}>
              <option value="">Chọn phụ huynh</option>
              {filtered?.map((item) => <option key={item.id} value={item.id}>
                {item.name}{item.maskedContact ? " · " + item.maskedContact : ""}
              </option>)}
            </select>
          </label>
        </>}
      </>}
      <label>Số điện thoại đã xác minh
        <input name="confirmedPhone" type="tel" autoComplete="off" maxLength={32} required disabled={!selected || busy} />
      </label>
      <label>
        <input type="checkbox" required disabled={!selected || busy} />
        {parent ? "Xác nhận danh tính và thu hồi các phiên hiện tại." : "Đã xác minh danh tính phụ huynh."}
      </label>
      {error && <p className="edit-error" role="alert">{error}</p>}
    </form>}
  </DrawerFrame>;
}
