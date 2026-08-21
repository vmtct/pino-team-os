"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import savedEmergence from "./ambient-house-emergence.saved.json";
import savedGraph from "./ambient-house-motion-graph.saved.json";
import { normalizeAmbientHorizontalLane, type AmbientMotionGraphRaw } from "./ambient-house-motion-graph";

type EmergenceSnapshot = {
  canvas: { width: 1920; height: 1080 };
  pin: { laneId: string; x: number; y: number };
};

const GRAPH = savedGraph as AmbientMotionGraphRaw;
const DEFAULT_SNAPSHOT = savedEmergence as EmergenceSnapshot;
const ASSET_VERSION = "ambient-emergence-editor-v1";
const BACK = `/api/pinoria-prototype/ambient-house-asset?layer=back&v=${ASSET_VERSION}`;
const MID = `/api/pinoria-prototype/ambient-house-asset?layer=mid&v=${ASSET_VERSION}`;
const FRONT = `/api/pinoria-prototype/ambient-house-asset?layer=front&v=${ASSET_VERSION}`;

export function AmbientEmergencePinEditor() {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<EmergenceSnapshot>(DEFAULT_SNAPSHOT);
  const [scale, setScale] = useState(1);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("Pin đang đọc từ code.");

  const lanes = useMemo(() => GRAPH.horizontalLanes.map(normalizeAmbientHorizontalLane), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
      if (event.key.toLowerCase() === "e" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        setOpen((value) => !value);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    const update = () => {
      const rect = viewport.getBoundingClientRect();
      const next = Math.min(rect.width / 1920, rect.height / 1080);
      setScale(Number.isFinite(next) && next > 0 ? next : 1);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [open]);

  function placePin(event: React.MouseEvent<HTMLDivElement>) {
    const stage = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - stage.left) / scale;
    const y = (event.clientY - stage.top) / scale;

    let best: { laneId: string; x: number; y: number; distance: number } | null = null;
    for (const lane of lanes) {
      const laneX = Math.max(lane.x1, Math.min(lane.x2, x));
      const distance = Math.hypot(x - laneX, y - lane.y);
      if (!best || distance < best.distance) best = { laneId: lane.id, x: laneX, y: lane.y, distance };
    }

    if (!best || best.distance > 48) {
      setStatus("Click gần một horizontal lane để ghim điểm emerge.");
      return;
    }

    const next: EmergenceSnapshot = {
      canvas: { width: 1920, height: 1080 },
      pin: {
        laneId: best.laneId,
        x: Math.round(best.x * 10) / 10,
        y: Math.round(best.y * 10) / 10,
      },
    };
    setSnapshot(next);
    setStatus(`Emerge pin · ${best.laneId} · (${next.pin.x}, ${next.pin.y})`);
  }

  async function save() {
    setSaving(true);
    try {
      const response = await fetch("/api/pinoria-prototype/ambient-emergence-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot),
      });
      const result = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !result?.ok) {
        setStatus(result?.error === "LOCAL_DEV_ONLY" ? "SAVE TO CODE chỉ chạy ở local development." : "Không thể lưu emergence pin.");
        return;
      }
      setStatus("Đã lưu emergence pin xuống code. Reload runtime để dùng pin mới.");
    } catch {
      setStatus("Không thể lưu emergence pin.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        style={{ position: "fixed", left: 14, bottom: 14, zIndex: 2_000_000_020, border: "1px solid #ffffff2a", borderRadius: 10, padding: "8px 11px", background: open ? "#ead487" : "#172019e8", color: open ? "#283123" : "#f5f1e8", fontSize: 10, fontWeight: 900, letterSpacing: ".08em", boxShadow: "0 8px 24px #0005" }}
      >
        EMERGE PIN · E
      </button>

      {open ? (
        <div ref={viewportRef} style={{ position: "fixed", inset: 0, zIndex: 2_000_000_010, background: "#0d140f", overflow: "hidden", display: "grid", placeItems: "center" }}>
          <div style={{ position: "fixed", left: 14, top: 14, zIndex: 2_000_000_030, width: 330, padding: 12, borderRadius: 14, background: "#111b14ef", border: "1px solid #ffffff22", color: "#f7f2e9", boxShadow: "0 16px 40px #0008", backdropFilter: "blur(12px)" }}>
            <strong style={{ display: "block", fontSize: 13 }}>Emergence Pin</strong>
            <p style={{ margin: "6px 0 10px", fontSize: 11, lineHeight: 1.45, color: "#c8d0c7" }}>Click gần một horizontal lane để ghim vị trí mini-char xuất hiện sau slide Chọn nhanh.</p>
            <div style={{ fontSize: 10, color: "#ead487", marginBottom: 10 }}>{status}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" disabled={saving} onClick={() => void save()} style={{ border: 0, borderRadius: 9, padding: "8px 10px", background: "#ead487", color: "#263022", fontSize: 10, fontWeight: 900 }}>{saving ? "ĐANG LƯU..." : "SAVE TO CODE"}</button>
              <button type="button" onClick={() => { setSnapshot(DEFAULT_SNAPSHOT); setStatus("Đã reset về pin đang có trong code."); }} style={{ border: "1px solid #ffffff24", borderRadius: 9, padding: "8px 10px", background: "transparent", color: "#e5e9e2", fontSize: 10, fontWeight: 800 }}>RESET</button>
              <button type="button" onClick={() => setOpen(false)} style={{ border: "1px solid #ffffff24", borderRadius: 9, padding: "8px 10px", background: "transparent", color: "#e5e9e2", fontSize: 10, fontWeight: 800 }}>ĐÓNG</button>
            </div>
          </div>

          <div style={{ position: "relative", width: 1920 * scale, height: 1080 * scale }}>
            <div onClick={placePin} style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, transform: `scale(${scale})`, transformOrigin: "0 0", cursor: "crosshair", overflow: "hidden", isolation: "isolate" }}>
              <img src={BACK} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: 1920, height: 1080, zIndex: 0, pointerEvents: "none" }} />
              <img src={MID} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: 1920, height: 1080, zIndex: 5, pointerEvents: "none", opacity: .7 }} />
              <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{ position: "absolute", inset: 0, zIndex: 10, overflow: "visible", pointerEvents: "none" }}>
                {lanes.map((lane) => <line key={lane.id} x1={lane.x1} x2={lane.x2} y1={lane.y} y2={lane.y} stroke={lane.id === snapshot.pin.laneId ? "#ffe79a" : "#d5f3d7"} strokeWidth={lane.id === snapshot.pin.laneId ? 5 : 2.5} opacity={lane.id === snapshot.pin.laneId ? .95 : .55} />)}
              </svg>
              <div style={{ position: "absolute", zIndex: 20, left: snapshot.pin.x - 11, top: snapshot.pin.y - 28, width: 22, height: 28, pointerEvents: "none" }}>
                <div style={{ width: 22, height: 22, borderRadius: "50% 50% 50% 0", background: "#f2d77d", border: "2px solid #fff8d9", transform: "rotate(-45deg)", boxShadow: "0 5px 18px #0009,0 0 24px #f2d77d99" }} />
              </div>
              <img src={FRONT} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: 1920, height: 1080, zIndex: 30, pointerEvents: "none", opacity: .45 }} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
