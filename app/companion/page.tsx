import { cookies } from "next/headers";
import { verifyCompanionSession, COOKIE, companionEnabled } from "@/lib/companion-auth";
import { listCompanions, listEcology, logsForMaster } from "@/lib/repositories/companion";
import CompanionLogin from "./CompanionLogin";
import CompanionLogForm from "./CompanionLogForm";
import LogoutButton from "./LogoutButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = { master?: string };

export default async function CompanionPage({ searchParams }: { searchParams: Promise<Params> }) {
  if (!(await companionEnabled())) return <main className="main"><div className="page"><div className="card"><div className="eyebrow">PINO HOUSE · COMPANION</div><h1>Hộ Linh đang tạm đóng</h1><p className="subtitle">Tính năng này hiện chưa được bật.</p></div></div></main>;
  const token = (await cookies()).get(COOKIE)?.value ?? "";
  if (!(await verifyCompanionSession(token))) return <CompanionLogin />;

  const params = await searchParams;
  const [companions, ecology] = await Promise.all([listCompanions(), listEcology()]);
  const selected = companions.find(item => item.id === params.master) ?? companions[0] ?? null;
  const logs = selected ? await logsForMaster(selected.id) : [];
  const selectedEcology = selected ? ecology.find(item => item.id === selected.ecologyId) : null;

  return <main className="main"><div className="page">
    <div className="row" style={{ alignItems: "flex-start" }}><div><div className="eyebrow">PINO HOUSE · COMPANION</div><h1>Hộ Linh</h1><p className="subtitle">Quan sát · ghi nhận · đồng hành</p></div><LogoutButton /></div>
    <div className="grid grid-3" style={{ marginTop: 20 }}>
      <div className="card"><div className="muted">BẠN NHỎ</div><div className="metric">{companions.length}</div></div>
      <div className="card"><div className="muted">HỘ LINH</div><div className="metric">{ecology.length}</div></div>
      <div className="card"><div className="muted">ĐANG QUAN SÁT</div><div className="metric" style={{ fontSize: 22 }}>{selected?.studentName ?? "—"}</div></div>
    </div>
    <div className="grid grid-3 section" style={{ alignItems: "start" }}>
      <section className="card"><div className="row"><div><div className="eyebrow">COMPANION MASTER</div><h2 style={{ marginTop: 7 }}>Danh sách bạn nhỏ</h2></div></div><div className="list">{companions.map(item => <a key={item.id} href={`/companion?master=${encodeURIComponent(item.id)}`} className="list-item" style={{ display: "block", borderRadius: 10, padding: 12, background: item.id === selected?.id ? "var(--accent-soft)" : "transparent" }}><div className="row"><strong>{item.studentName}</strong><span className="pill">{item.level || "—"}</span></div><div className="muted" style={{ marginTop: 5 }}>{item.nickname || "Chưa có nickname"} · {item.ecologyName}</div></a>)}</div></section>
      <section className="card" style={{ gridColumn: "span 2" }}>
        {selected ? <><div className="eyebrow">HỒ SƠ QUAN SÁT</div><div className="row" style={{ alignItems: "flex-end", marginTop: 6 }}><div><h2 style={{ fontSize: 26 }}>{selected.studentName}</h2><div className="muted">{selected.nickname || ""} {selected.level ? `· ${selected.level}` : ""}</div></div><span className="pill">{selected.excitement || "Chưa ghi nhận"}</span></div>
        <div className="grid grid-3" style={{ marginTop: 20 }}><div><div className="muted">HỘ LINH</div><strong>{selected.ecologyName}</strong></div><div><div className="muted">GHI CHÚ</div><strong>{selected.note || "—"}</strong></div><div><div className="muted">DẤU ẤN</div><strong>{logs.length}</strong></div></div>
        {selectedEcology ? <div className="card section" style={{ background: "#faf7f1" }}><div className="eyebrow">ECOLOGY</div><h2 style={{ marginTop: 7 }}>{selectedEcology.name}</h2><div className="muted" style={{ marginTop: 7 }}>{selectedEcology.archetype.join(" · ")} {selectedEcology.element.length ? `· ${selectedEcology.element.join(" · ")}` : ""}</div><div className="grid grid-3" style={{ marginTop: 16 }}><div><div className="muted">LV2</div><div>{selectedEcology.lv2 || "—"}</div></div><div><div className="muted">LV3</div><div>{selectedEcology.lv3 || "—"}</div></div><div><div className="muted">LV4</div><div>{selectedEcology.lv4 || "—"}</div></div></div>{selectedEcology.meaning ? <p style={{ marginBottom: 0, marginTop: 16 }}>{selectedEcology.meaning}</p> : null}</div> : null}
        <CompanionLogForm masterId={selected.id} />
        <div className="card section"><div className="eyebrow">TIMELINE</div><h2 style={{ marginTop: 7 }}>Những dấu ấn gần đây</h2>{logs.length ? <div className="list">{logs.slice(0, 12).map(log => <div className="list-item" key={log.id}><div className="row"><strong>{log.name}</strong><span className="muted">{log.date ? new Date(log.date).toLocaleDateString("vi-VN") : ""}</span></div>{log.marks.length ? <div style={{ marginTop: 7 }}>{log.marks.map(mark => <span className="pill" key={mark} style={{ marginRight: 6 }}>{mark}</span>)}</div> : null}{log.fruit ? <div className="muted" style={{ marginTop: 7 }}>Trái Pinoria: {log.fruit}</div> : null}</div>)}</div> : <p className="muted" style={{ marginBottom: 0, marginTop: 16 }}>Chưa có ghi nhận nào.</p>}</div>
        </> : <p className="muted">Chưa có Companion Master.</p>}
      </section>
    </div>
  </div></main>;
}
