"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function ScheduleLogin({ error: initialError = "" }: { error?: string }) {
  const router = useRouter();
  const [mobile, setMobile] = useState("");
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const normalized = mobile.replace(/\D/g, "");
    if (!normalized) {
      setError("Vui lòng nhập số điện thoại.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/staff/identify?mobile=${encodeURIComponent(normalized)}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.error === "inactive_staff" ? "Nhân sự này hiện không hoạt động." : "Không tìm thấy nhân sự với số điện thoại này.");
      }
      router.replace(`/schedule?t=${encodeURIComponent(result.mobile)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể xác nhận số điện thoại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="main">
      <div className="page" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <section className="card" style={{ width: "min(460px, 100%)", padding: 32 }}>
          <div className="eyebrow">PINO TEAM OS</div>
          <h1 style={{ marginTop: 8 }}>Xem lịch làm việc</h1>
          <p className="subtitle">Nhập số điện thoại để xác nhận nhân sự.</p>
          <form onSubmit={submit} style={{ marginTop: 24 }}>
            <label style={{ display: "grid", gap: 8 }}>
              <span style={{ fontWeight: 700 }}>Số điện thoại</span>
              <input autoFocus inputMode="tel" autoComplete="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="09xxxxxxxx" style={{ padding: "14px 16px", borderRadius: 10, border: "1px solid #ccc", fontSize: 18 }} />
            </label>
            {error ? <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "#fff1f2", color: "#991b1b" }}>{error}</div> : null}
            <button type="submit" disabled={loading} style={{ width: "100%", marginTop: 18, padding: "14px 18px", borderRadius: 10, border: 0, fontWeight: 800 }}>{loading ? "Đang xác nhận..." : "Xác nhận"}</button>
          </form>
        </section>
      </div>
    </main>
  );
}
