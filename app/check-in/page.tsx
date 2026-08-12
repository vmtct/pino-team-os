"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

type State = { loading: boolean; staffName: string; latest: { checkType: string; createdTime: string } | null; error: string; saving: boolean };

export default function CheckInPage() {
  const params = useSearchParams();
  const router = useRouter();
  const mobile = params.get("t") || "";
  const [note, setNote] = useState("");
  const [state, setState] = useState<State>({ loading: true, staffName: "", latest: null, error: "", saving: false });

  async function load() {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const response = await fetch(`/api/timesheet?t=${encodeURIComponent(mobile)}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error("Không thể xác định nhân sự.");
      setState({ loading: false, staffName: result.staff.name, latest: result.latest, error: "", saving: false });
    } catch (e) {
      setState((current) => ({ ...current, loading: false, error: e instanceof Error ? e.message : "Không thể tải trạng thái chấm công." }));
    }
  }

  useEffect(() => { if (mobile) load(); else setState((current) => ({ ...current, loading: false, error: "Thiếu số điện thoại." })); }, [mobile]);

  async function submit(checkType: "Check in" | "Check out") {
    setState((current) => ({ ...current, saving: true, error: "" }));
    try {
      const response = await fetch(`/api/timesheet?t=${encodeURIComponent(mobile)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ checkType, note }) });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        const messages: Record<string, string> = { already_checked_in: "Bạn đã check-in. Hãy check-out trước khi check-in lại.", not_checked_in: "Bạn chưa check-in nên chưa thể check-out.", checkin_disabled: "Chức năng chấm công hiện đang tạm tắt." };
        throw new Error(messages[result.error] || "Không thể ghi nhận chấm công.");
      }
      setNote("");
      await load();
    } catch (e) {
      setState((current) => ({ ...current, saving: false, error: e instanceof Error ? e.message : "Không thể ghi nhận chấm công." }));
    }
  }

  const canCheckIn = !state.latest || state.latest.checkType === "Check out";
  const canCheckOut = state.latest?.checkType === "Check in";

  function goSchedule() {
    router.push(`/schedule?t=${encodeURIComponent(mobile)}`);
  }

  return <main className="main"><div className="page" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}><section className="card" style={{ width: "min(560px, 100%)", padding: 32 }}><div className="eyebrow">PINO TEAM OS · CHECK IN / OUT</div>{state.loading ? <p className="subtitle">Đang tải...</p> : <><h1 style={{ marginTop: 8 }}>Xin chào {state.staffName}</h1><p className="subtitle">Chấm công trực tiếp trên hệ thống.</p><div className="card" style={{ marginTop: 24, background: "#fafafa" }}><div className="muted">TRẠNG THÁI</div><div style={{ marginTop: 8, fontSize: 22, fontWeight: 800 }}>{state.latest?.checkType === "Check in" ? "Đang làm việc" : "Chưa check-in"}</div>{state.latest?.createdTime ? <div className="muted" style={{ marginTop: 6 }}>{new Date(state.latest.createdTime).toLocaleString("vi-VN")}</div> : null}</div>{state.error ? <div style={{ marginTop: 16, padding: 12, borderRadius: 10, background: "#fff1f2", color: "#991b1b" }}>{state.error}</div> : null}<label style={{ display: "grid", gap: 6, marginTop: 20, textAlign: "left" }}><span style={{ fontWeight: 700 }}>Ghi chú</span><textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nhập ghi chú nếu cần..." rows={3} style={{ width: "100%", resize: "vertical", padding: "12px 14px", borderRadius: 10, border: "1px solid #ccc", font: "inherit", boxSizing: "border-box" }} /></label><div className="row" style={{ gap: 12, marginTop: 16 }}><button disabled={state.saving || !canCheckIn} onClick={() => submit("Check in")} style={{ flex: 1, padding: "16px 18px", borderRadius: 10, border: 0, fontWeight: 800, opacity: !canCheckIn ? .45 : 1 }}>CHECK IN</button><button disabled={state.saving || !canCheckOut} onClick={() => submit("Check out")} style={{ flex: 1, padding: "16px 18px", borderRadius: 10, border: 0, fontWeight: 800, opacity: !canCheckOut ? .45 : 1 }}>CHECK OUT</button></div><button type="button" onClick={goSchedule} disabled={state.saving} style={{ width: "100%", marginTop: 12, padding: "12px 18px", borderRadius: 10, border: "1px solid #ccc", background: "transparent", fontWeight: 700 }}>Bỏ qua · Xem lịch</button><p className="muted" style={{ marginTop: 18, marginBottom: 0 }}>IP kết nối được lưu cùng bản ghi chấm công để đối chiếu sau.</p></>}</section></div></main>;
}
