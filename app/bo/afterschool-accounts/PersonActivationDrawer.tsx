"use client";

import { useEffect, useRef, useState } from "react";
import { DrawerFrame } from "@/app/components/workspace-renderer/DrawerFrame";

// PAP-2211 · Person-linked Piner User. The activation request contains only personId.
export function PersonActivationDrawer({ centerId, onClose, onActivated }: {
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
