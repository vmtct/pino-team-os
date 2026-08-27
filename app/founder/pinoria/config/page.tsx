import Link from "next/link";
import { AmbientDialogueConfigEditor } from "./ambient-dialogue-config-editor";
import { WelcomeVisualConfigEditor } from "./welcome-visual-config-editor";

const configCards = [
  {
    title: "Motion Graph",
    body: "Horizontal lanes, diagonal connectors, MID front/behind depth and Y-based character ordering.",
    source: "app/pinoria-tv/ambient-house-motion-graph.saved.json",
  },
  {
    title: "Emergence Pin",
    body: "Điểm mini-char xuất hiện sau Chọn nhanh. Pin luôn snap trực tiếp lên một horizontal lane và được dùng làm runtime entry.",
    source: "app/pinoria-tv/ambient-house-emergence.saved.json",
  },
  {
    title: "Area Boundaries",
    body: "Reception, Artchitect, Little Piner and Piano House learner-area polygons for later runtime assignment/constrained wandering.",
    source: "app/pinoria-tv/ambient-house-areas.saved.json",
  },
  {
    title: "Social Dialogue",
    body: "Random Piner-to-Piner exchanges. Conversation bắt đầu khi hai mini canvas overlap 90px, mỗi zone tối đa 1 bubble và toàn TV tối đa 3 bubble.",
    source: "app/pinoria-tv/ambient-dialogues.saved.json",
  },
] as const;

export default function PinoriaAmbientConfigPage() {
  return (
    <section style={{ display: "grid", gap: 18, paddingBottom: 28 }}>
      <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".12em", opacity: .58 }}>PINORIA · BACK OFFICE</div>
          <h1 style={{ margin: "5px 0 4px", fontSize: 28 }}>Pinoria Config</h1>
          <p style={{ margin: 0, maxWidth: 760, color: "#667067", lineHeight: 1.55 }}>
            Cấu hình presentation cho Welcome và Ambient House, gồm A/B visual, motion graph, emergence pin, area boundary và social dialogue.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link
            href="/pinoria-tv"
            target="_blank"
            style={{ padding: "10px 14px", borderRadius: 10, background: "#f1e9df", color: "#4a3c34", textDecoration: "none", fontWeight: 800, fontSize: 12 }}
          >
            Mở TV Prototype ↗
          </Link>
          <Link
            href="/founder/pinoria/shop"
            target="_blank"
            style={{ padding: "10px 14px", borderRadius: 10, background: "#705093", color: "#fff", textDecoration: "none", fontWeight: 800, fontSize: 12 }}
          >
            Mở Shop Remote ↗
          </Link>
          <Link
            href="/pinoria-tv/social-debug"
            target="_blank"
            style={{ padding: "10px 14px", borderRadius: 10, background: "#e6ede7", color: "#17251b", textDecoration: "none", fontWeight: 800, fontSize: 12 }}
          >
            Mở Social Sim ↗
          </Link>
          <Link
            href="/pinoria-tv/ambient-debug"
            target="_blank"
            style={{ padding: "10px 14px", borderRadius: 10, background: "#17251b", color: "#fff", textDecoration: "none", fontWeight: 800, fontSize: 12 }}
          >
            Mở Mesh Editor ↗
          </Link>
        </div>
      </header>

      <WelcomeVisualConfigEditor />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        {configCards.map((card) => (
          <article key={card.title} style={{ border: "1px solid #dfe5df", borderRadius: 14, padding: 14, background: "#fff" }}>
            <strong style={{ display: "block", fontSize: 14 }}>{card.title}</strong>
            <p style={{ margin: "6px 0 10px", color: "#687169", fontSize: 12, lineHeight: 1.5 }}>{card.body}</p>
            <code style={{ display: "block", overflowWrap: "anywhere", fontSize: 10, color: "#59635b", background: "#f5f7f5", borderRadius: 8, padding: 8 }}>{card.source}</code>
          </article>
        ))}
      </div>

      <AmbientDialogueConfigEditor />

      <div style={{ border: "1px solid #dfe5df", borderRadius: 16, overflow: "hidden", background: "#101711" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 12px", background: "#f5f7f5", borderBottom: "1px solid #dfe5df", fontSize: 11 }}>
          <strong>Social Simulation</strong>
          <span style={{ color: "#687169" }}>90px overlap → đối đáp từng bubble · zone cap 1 · TV cap 3 · convo pair = blocker</span>
        </div>
        <iframe
          src="/pinoria-tv/social-debug"
          title="Pinoria Ambient Social Simulation"
          style={{ display: "block", width: "100%", aspectRatio: "16 / 9", minHeight: 640, border: 0, background: "#101711" }}
        />
      </div>

      <div style={{ border: "1px solid #dfe5df", borderRadius: 16, overflow: "hidden", background: "#101711" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 12px", background: "#f5f7f5", borderBottom: "1px solid #dfe5df", fontSize: 11 }}>
          <strong>Mesh Configurator</strong>
          <span style={{ color: "#687169" }}>Motion Graph · Emergence Pin · Area Boundaries · Save to Code</span>
        </div>
        <iframe
          src="/pinoria-tv/ambient-debug"
          title="Pinoria Ambient House Configurator"
          style={{ display: "block", width: "100%", aspectRatio: "16 / 9", minHeight: 640, border: 0, background: "#101711" }}
        />
      </div>

      <p style={{ margin: 0, fontSize: 11, color: "#7a837b" }}>
        Lưu ý: SAVE TO CODE chỉ ghi file source khi chạy local development. Welcome A/B là presentation preference lưu trong browser để test nhanh, không ghi vào Core.
      </p>
    </section>
  );
}
