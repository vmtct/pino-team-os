import { listShifts } from "@/lib/repositories/shifts";

export default async function SchedulePage() {
  const shifts = (await listShifts()).filter((s) => s.active);
  return <div className="page"><div className="eyebrow">SCHEDULE</div><h1>Shift Master</h1><p className="subtitle">Giờ ca không hard-code trong app. App đọc từ Notion Shift Master.</p><div className="grid grid-3">{shifts.map((shift) => <div className="card" key={shift.id}><div className="row"><h2>{shift.code}</h2><span className="pill">{shift.period || "—"}</span></div><div style={{fontSize:24,fontWeight:750,marginTop:14}}>{shift.startTime ? new Date(shift.startTime).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"}) : "—"} — {shift.endTime ? new Date(shift.endTime).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"}) : "—"}</div></div>)}</div></div>;
}
