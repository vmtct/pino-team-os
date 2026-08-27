import Link from "next/link";
import fontStyles from "../../../pinoria-vietnamese-font.module.css";
import { PinoriaVietnameseLocale } from "../../../pinoria-vietnamese-locale";
import { LOST_ARTIFACTS } from "../../lost-artifact-data";

export default function LostArtifactReviewIndexPage() {
  return (
    <PinoriaVietnameseLocale>
      <main
        className={fontStyles.vnFont}
        lang="vi"
        style={{
          minHeight: "100vh",
          padding: "28px clamp(18px,4vw,58px) 40px",
          color: "#f7f1e7",
          background: "radial-gradient(circle at 20% 0%,#332b36 0,#151317 38%,#0b0a0c 82%)",
        }}
      >
        <div style={{ maxWidth: 1220, margin: "0 auto" }}>
          <Link href="/pinoria-tv/review" style={{ color: "rgba(245,235,220,.56)", textDecoration: "none", fontSize: 12 }}>
            ← Prototype Review Hub
          </Link>
          <header style={{ margin: "16px 0 20px" }}>
            <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: ".18em", color: "rgba(231,193,211,.58)" }}>
              WORLD BROADCAST · LOST ARTIFACT
            </span>
            <h1 style={{ margin: "8px 0 7px", fontSize: "clamp(34px,4.2vw,58px)", lineHeight: .95, letterSpacing: "-.04em" }}>
              Thần Khí Thất Lạc
            </h1>
            <p style={{ margin: 0, maxWidth: 760, color: "rgba(240,235,224,.55)", lineHeight: 1.55 }}>
              Cùng một generic dossier template. Hero asset quyết định palette, glow và hue của toàn bộ generic icon family.
            </p>
          </header>

          <section style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 16 }}>
            {LOST_ARTIFACTS.map((artifact) => (
              <Link
                key={artifact.id}
                href={`/pinoria-tv/review/lost-artifact/${artifact.id}`}
                style={{
                  minHeight: 232,
                  display: "grid",
                  gridTemplateColumns: "minmax(142px,.72fr) 1.28fr",
                  gap: 18,
                  alignItems: "center",
                  padding: 16,
                  overflow: "hidden",
                  borderRadius: 24,
                  border: "1px solid rgba(255,255,255,.09)",
                  background: "linear-gradient(145deg,rgba(255,255,255,.055),rgba(255,255,255,.015))",
                  color: "inherit",
                  textDecoration: "none",
                  boxShadow: "0 22px 48px rgba(0,0,0,.22)",
                }}
              >
                <div style={{ height: 184, display: "grid", placeItems: "center" }}>
                  <img src={artifact.heroUrl} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", filter: "drop-shadow(0 18px 28px rgba(0,0,0,.45))" }} />
                </div>
                <div>
                  <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: ".15em", color: "rgba(235,199,216,.58)" }}>{artifact.code}</span>
                  <h2 style={{ margin: "8px 0 8px", fontSize: 25, lineHeight: 1.02 }}>{artifact.title}</h2>
                  <p style={{ margin: 0, color: "rgba(240,235,224,.5)", fontSize: 13, lineHeight: 1.5 }}>{artifact.clue}</p>
                  <strong style={{ display: "block", marginTop: 15, fontSize: 12, color: "rgba(247,235,219,.8)" }}>Mở broadcast →</strong>
                </div>
              </Link>
            ))}
          </section>
        </div>
      </main>
    </PinoriaVietnameseLocale>
  );
}
