"use client";

import { useMemo, useState } from "react";
import type { StaffProfile, StaffProfileField } from "@/lib/repositories/staff-profile";

const labels: Record<StaffProfileField, string> = {
  email: "Email",
  dateOfBirth: "Ngày sinh",
  gender: "Giới tính",
  cccd: "CCCD",
  idIssueDate: "Ngày cấp CCCD",
  idIssuePlace: "Nơi cấp CCCD",
  address: "Địa chỉ",
  employmentType: "Loại nhân sự",
  department: "Bộ phận",
  startDate: "Ngày bắt đầu",
  role: "Chức danh / Vai trò",
};

const selectOptions: Record<string, string[]> = {
  gender: ["Male", "Female"],
  employmentType: ["Full-time", "Part-time", "Contract", "Intern", "Other"],
  department: ["Academy", "Operations", "Marketing", "Sales", "Management", "Other"],
};

const fieldOrder: StaffProfileField[] = ["email", "dateOfBirth", "gender", "cccd", "idIssueDate", "idIssuePlace", "address", "employmentType", "department", "startDate", "role"];

export default function StaffProfileGate({ username, staffName, profile, missing }: { username: string; staffName: string; profile: StaffProfile; missing: StaffProfileField[] }) {
  const [values, setValues] = useState<StaffProfile>(profile);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const missingSet = useMemo(() => new Set(missing), [missing]);

  async function save() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/staff/profile?t=${encodeURIComponent(username)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "Không thể lưu thông tin");
      if (Array.isArray(result.missing) && result.missing.length) {
        setError("Vui lòng hoàn tất các trường còn thiếu.");
        return;
      }
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể lưu thông tin");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(15, 15, 15, .72)", display: "grid", placeItems: "center", padding: 20 }}>
      <section className="card" style={{ width: "min(720px, 100%)", maxHeight: "90vh", overflowY: "auto", background: "white", padding: 28, boxShadow: "0 24px 80px rgba(0,0,0,.25)" }}>
        <div className="eyebrow">PINO TEAM OS</div>
        <h1 style={{ marginTop: 8 }}>Hoàn tất thông tin nhân sự</h1>
        <p className="subtitle">Chào {staffName}. Vui lòng bổ sung thông tin còn thiếu để tiếp tục xem lịch làm việc. Thông tin đã có được điền sẵn.</p>

        <div className="grid" style={{ gap: 14, marginTop: 22 }}>
          {fieldOrder.map((field) => {
            const value = values[field] ?? "";
            const required = missingSet.has(field);
            const options = selectOptions[field];
            return (
              <label key={field} style={{ display: "grid", gap: 6 }}>
                <span style={{ fontWeight: 700 }}>{labels[field]} {required ? <span aria-hidden="true">*</span> : null}</span>
                {options ? (
                  <select value={value} onChange={(e) => setValues({ ...values, [field]: e.target.value })} style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid #ccc", background: "white" }}>
                    <option value="">Chọn {labels[field].toLowerCase()}</option>
                    {options.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                ) : (
                  <input type={field === "dateOfBirth" || field === "startDate" ? "date" : field === "email" ? "email" : "text"} value={value} onChange={(e) => setValues({ ...values, [field]: e.target.value })} style={{ padding: "12px 14px", borderRadius: 10, border: required ? "1px solid #b45309" : "1px solid #ccc" }} />
                )}
              </label>
            );
          })}
        </div>

        {error ? <div style={{ marginTop: 16, padding: 12, borderRadius: 10, background: "#fff1f2", color: "#991b1b" }}>{error}</div> : null}
        <button type="button" onClick={save} disabled={saving} style={{ width: "100%", marginTop: 22, padding: "14px 18px", borderRadius: 10, border: 0, fontWeight: 800, cursor: saving ? "wait" : "pointer" }}>
          {saving ? "Đang lưu..." : "Lưu thông tin & xem lịch"}
        </button>
        <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>Các trường bắt buộc phải được hoàn tất và lưu thành công vào Notion trước khi lịch được hiển thị.</p>
      </section>
    </div>
  );
}
