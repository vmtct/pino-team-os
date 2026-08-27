"use client";

import { useEffect, useState } from "react";
import {
  AMBIENT_HOUSE_ARRIVAL_ASSETS,
  ARRIVAL_BACKGROUND_OPTIONS,
  DEFAULT_ARRIVAL_BACKGROUND,
  normalizeArrivalBackgroundVariant,
  PINORIA_ARRIVAL_BACKGROUND_EVENT,
  PINORIA_ARRIVAL_BACKGROUND_STORAGE_KEY,
  type ArrivalBackgroundVariant,
} from "../../../pinoria-tv/arrival-visual-config";

function OptionPreview({ variant }: { variant: ArrivalBackgroundVariant }) {
  if (variant === "ambient-house-blur") {
    return (
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#211a17" }}>
        {(Object.values(AMBIENT_HOUSE_ARRIVAL_ASSETS) as string[]).map((src) => (
          <img
            key={src}
            src={src}
            alt=""
            draggable={false}
            style={{
              position: "absolute",
              inset: "-7%",
              width: "114%",
              height: "114%",
              objectFit: "cover",
              filter: "blur(8px) brightness(.52) saturate(.72)",
            }}
          />
        ))}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(26,20,17,.48),rgba(22,16,14,.68))" }} />
      </div>
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "radial-gradient(circle at 62% 42%,rgba(126,103,89,.24),transparent 57%),linear-gradient(135deg,#443a35,#392f2b 48%,#292320)",
      }}
    />
  );
}

export function WelcomeVisualConfigEditor() {
  const [variant, setVariant] = useState<ArrivalBackgroundVariant>(DEFAULT_ARRIVAL_BACKGROUND);

  useEffect(() => {
    setVariant(normalizeArrivalBackgroundVariant(window.localStorage.getItem(PINORIA_ARRIVAL_BACKGROUND_STORAGE_KEY)));
  }, []);

  function choose(next: ArrivalBackgroundVariant) {
    setVariant(next);
    window.localStorage.setItem(PINORIA_ARRIVAL_BACKGROUND_STORAGE_KEY, next);
    window.dispatchEvent(new CustomEvent(PINORIA_ARRIVAL_BACKGROUND_EVENT, { detail: next }));
  }

  return (
    <section style={{ border: "1px solid #dfe5df", borderRadius: 16, padding: 16, background: "#fff", display: "grid", gap: 13 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: ".12em", color: "#7a837b" }}>WELCOME · VISUAL A/B</div>
          <h2 style={{ margin: "4px 0 4px", fontSize: 18 }}>Arrival Background</h2>
          <p style={{ margin: 0, maxWidth: 760, color: "#687169", fontSize: 12, lineHeight: 1.55 }}>
            Chọn background cho màn welcome full-char. Lựa chọn được lưu trong browser và TV prototype sẽ tự cập nhật khi đang mở ở tab khác.
          </p>
        </div>
        <div style={{ padding: "6px 9px", borderRadius: 999, background: "#f3f6f3", color: "#667067", fontSize: 10, fontWeight: 800 }}>
          ACTIVE · {ARRIVAL_BACKGROUND_OPTIONS.find((option) => option.id === variant)?.shortLabel}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12 }}>
        {ARRIVAL_BACKGROUND_OPTIONS.map((option) => {
          const active = option.id === variant;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => choose(option.id)}
              style={{
                appearance: "none",
                border: active ? "2px solid #57483f" : "1px solid #dfe5df",
                borderRadius: 14,
                overflow: "hidden",
                padding: 0,
                background: "#fff",
                textAlign: "left",
                cursor: "pointer",
                boxShadow: active ? "0 8px 24px rgba(61,48,40,.10)" : "none",
              }}
            >
              <div style={{ position: "relative", height: 116, overflow: "hidden", background: "#312824" }}>
                <OptionPreview variant={option.id} />
                <div style={{ position: "absolute", left: 14, bottom: 12, width: 54, height: 54, borderRadius: "50%", background: "radial-gradient(circle,#c998ff55,transparent 70%)", boxShadow: "0 0 28px #b36cff55" }} />
                <div style={{ position: "absolute", left: 33, bottom: 10, width: 18, height: 65, borderRadius: 12, background: "rgba(250,244,237,.78)", filter: "blur(.4px)" }} />
              </div>
              <div style={{ padding: 12 }}>
                <strong style={{ display: "block", fontSize: 13, color: "#263028" }}>{option.label}</strong>
                <span style={{ display: "block", marginTop: 5, color: "#707a71", fontSize: 11, lineHeight: 1.45 }}>{option.description}</span>
              </div>
            </button>
          );
        })}
      </div>

      <small style={{ color: "#858d86", lineHeight: 1.45 }}>
        A/B setting này chỉ là presentation config của prototype; không thay đổi Core truth hay dữ liệu học viên.
      </small>
    </section>
  );
}
