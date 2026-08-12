"use client";

import { useMemo, useState } from "react";
import type { Shift } from "@/lib/domain/shift";

type Registration = {
  id: string;
  weekId: string;
  weekName: string;
  weekStart: string;
  weekEnd: string;
  status: string;
  editable: boolean;
  availableShifts: Shift[];
  shifts: Record<string, Shift[]>;
};

const DAYS = [
  ["Monday", "Thứ 2"], ["Tuesday", "Thứ 3"], ["Wednesday", "Thứ 4"], ["Thursday", "Thứ 5"], ["Friday", "Thứ 6"], ["Saturday", "Thứ 7"], ["Sunday", "Chủ nhật"],
] as const;

function initialSelection(registration: Registration): Record<string, string[]> {
  return Object.fromEntries(DAYS.map(([day]) => [day, (registration.shifts[day] ?? []).map((shift) => shift.id)]));
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(new Date(`${value}T12:00:00Z`));
}

export default function ShiftRegistration({ username, initial }: { username: string; initial: Registration }) {
  const [registration, setRegistration] = useState(initial);
  const [selected, setSelected] = useState(initialSelection(initial));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const grouped = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const shift of registration.availableShifts) {
      const list = map.get(shift.period) ?? [];
      list.push(shift);
      map.set(shift.period, list);
    }
    return [...map.entries()];
  }, [registration.availableShifts]);

  function toggle(day: string, shiftId: string) {
    if (!registration.editable) return;
    setSelected((current) => {
      const values = current[day] ?? [];
      return { ...current, [day]: values.includes(shiftId) ? values.filter((id) => id !== shiftId) : [...values, shiftId] };
    });
  }

  async function submit(action: "save" | "submit") {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/schedule/registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, weekId: registration.weekId, action, selected }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "SAVE_FAILED");
      setRegistration(body.registration);
      setSelected(initialSelection(body.registration));
      setMessage(action === "submit" ? "Đã gửi đăng ký ca. Bạn vẫn có thể chỉnh sửa đến hết Chủ nhật." : "Đã lưu thay đổi.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể lưu đăng ký.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card section" style={{ marginBottom: 24 }}>
      <div className="row" style={{ alignItems: "flex-start", gap: 16 }}>
        <div>
          <div className="eyebrow">SHIFT REGISTRATION</div>
          <h2 style={{ marginBottom: 6 }}>Đăng ký ca · {registration.weekName}</h2>
          <p className="muted" style={{ marginBottom: 0 }}>Tuần {dateLabel(registration.weekStart)} — {dateLabel(registration.weekEnd)} · Chỉ đăng ký cho tuần kế tiếp.</p>
        </div>
        <span className="pill">{registration.status || "Draft"}</span>
      </div>

      <div className="section" style={{ marginTop: 18 }}>
        {DAYS.map(([day, label]) => (
          <div key={day} className="card" style={{ marginBottom: 10 }}>
            <div className="row" style={{ marginBottom: 10 }}><strong>{label}</strong><span className="muted">{registration.shifts[day]?.length ?? 0} ca</span></div>
            <div style={{ display: "grid", gap: 8 }}>
              {grouped.map(([period, shifts]) => (
                <div key={period}>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 5 }}>{period}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {shifts.map((shift) => {
                      const checked = (selected[day] ?? []).includes(shift.id);
                      return <button key={shift.id} type="button" disabled={!registration.editable || saving} onClick={() => toggle(day, shift.id)} className={checked ? "pill" : "button"} aria-pressed={checked}>{shift.code} · {shift.startTime}–{shift.endTime}</button>;
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {registration.editable ? (
        <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button className="button" type="button" disabled={saving} onClick={() => submit("save")}>{saving ? "Đang lưu…" : "Lưu thay đổi"}</button>
          <button className="button" type="button" disabled={saving} onClick={() => submit("submit")}>{saving ? "Đang gửi…" : "Submit đăng ký"}</button>
        </div>
      ) : <p className="muted" style={{ marginTop: 16, marginBottom: 0 }}>Đăng ký đã chuyển sang read-only.</p>}
      {message ? <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>{message}</p> : null}
    </section>
  );
}
