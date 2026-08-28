import Link from "next/link";
import fontStyles from "../../../pinoria-vietnamese-font.module.css";
import { PinoriaVietnameseLocale } from "../../../pinoria-vietnamese-locale";
import { resolveCompanionVisual } from "../../companion-visual-registry";
import { PrototypeCompanion } from "../../prototype-assets";

const cases = [
  { visualId: "ploo-form-1", title: "Ploo · Hiện hình I", note: "Form I · compact placeholder treatment" },
  { visualId: "ploo-form-2", title: "Ploo · Hiện hình II", note: "Form II · current default treatment" },
  { visualId: "ploo-default", title: "Legacy alias", note: "Backward compatible → Form II" },
  { visualId: "unknown-preview", title: "Unknown visualId", note: "Safety fallback → Form II" },
] as const;

export default function CompanionVisualReviewPage() {
  return (
    <PinoriaVietnameseLocale>
      <main className={fontStyles.vnFont} lang="vi" style={{ minHeight: "100vh", padding: "28px clamp(20px,4vw,56px) 40px", color: "#f7f1e7", background: "radial-gradient(circle at 50% 5%,#304033 0,#182019 38%,#0c100d 82%)" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <header style={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: 20, marginBottom: 22 }}>
            <div>
              <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: ".17em", color: "#b8c9b5" }}>PINORIA · COMPANION VISUAL REGISTRY</span>
              <h1 style={{ margin: "8px 0 7px", fontSize: "clamp(38px,5vw,64px)", lineHeight: .95, letterSpacing: "-.045em" }}>Hộ Linh Visual Review</h1>
              <p style={{ margin: 0, maxWidth: 720, color: "rgba(241,236,226,.58)", lineHeight: 1.55 }}>TV resolve visual hoàn toàn từ <code>visualId</code>. Hiện Form I và II dùng cùng approved base art; registry giữ khác biệt treatment và fallback contract.</p>
            </div>            <Link href="/pinoria-tv/review" style={{ flex: "0 0 auto", padding: "10px 13px", borderRadius: 13, color: "#152018", background: "#e8f0df", textDecoration: "none", fontSize: 12, fontWeight: 900 }}>← Review Hub</Link>
          </header>

          <section style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 16 }}>
            {cases.map((item) => {
              const resolved = resolveCompanionVisual(item.visualId);
              return (
                <article key={item.visualId} data-companion-review-case={item.visualId} style={{ minHeight: 390, padding: 18, borderRadius: 24, border: "1px solid rgba(235,242,230,.10)", background: "linear-gradient(145deg,rgba(255,255,255,.06),rgba(255,255,255,.018))", display: "grid", gridTemplateColumns: "minmax(240px,.9fr) minmax(0,1.1fr)", gap: 16, alignItems: "center", boxShadow: "0 20px 54px rgba(0,0,0,.20)" }}>
                  <div style={{ minHeight: 330, borderRadius: 22, display: "grid", placeItems: "center", background: "radial-gradient(circle at 50% 52%,rgba(231,214,152,.17),rgba(87,111,79,.12) 42%,rgba(10,15,11,.22) 74%)", border: "1px solid rgba(255,255,255,.06)" }}>
                    <PrototypeCompanion displayName={item.title} visualId={item.visualId} size="min(300px,24vw)" style={{ filter: "drop-shadow(0 24px 28px rgba(0,0,0,.28))" }} />
                  </div>
                  <div>
                    <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: ".15em", color: resolved.usedFallback ? "#e4c67c" : "#a9c9a7" }}>{resolved.usedFallback ? "FALLBACK" : "RESOLVED"}</span>
                    <h2 style={{ margin: "8px 0 7px", fontSize: 26, letterSpacing: "-.025em" }}>{item.title}</h2>
                    <p style={{ margin: "0 0 16px", color: "rgba(241,236,226,.56)", fontSize: 13, lineHeight: 1.5 }}>{item.note}</p>
                    <dl style={{ margin: 0, display: "grid", gap: 9, fontSize: 12 }}>
                      <Meta label="requested" value={resolved.requestedVisualId} />
                      <Meta label="resolved" value={resolved.resolvedVisualId} />
                      <Meta label="scale" value={String(resolved.definition.scale)} />
                      <Meta label="translateY" value={`${resolved.definition.translateYPercent}%`} />
                    </dl>
                  </div>
                </article>
              );
            })}
          </section>          <aside style={{ marginTop: 16, padding: "12px 15px", borderRadius: 16, border: "1px solid rgba(235,242,230,.08)", background: "rgba(5,9,6,.24)", color: "rgba(241,236,226,.52)", fontSize: 12, lineHeight: 1.55 }}>
            Asset swap rule: giữ nguyên <code>visualId</code>, chỉ thay <code>src</code>/presentation trong registry. Arrival, Ambient, Choice, Reward và Departure không cần sửa call-site.
          </aside>
        </div>
      </main>
    </PinoriaVietnameseLocale>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "92px minmax(0,1fr)", gap: 10, alignItems: "baseline" }}>
      <dt style={{ color: "rgba(215,228,211,.45)", fontWeight: 900, letterSpacing: ".08em" }}>{label}</dt>
      <dd style={{ margin: 0, color: "#f2ede4", fontFamily: "ui-monospace,SFMono-Regular,Consolas,monospace", overflowWrap: "anywhere" }}>{value}</dd>
    </div>
  );
}