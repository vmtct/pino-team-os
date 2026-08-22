"use client";

import { useMemo, useState } from "react";
import savedConfig from "../../../pinoria-tv/ambient-dialogues.saved.json";

type Exchange = { first: string; reply: string };
type DialogueConfig = {
  version: number;
  maxConcurrentBubbles: number;
  conversationDurationMs: number;
  exchanges: Exchange[];
};

export function AmbientDialogueConfigEditor() {
  const initial = useMemo(() => savedConfig as DialogueConfig, []);
  const [draft, setDraft] = useState<DialogueConfig>(() => JSON.parse(JSON.stringify(initial)) as DialogueConfig);
  const [status, setStatus] = useState("5 mẫu mặc định đã nạp từ code.");
  const [saving, setSaving] = useState(false);

  function updateExchange(index: number, key: keyof Exchange, value: string) {
    setDraft((current) => ({
      ...current,
      exchanges: current.exchanges.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item),
    }));
  }

  async function save() {
    setSaving(true);
    setStatus("Đang lưu xuống code…");
    try {
      const response = await fetch("/api/pinoria-prototype/ambient-dialogues-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const result = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !result?.ok) throw new Error(result?.error ?? `HTTP_${response.status}`);
      setStatus("Đã lưu app/pinoria-tv/ambient-dialogues.saved.json");
    } catch (error) {
      setStatus(error instanceof Error ? `Không lưu được: ${error.message}` : "Không lưu được.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section style={{ display: "grid", gap: 12, padding: 14, border: "1px solid #dfe5df", borderRadius: 16, background: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <strong style={{ display: "block", fontSize: 15 }}>Social Dialogue</strong>
          <p style={{ margin: "5px 0 0", color: "#687169", fontSize: 12, lineHeight: 1.45 }}>
            Pool lời thoại random khi hai mini-char overlap 50px. Hai Piner đối đáp bằng bubble riêng theo lượt; mỗi zone tối đa 1 bubble và toàn TV tối đa 3 bubble.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ fontSize: 11, color: "#687169" }}>
            Bubble tối đa{" "}
            <input
              type="number"
              min={1}
              max={3}
              value={draft.maxConcurrentBubbles}
              onChange={(event) => setDraft((current) => ({ ...current, maxConcurrentBubbles: Math.max(1, Math.min(3, Number(event.target.value) || 1)) }))}
              style={{ width: 48, marginLeft: 5, padding: "5px 6px", border: "1px solid #d8dfd8", borderRadius: 7 }}
            />
          </label>
          <label style={{ fontSize: 11, color: "#687169" }}>
            Thời lượng ms{" "}
            <input
              type="number"
              min={1500}
              max={12000}
              step={100}
              value={draft.conversationDurationMs}
              onChange={(event) => setDraft((current) => ({ ...current, conversationDurationMs: Number(event.target.value) || 4200 }))}
              style={{ width: 78, marginLeft: 5, padding: "5px 6px", border: "1px solid #d8dfd8", borderRadius: 7 }}
            />
          </label>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            style={{ border: 0, borderRadius: 9, background: "#17251b", color: "#fff", fontWeight: 800, fontSize: 11, padding: "8px 11px", cursor: saving ? "wait" : "pointer", opacity: saving ? .65 : 1 }}
          >
            {saving ? "SAVING…" : "SAVE TO CODE"}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {draft.exchanges.map((exchange, index) => (
          <div key={index} style={{ display: "grid", gridTemplateColumns: "34px 1fr 1fr", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 10, fontWeight: 900, color: "#8a938b" }}>#{index + 1}</span>
            <input
              value={exchange.first}
              onChange={(event) => updateExchange(index, "first", event.target.value)}
              aria-label={`Lời mở ${index + 1}`}
              style={{ minWidth: 0, padding: "9px 10px", borderRadius: 9, border: "1px solid #dfe5df", fontSize: 12 }}
            />
            <input
              value={exchange.reply}
              onChange={(event) => updateExchange(index, "reply", event.target.value)}
              aria-label={`Lời đáp ${index + 1}`}
              style={{ minWidth: 0, padding: "9px 10px", borderRadius: 9, border: "1px solid #dfe5df", fontSize: 12 }}
            />
          </div>
        ))}
      </div>

      <small style={{ color: "#7a837b", fontSize: 10 }}>{status}</small>
    </section>
  );
}
