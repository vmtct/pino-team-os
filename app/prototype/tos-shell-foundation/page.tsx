"use client";

import { useMemo, useState } from "react";
import { BoShell, TosShell, type BoNavGroup, type TosAppTheme, type TosFooterItem } from "@/app/components/tos-shell";

const APP_LABELS: Record<TosAppTheme, string> = {
  home: "Home",
  shift: "Ca làm",
  classroom: "Lớp học",
  tasks: "Việc",
  pinoria: "Pinoria",
};

const APP_SUBTITLES: Record<TosAppTheme, string> = {
  home: "Neutral launcher shell · tos.pinohouse.art",
  shift: "Workforce execution context",
  classroom: "Pedagogy-only delivery context",
  tasks: "Operational attention context",
  pinoria: "Center-wide Pinoria operations context",
};

const BO_GROUPS: BoNavGroup[] = [
  { label: "Overview", items: [{ label: "Dashboard", href: "#dashboard" }, { label: "Attention", href: "#attention" }] },
  { label: "Operations", items: [{ label: "Sessions", href: "#sessions" }, { label: "Bookings", href: "#bookings" }, { label: "Registrations", href: "#registrations" }] },
  { label: "Learning", items: [{ label: "Running Classes", href: "#running-classes" }, { label: "Syllabus", href: "#syllabus" }, { label: "Achievement", href: "#achievement" }] },
  { label: "People", items: [{ label: "Students", href: "#students" }, { label: "Staff", href: "#staff" }] },
  { label: "Workforce", items: [{ label: "Scheduling", href: "#workforce" }, { label: "Timesheets", href: "#timesheets" }] },
  { label: "Pinoria", items: [{ label: "Live Ops", href: "#pinoria-live" }, { label: "Studio", href: "#pinoria-studio" }] },
  { label: "Content", items: [{ label: "Piner CMS", href: "#content" }] },
  { label: "System", items: [{ label: "Policies", href: "#policies" }, { label: "Access", href: "#access" }] },
];

function footerFor(theme: TosAppTheme): TosFooterItem[] {
  if (theme === "home") {
    return [
      { id: "home", label: "Home", href: "#home", icon: "⌂" },
      { id: "shift", label: "Ca làm", href: "#shift", icon: "◷" },
      { id: "classroom", label: "Lớp học", href: "#classroom", icon: "▣" },
      { id: "tasks", label: "Việc", href: "#tasks", icon: "✓" },
      { id: "pinoria", label: "Pinoria", href: "#pinoria", icon: "✦" },
    ];
  }
  if (theme === "shift") return ["Hôm nay", "Lịch", "Đăng ký", "Check-in/out", "Lịch sử"].map((label, i) => ({ id: String(i), label, href: `#shift-${i}` }));
  if (theme === "classroom") return ["Tổng quan", "Học viên", "Giáo án", "Journal", "Thành tựu"].map((label, i) => ({ id: String(i), label, href: `#classroom-${i}` }));
  if (theme === "tasks") return ["Tất cả", "Ca", "Học vụ", "Pinoria", "Yêu cầu"].map((label, i) => ({ id: String(i), label, href: `#tasks-${i}` }));
  return ["Live", "Check-in", "Cần xử lý", "Học viên", "Fulfillment"].map((label, i) => ({ id: String(i), label, href: `#pinoria-${i}` }));
}

const switchStyle = {
  position: "fixed" as const,
  top: 12,
  right: 12,
  zIndex: 1000,
  display: "flex",
  gap: 6,
  padding: 6,
  borderRadius: 14,
  background: "rgba(20,20,28,.88)",
  boxShadow: "0 8px 28px rgba(0,0,0,.16)",
};

const buttonStyle = (active: boolean) => ({
  border: 0,
  borderRadius: 10,
  padding: "8px 11px",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 12,
  background: active ? "#fff" : "transparent",
  color: active ? "#25242c" : "#fff",
});

export default function TosShellFoundationReview() {
  const [surface, setSurface] = useState<"tos" | "bo">("tos");
  const [theme, setTheme] = useState<TosAppTheme>("home");
  const footerItems = useMemo(() => footerFor(theme), [theme]);

  return (
    <>
      <div style={switchStyle} aria-label="Surface review controls">
        <button style={buttonStyle(surface === "tos")} onClick={() => setSurface("tos")}>TOS</button>
        <button style={buttonStyle(surface === "bo")} onClick={() => setSurface("bo")}>BO</button>
      </div>

      {surface === "tos" ? (
        <TosShell
          title={theme === "home" ? "TOS Shell Foundation" : APP_LABELS[theme]}
          subtitle={APP_SUBTITLES[theme]}
          theme={theme}
          home={theme === "home"}
          homeHref="#home"
          footerItems={footerItems}
          activeFooterId={theme === "home" ? "home" : "0"}
        >
          <section style={{ display: "grid", gap: 14 }}>
            <div style={{ border: "1px solid rgba(120,120,135,.18)", borderRadius: 18, padding: 16, background: "rgba(255,255,255,.82)" }}>
              <small style={{ fontWeight: 850, letterSpacing: ".08em" }}>LOCAL REVIEW · TOS SURFACE · SHELL ONLY</small>
              <h2 style={{ margin: "7px 0 6px", fontSize: 21 }}>{APP_LABELS[theme]}</h2>
              <p style={{ margin: 0, lineHeight: 1.5, fontSize: 13, opacity: .72 }}>
                Mobile-first Team Ops target: tos.pinohouse.art. Kiểm tra hierarchy, header, theme continuity và footer contract; không có business state trong review surface này.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 9 }}>
              {(Object.keys(APP_LABELS) as TosAppTheme[]).map((candidate) => (
                <button
                  key={candidate}
                  onClick={() => setTheme(candidate)}
                  style={{
                    border: "1px solid rgba(120,120,135,.2)",
                    borderRadius: 16,
                    padding: 14,
                    minHeight: 78,
                    textAlign: "left",
                    cursor: "pointer",
                    background: candidate === theme ? "rgba(255,255,255,.98)" : "rgba(255,255,255,.62)",
                    fontWeight: 820,
                  }}
                >
                  {APP_LABELS[candidate]}
                  <small style={{ display: "block", marginTop: 5, opacity: .58, fontWeight: 600 }}>preview theme</small>
                </button>
              ))}
            </div>
          </section>
        </TosShell>
      ) : (
        <BoShell groups={BO_GROUPS} activeHref="#dashboard" title="PINO Team" subtitle="BO · bo.pinohouse.art · Shell Review">
          <section style={{ maxWidth: 1180, margin: "0 auto" }}>
            <small style={{ fontWeight: 850, letterSpacing: ".08em", opacity: .6 }}>LOCAL REVIEW · BO SURFACE · SHELL ONLY</small>
            <h1 style={{ margin: "8px 0 6px", fontSize: 34 }}>Back Office Foundation</h1>
            <p style={{ margin: "0 0 24px", opacity: .65 }}>Desktop-first target: bo.pinohouse.art. Grouped persistent sidebar, high-density management and configuration workspace.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 14 }}>
              {["Operational queue", "Management workspace", "Configuration surface"].map((label) => (
                <article key={label} style={{ border: "1px solid #e3e3e9", borderRadius: 18, background: "#fff", padding: 18, minHeight: 150 }}>
                  <strong>{label}</strong>
                  <p style={{ fontSize: 13, lineHeight: 1.5, opacity: .62 }}>Placeholder only. Feature teams compose their own content inside the canonical BO shell.</p>
                </article>
              ))}
            </div>
          </section>
        </BoShell>
      )}
    </>
  );
}
