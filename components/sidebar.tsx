import Link from "next/link";

export function Sidebar({ username }: { username: string }) {
  const base = `/s/${encodeURIComponent(username)}`;
  const items = [["Home", base], ["Me", `${base}/me`], ["My Schedule", `${base}/schedule`]];

  return (
    <aside style={{ width: 220, borderRight: "1px solid var(--line)", background: "var(--surface)", padding: "28px 18px", flexShrink: 0 }}>
      <div style={{ fontWeight: 800, fontSize: 20, letterSpacing: "-.03em", marginBottom: 32 }}>PINO <span style={{ color: "var(--accent)" }}>TEAM</span></div>
      <nav style={{ display: "grid", gap: 6 }}>
        {items.map(([label, href]) => <Link key={href} href={href} style={{ padding: "10px 12px", borderRadius: 10 }}>{label}</Link>)}
      </nav>
      <div style={{ marginTop: 40, color: "var(--muted)", fontSize: 12, lineHeight: 1.6 }}>Team OS v0.2<br />Notion-powered</div>
    </aside>
  );
}
