"use client";

import { useMemo, useRef, useState } from "react";
import type { StaffProfile, StaffProfileField } from "@/lib/repositories/staff-profile";

const labels: Record<StaffProfileField, string> = {
  email: "Email",
  dateOfBirth: "Ngày sinh",
  gender: "Giới tính",
  cccd: "CCCD",
  idIssueDate: "Ngày cấp CCCD",
  idIssuePlace: "Nơi cấp CCCD",
  address: "Địa chỉ",
  idDocuments: "Ảnh CCCD 2 mặt",
  employmentType: "Loại nhân sự",
  department: "Bộ phận",
  startDate: "Ngày bắt đầu",
  role: "Chức danh / Vai trò",
};

const selectOptions: Record<string, string[]> = { gender: ["Male", "Female"] };
const fieldOrder: StaffProfileField[] = ["email", "dateOfBirth", "gender", "cccd", "idIssueDate", "idIssuePlace", "address"];

export default function StaffProfileGate({ username, staffName, profile, missing }: { username: string; staffName: string; profile: StaffProfile; missing: StaffProfileField[] }) {
  const [values, setValues] = useState<StaffProfile>(profile);
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);
  const missingSet = useMemo(() => new Set(missing), [missing]);
  const documentsRequired = !profile.idDocuments;

  function pickFile(file: File | null, side: "front" | "back") {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("CCCD chỉ nhận ảnh JPG, PNG hoặc WebP.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("Ảnh CCCD không được vượt quá 20MB mỗi file.");
      return;
    }
    setError("");
    side === "front" ? setFront(file) : setBack(file);
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const form = new FormData();
      Object.entries(values).forEach(([key, value]) => {
        if (typeof value === "string") form.append(key, value);
      });
      if (front) form.append("cccdFront", front, front.name);
      if (back) form.append("cccdBack", back, back.name);

      const response = await fetch(`/api/staff/profile?t=${encodeURIComponent(username)}`, { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "Không thể lưu thông tin");
      if (Array.isArray(result.missing) && result.missing.length) {
        setError("Vui lòng hoàn tất các trường còn thiếu, bao gồm ảnh CCCD 2 mặt.");
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
                  <input type={field === "dateOfBirth" ? "date" : field === "email" ? "email" : "text"} value={value} onChange={(e) => setValues({ ...values, [field]: e.target.value })} style={{ padding: "12px 14px", borderRadius: 10, border: required ? "1px solid #b45309" : "1px solid #ccc" }} />
                )}
              </label>
            );
          })}
        </div>

        <div style={{ marginTop: 18, padding: 16, border: "1px solid #e7e0d7", borderRadius: 14, background: "#faf7f2" }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Ảnh CCCD 2 mặt {documentsRequired ? <span aria-hidden="true">*</span> : null}</div>
          <div className="muted" style={{ marginBottom: 14 }}>Tải ảnh mặt trước và mặt sau. JPG, PNG hoặc WebP, tối đa 20MB mỗi ảnh.</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <input ref={frontRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => pickFile(e.target.files?.[0] ?? null, "front")} />
              <button type="button" onClick={() => frontRef.current?.click()} style={{ width: "100%", padding: 14, borderRadius: 10, border: "1px dashed #b8afa5", background: "white", cursor: "pointer" }}>Mặt trước</button>
              <div className="muted" style={{ marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{front?.name ?? (profile.idDocuments ? "Đã có tài liệu trên Notion" : "Chưa chọn ảnh")}</div>
            </div>
            <div>
              <input ref={backRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => pickFile(e.target.files?.[0] ?? null, "back")} />
              <button type="button" onClick={() => backRef.current?.click()} style={{ width: "100%", padding: 14, borderRadius: 10, border: "1px dashed #b8afa5", background: "white", cursor: "pointer" }}>Mặt sau</button>
              <div className="muted" style={{ marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{back?.name ?? (profile.idDocuments ? "Đã có tài liệu trên Notion" : "Chưa chọn ảnh")}</div>
            </div>
          </div>
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
