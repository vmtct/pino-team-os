import Link from "next/link";
import fontStyles from "../../pinoria-vietnamese-font.module.css";
import { PinoriaVietnameseLocale } from "../../pinoria-vietnamese-locale";

const routes = [
  {
    href: "/pinoria-tv",
    title: "Operational TV",
    meta: "Full loop · Ambient / Arrival / Choice / transient / Shop overlay",
    badge: "LIVE FLOW",
  },
  {
    href: "/pinoria-tv/review/inventory",
    title: "Túi Hành Trang",
    meta: "Inventory grid · equipped rails · companion · character preview",
    badge: "INTERACTIVE",
  },
  {
    href: "/pinoria-tv/review/energy-seed",
    title: "Hạt Năng Lượng",
    meta: "Reward reveal · committed result · ~10s ritual",
    badge: "REVEAL",
  },
  {
    href: "/pinoria-tv/review/learning-spotlight",
    title: "Learning Spotlight",
    meta: "Milestone reveal · previous / current / next · ~8.6s",
    badge: "LEARNING",
  },
  {
    href: "/pinoria-tv/review/world-broadcast",
    title: "World Broadcast",
    meta: "House-wide announcement · subjectless takeover · ~9.4s",
    badge: "WORLD",
  },
  {
    href: "/pinoria-tv/review/lost-artifact",
    title: "Thần Khí Thất Lạc",
    meta: "4 artifact dossiers · hero-derived palette · generic adaptive icon family",
    badge: "WORLD · LOST ARTIFACT",
  },
  {
    href: "/pinoria-tv/review/world-state-transition",
    title: "World State Transition",
    meta: "Persistent world mutation · old → new Ambient state · ~10.2s",
    badge: "WORLD STATE",
  },
] as const;

export default function PinoriaReviewHubPage() {
  return (
    <PinoriaVietnameseLocale>
      <main
        className={fontStyles.vnFont}
        lang="vi"
        style={{
          minHeight: "100vh",
          padding: "42px clamp(20px,4vw,64px) 64px",
          color: "#f7f1e7",
          background: "radial-gradient(circle at 18% 0%,#28372d 0,#161d19 34%,#0d110f 76%)",
        }}
      >
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <header style={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: 24, marginBottom: 28 }}>
            <div>
              <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: ".18em", color: "rgba(218,236,218,.55)" }}>
                PINORIA · FOUNDER REVIEW
              </span>
              <h1 style={{ margin: "8px 0 6px", fontSize: "clamp(34px,5vw,66px)", lineHeight: .95, letterSpacing: "-.045em" }}>
                Prototype Review Hub
              </h1>
              <p style={{ margin: 0, maxWidth: 720, color: "rgba(240,235,224,.58)", fontSize: 15, lineHeight: 1.55 }}>
                Dùng các route dưới để duyệt từng surface riêng. Operational TV vẫn là nơi duyệt orchestration thật trên cùng một URL.
              </p>
            </div>
            <Link
              href="/pinoria-tv"
              style={{
                flex: "0 0 auto",
                padding: "11px 14px",
                borderRadius: 14,
                color: "#152018",
                background: "#e8f0df",
                textDecoration: "none",
                fontSize: 12,
                fontWeight: 900,
              }}
            >
              Mở Operational TV
            </Link>
          </header>

          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
              gap: 14,
            }}
          >
            {routes.map((route, index) => (
              <Link
                key={route.href}
                href={route.href}
                style={{
                  minHeight: 180,
                  padding: 20,
                  borderRadius: 22,
                  border: "1px solid rgba(238,244,232,.10)",
                  background: index === 0
                    ? "linear-gradient(145deg,rgba(146,184,135,.18),rgba(38,52,43,.68))"
                    : "linear-gradient(145deg,rgba(255,255,255,.055),rgba(255,255,255,.018))",
                  boxShadow: "0 20px 46px rgba(0,0,0,.18), inset 0 1px rgba(255,255,255,.035)",
                  color: "inherit",
                  textDecoration: "none",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: ".15em", color: "rgba(188,220,189,.58)" }}>
                    {route.badge}
                  </span>
                  <h2 style={{ margin: "8px 0 8px", fontSize: 24, letterSpacing: "-.025em" }}>{route.title}</h2>
                  <p style={{ margin: 0, color: "rgba(240,235,224,.50)", fontSize: 13, lineHeight: 1.5 }}>{route.meta}</p>
                </div>
                <span style={{ marginTop: 20, fontSize: 12, fontWeight: 900, color: "rgba(232,242,225,.78)" }}>
                  Mở review →
                </span>
              </Link>
            ))}
          </section>

          <aside
            style={{
              marginTop: 18,
              padding: "16px 18px",
              borderRadius: 18,
              border: "1px solid rgba(238,244,232,.08)",
              background: "rgba(8,12,10,.28)",
              color: "rgba(240,235,224,.52)",
              fontSize: 12,
              lineHeight: 1.6,
            }}
          >
            Review order recommend: <strong style={{ color: "#f5f0e7" }}>Operational TV → Túi Hành Trang → Hạt Năng Lượng → Learning Spotlight → World Broadcast → Thần Khí Thất Lạc → World State Transition</strong>. Với Operational TV, mở Review controls để duyệt Arrival / Quick Choice / Companion Ritual / Departure trên cùng surface.
          </aside>
        </div>
      </main>
    </PinoriaVietnameseLocale>
  );
}
