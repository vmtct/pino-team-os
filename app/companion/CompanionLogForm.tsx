"use client";

import { useState } from "react";

const MARKS = ["Dấu ấn Gắn Bó (Bond)", "Dấu ấn đồng hành (Continuity)", "Dấu ấn Hệ Nước"];

export default function CompanionLogForm({ masterId }: { masterId: string }) {
  const [name, setName] = useState("");
  const [marks, setMarks] = useState<string[]>([]);
  const [fruit, setFruit] = useState("0");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const toggle = (mark: string) => setMarks(current => current.includes(mark) ? current.filter(x => x !== mark) : [...current, mark]);
  async function save() {
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/companion/log", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ masterId, name, marks, fruit: Number(fruit) }) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error === "unauthorized" ? "Phiên đăng nhập đã hết hạn." : "Không thể lưu ghi nhận.");
      setName(""); setMarks([]); setFruit("0"); setMessage("Đã ghi nhận.");
      setTimeout(() => window.location.reload(), 450);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Không thể lưu."); }
    finally { setSaving(false); }
  }
  return <section className="card section"><div className="eyebrow">COMPANION LOG</div><h2 style={{ marginTop: 7 }}>Ghi nhận một dấu ấn</h2><div style={{ display: "grid", gap: 12, marginTop: 16 }}><input value={name} onChange={e => setName(e.target.value)} placeholder="Tên ghi nhận / khoảnh khắc" style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid #d9d1c7" }} /><div style={{ display: "grid", gap: 8 }}>{MARKS.map(mark => <label key={mark} style={{ display: "flex", gap: 9, alignItems: "center" }}><input type="checkbox" checked={marks.includes(mark)} onChange={() => toggle(mark)} />{mark}</label>)}</div><label style={{ display: "grid", gap: 6 }}><span className="muted">Trái Pinoria</span><input type="number" min="0" value={fruit} onChange={e => setFruit(e.target.value)} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #d9d1c7" }} /></label><button className="button" disabled={saving || !name.trim()} onClick={save}>{saving ? "Đang lưu..." : "Ghi nhận"}</button>{message ? <div className="muted">{message}</div> : null}</div></section>;
}
