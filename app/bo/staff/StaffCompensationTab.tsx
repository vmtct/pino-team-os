"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { boApi } from "@/lib/bo-api";
import type { BoStaffCompensationEntry } from "@/lib/bo-model";
import { createStaffPrivateRevealFence } from "@/lib/staff-private-reveal-fence";
import { staffCompensationOnly } from "@/lib/bo-staff-compensation-scope";
import styles from "../bo.module.css";

type Reveal =
  | { status: "idle" | "loading" | "denied" }
  | { status: "ready"; entries: BoStaffCompensationEntry[] };

const currency = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });

/** PAP-789: sensitive Staff compensation never prefetches in the Staff shell or directory. */
export function StaffCompensationTab({
  staffId,
  centers,
}: {
  staffId: string;
  centers: readonly { id: string; label: string }[];
}) {
  const [centerId, setCenterId] = useState("");
  const [reveal, setReveal] = useState<Reveal>({ status: "idle" });
  const fence = useRef(createStaffPrivateRevealFence());

  function hide() {
    fence.current.invalidate();
    setReveal({ status: "idle" });
  }

  useEffect(() => {
    // Selection changes or unmount cancel the ability of old responses to display private data.
    const guard = fence.current;
    guard.invalidate();
    const clearOnVisibility = () => {
      if (document.hidden) {
        guard.invalidate();
        setReveal({ status: "idle" });
      }
    };
    const clearOnPageHide = () => {
      guard.invalidate();
      setReveal({ status: "idle" });
    };
    document.addEventListener("visibilitychange", clearOnVisibility);
    window.addEventListener("pagehide", clearOnPageHide);
    return () => {
      guard.invalidate();
      document.removeEventListener("visibilitychange", clearOnVisibility);
      window.removeEventListener("pagehide", clearOnPageHide);
    };
  }, [staffId]);

  async function show() {
    const token = fence.current.begin();
    const requestedStaff = staffId;
    const requestedCenter = centerId;
    setReveal({ status: "loading" });
    try {
      const entries = await boApi.staffCompensation(requestedStaff, requestedCenter || undefined);
      if (fence.current.accepts(token)) setReveal({
        status: "ready",
        entries: staffCompensationOnly(entries, requestedStaff),
      });
    } catch {
      if (fence.current.accepts(token)) setReveal({ status: "denied" });
    }
  }

  return <section className={styles.panel} data-testid="staff-compensation-tab">
    <div className={styles.panelHeading}>
      <div><h2>Lịch sử lương</h2><p>Private Compensation · dữ liệu chỉ tải sau khi yêu cầu đọc được Core cho phép.</p></div>
      <span className={styles.readOnly}>private · VND</span>
    </div>
    <p>Staff ID: <code>{staffId}</code></p>
    <label className={styles.field}>Phạm vi đọc
      <select value={centerId} onChange={(event) => { hide(); setCenterId(event.target.value); }}>
        <option value="">Global / theo quyền của bạn</option>
        {centers.map((center) => <option key={center.id} value={center.id}>Center · {center.label}</option>)}
      </select>
    </label>
    {reveal.status === "idle" || reveal.status === "denied"
      ? <button type="button" className={styles.primaryButton} onClick={() => void show()}>Hiện lịch sử lương</button> : null}
    {reveal.status === "loading" ? <p role="status">Đang xác thực quyền đọc lương…</p> : null}
    {reveal.status === "denied" ? <p role="alert" className={styles.staffWarning}>Không có quyền xem lương hoặc dữ liệu tạm thời không khả dụng.</p> : null}
    {reveal.status === "ready" ? <>
      <button type="button" className={styles.secondaryButton} onClick={hide}>Ẩn lịch sử lương</button>
      {reveal.entries.length === 0 ? <p>Không có mốc Compensation trong phạm vi được cấp phép.</p>
        : <div className={styles.staffAssignmentList} data-testid="staff-compensation-revealed">
          {reveal.entries.map((item) => <article key={item.id} className={styles.staffAssignmentCard}>
            <div>
              <strong>{currency.format(item.amountMinor)} ₫</strong>
              <small>{item.state} · từ {item.effectiveFrom} đến trước {item.periodUntilExclusive ?? "chưa xác định"}</small>
              <small>{item.note ?? "Không có ghi chú"} · cập nhật {item.updatedAt.slice(0, 10)}</small>
            </div>
          </article>)}
        </div>}
    </> : null}
    <div className={styles.staffActions}>
      <Link href="/bo/workforce/compensation" className={styles.secondaryButton} onClick={hide}>Mở module Compensation để chỉnh sửa có kiểm soát</Link>
    </div>
    <p className={styles.readOnly}>Training/Qualification không tự thay đổi lương. Payroll là ledger riêng; màn hình này chỉ đọc mốc Compensation.</p>
  </section>;
}
