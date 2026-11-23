"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./lead-household.module.css";
import { InlineProperty, type InlineKey } from "./InlineProperty";

type Role = "Parent" | "Student" | "Guest";
type Member = { id: string; name: string; role: Role; age: string; program?: string; path?: string };
type Lead = { id: string; name: string; phone: string; program: string; path: string; members: Member[]; createdAt: string; updatedAt: string; source: string; status: "ACTIVE" | "ARCHIVED" };
type Draft = { name: string; phone: string; program: string; path: string; members: Member[] };
type Tab = "Tổng quan" | "Thành viên" | "Quan hệ khai báo" | "Lịch sử";
const tabs: Tab[] = ["Tổng quan", "Thành viên", "Quan hệ khai báo", "Lịch sử"];
const initial: Lead[] = [{
  id: "lead-001", name: "Nguyễn Thị Minh Anh", phone: "090 123 4567", program: "Afterschool", path: "Hội họa",
  members: [{ id: "m1", name: "Nguyễn Thị Minh Anh", role: "Parent", age: "", program: "Afterschool", path: "Hội họa" }, { id: "m2", name: "Nguyễn Gia Hân", role: "Student", age: "8", program: "Afterschool", path: "Hội họa" }],
  createdAt: "22/11/2026 · 09:30", updatedAt: "23/11/2026 · 08:45", source: "Website", status: "ACTIVE"
}];
const empty: Draft = { name: "", phone: "", program: "Afterschool", path: "Hội họa", members: [] };

const makeMember = (program = "Afterschool", path = "Hội họa"): Member => ({ id: crypto.randomUUID(), name: "", role: "Student", age: "", program, path });

export function LeadHouseholdShell({ preview = false, initialDrawer = false }: { preview?: boolean; initialDrawer?: boolean } = {}) {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>(initial);
  useEffect(() => { try { const stored = sessionStorage.getItem("pino-leads-m1"); if(stored) setLeads(JSON.parse(stored)); } catch {} }, []);
  const openDetail = (id: string) => { try { sessionStorage.setItem("pino-leads-m1", JSON.stringify(leads)); } catch {} router.push((preview ? "/bo/sales/leads/m1-preview/" : "/bo/sales/leads/") + encodeURIComponent(id)); };
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [selected, setSelected] = useState<string | null>(initialDrawer ? "lead-001" : null);
  const drawerRef = useRef<HTMLElement>(null);
  const [detail, setDetail] = useState(false);
  const [tab, setTab] = useState<Tab>("Tổng quan");
  const [mode, setMode] = useState<"create" | "edit" | null>(null);
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Draft>(empty);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const current = leads.find(l => l.id === selected);
  const filtered = useMemo(() => leads.filter(l =>
    (filter === "ALL" || l.status === filter) &&
    [l.name, l.phone, l.program, l.path, ...l.members.map(m => m.name)].join(" ").toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi"))
  ), [leads, query, filter]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setMode(null); setDetail(false); setSelected(null); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (!selected && !mode) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const drawer = drawerRef.current;
    drawer?.querySelector<HTMLElement>("button, input, select")?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !drawer) return;
      const controls = Array.from(drawer.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]"));
      if (!controls.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", trap);
    return () => { document.removeEventListener("keydown", trap); document.body.style.overflow = priorOverflow; previous?.focus(); };
  }, [selected, mode, step]);
  const saveQuickField=(key:InlineKey,value:string):string|null=>{
    if(!current)return "Không tìm thấy Lead.";
    if(key==="name"&&!value)return "Vui lòng nhập họ tên.";
    const normalized=key==="phone"?value.replace(/\D/g,""):value;
    if(key==="phone"&&!/^0\d{9}$/.test(normalized))return "Số điện thoại phải có 10 chữ số và bắt đầu bằng 0.";
    if(key==="phone"&&leads.some(l=>l.id!==current.id&&l.phone.replace(/\D/g,"")===normalized))return "Số điện thoại đã thuộc Lead khác.";
    const next=leads.map(l=>l.id===current.id?{...l,[key]:normalized,updatedAt:new Intl.DateTimeFormat("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date())}:l);
    try{sessionStorage.setItem("pino-leads-m1",JSON.stringify(next));}catch{return "Không lưu được bản nháp local.";}
    setLeads(next);setNotice("Đã cập nhật "+({name:"họ tên",phone:"số điện thoại",program:"chương trình",path:"chuyên môn"}[key])+".");return null;
  };
  const startCreate = () => { setSelected(null); setDraft(empty); setStep(1); setError(""); setMode("create"); setDetail(false); };
  const startEdit = () => { if (!current) return; setDraft({ name: current.name, phone: current.phone, program: current.program, path: current.path, members: current.members.map(m => ({ ...m })) }); setStep(1); setError(""); setMode("edit"); setDetail(false); };
  const save = () => {
    const normalized = draft.phone.replace(/\D/g, "");
    if (!/^0\d{9}$/.test(normalized)) { setStep(1); setError("Nhập số điện thoại Việt Nam hợp lệ gồm 10 chữ số."); return; }
    if (draft.members.some(m => !m.name.trim())) { setStep(2); setError("Vui lòng nhập tên cho từng thành viên."); return; }
    if (mode === "create" && leads.some(l => l.phone.replace(/\D/g, "") === normalized)) { setStep(1); setError("Số điện thoại đã tồn tại. Mở Lead hiện có để bổ sung thông tin."); return; }
    if (mode === "edit" && leads.some(l => l.id !== selected && l.phone.replace(/\D/g, "") === normalized)) { setStep(1); setError("Số điện thoại đã thuộc một Lead khác."); return; }
    const item: Lead = { ...draft, id: mode === "edit" && current ? current.id : crypto.randomUUID(), createdAt: mode === "edit" ? current?.createdAt ?? "—" : new Intl.DateTimeFormat("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date()), updatedAt: new Intl.DateTimeFormat("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date()), source: mode === "edit" ? current?.source ?? "Nhập trực tiếp" : "Nhập trực tiếp", status: mode === "edit" ? current?.status ?? "ACTIVE" : "ACTIVE" };
    setLeads(old => { const next = mode === "edit" ? old.map(l => l.id === item.id ? item : l) : [item, ...old]; try { sessionStorage.setItem("pino-leads-m1", JSON.stringify(next)); } catch {} return next; });
    setSelected(null); setMode(null); setDetail(false); setTab("Tổng quan"); setNotice(mode === "edit" ? "Đã cập nhật thông tin Lead." : "Đã thêm Lead.");
  };
  return <main className={styles.page}>
    <header className={styles.header}><div><h1>Leads</h1><p>Quản lý liên hệ quan tâm và thành viên dự kiến</p></div><button className={styles.primary} onClick={startCreate}>+ Tạo Lead</button></header>
    {notice && <div className={styles.notice} role="status">{notice}<button onClick={() => setNotice("")} aria-label="Đóng thông báo">×</button></div>}
    <section className={styles.panel}>
      <div className={styles.toolbar}><input aria-label="Tìm kiếm Lead" placeholder="Tìm tên, số điện thoại, thành viên..." value={query} onChange={e => setQuery(e.target.value)} /><select aria-label="Trạng thái Lead" value={filter} onChange={e => setFilter(e.target.value)}><option value="ALL">Tất cả trạng thái</option><option value="ACTIVE">Đang hoạt động</option><option value="ARCHIVED">Đã lưu trữ</option></select><span className={styles.resultCount}>{filtered.length} kết quả</span></div>

      <div className={styles.tableScroll}><table aria-label="Danh sách Leads"><thead><tr><th>Liên hệ</th><th>Số điện thoại</th><th>Thành viên</th><th>Chương trình</th><th>Chuyên môn</th><th>Nguồn</th><th>Trạng thái</th><th>Created Time</th><th>Created By</th><th>Last Modified Time</th><th>Last Modified By</th><th aria-label="Thao tác" /></tr></thead><tbody>
      {filtered.map(l => <tr key={l.id} onClick={() => { setSelected(l.id); setDetail(false); }} tabIndex={0} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(l.id); setDetail(false); } }}><td><strong>{l.name || "Chưa có tên liên hệ"}</strong></td><td>{l.phone}</td><td>{l.members.length} thành viên</td><td>{l.program}</td><td>{l.path}</td><td>{l.source}</td><td><span className={styles.badge}>{l.status === "ACTIVE" ? "Đang hoạt động" : "Đã lưu trữ"}</span></td><td>{l.createdAt}</td><td>—</td><td>{l.updatedAt}</td><td>—</td><td><button type="button" className={styles.textButton} onClick={e => { e.stopPropagation(); openDetail(l.id); }}>Xem chi tiết</button></td></tr>)}
      {!filtered.length && <tr><td colSpan={12} className={styles.empty}>Không có Lead phù hợp với bộ lọc.</td></tr>}
      </tbody></table></div><footer className={styles.footer}>{filtered.length} Lead</footer>
    </section>
    {selected && current && !detail && !mode && <div className={styles.backdrop} onMouseDown={() => setSelected(null)}><aside className={styles.drawer} onMouseDown={e => e.stopPropagation()} ref={drawerRef} role="dialog" aria-modal="true" aria-label="Xem nhanh Lead"><div className={styles.drawerHead}><div><small>LEAD</small><h2>{current.name || "Liên hệ chưa có tên"}</h2></div><button className={styles.icon} onClick={() => setSelected(null)} aria-label="Đóng">×</button></div><div className={styles.drawerBody}><InlineProperty label="Liên hệ" field="name" value={current.name} onSave={saveQuickField}/><InlineProperty label="Số điện thoại" field="phone" value={current.phone} onSave={saveQuickField}/><InlineProperty label="Chương trình quan tâm" field="program" value={current.program} options={["Afterschool","MyTime"]} onSave={saveQuickField}/><InlineProperty label="Chuyên môn" field="path" value={current.path} options={["Hội họa","Piano"]} onSave={saveQuickField}/><Field label="Trạng thái" value="Đang hoạt động"/><h3>Thành viên</h3>{current.members.map(m => <div className={styles.memberQuick} key={m.id}><strong>{m.name}</strong><span>{m.role} · {m.program ?? current.program} / {m.path ?? current.path}</span></div>)}<h3>Nguồn tiếp nhận</h3><Field label="Nguồn" value={current.source}/></div><div className={styles.drawerFoot}><button className={styles.secondary} onClick={startEdit}>Chỉnh sửa</button><button className={styles.primary} onClick={() => { openDetail(current.id); }}>Xem chi tiết</button></div></aside></div>}
    {mode && <div className={styles.backdrop} onMouseDown={() => setMode(null)}><aside className={styles.drawer} onMouseDown={e => e.stopPropagation()} ref={drawerRef} role="dialog" aria-modal="true" aria-label={mode === "create" ? "Tạo Lead" : "Chỉnh sửa Lead"}><div className={styles.drawerHead}><div><small>{step} / 2 · {step === 1 ? "Thông tin liên hệ" : "Thành viên"}</small><h2>{mode === "create" ? "Tạo Lead" : "Chỉnh sửa Lead"}</h2></div><button className={styles.icon} onClick={() => setMode(null)} aria-label="Đóng">×</button></div><div className={styles.steps}><span className={styles.stepActive}>1. Liên hệ</span><span className={step === 2 ? styles.stepActive : ""}>2. Thành viên</span></div><div className={styles.drawerBody}>
      {step === 1 ? <div className={styles.form}><label>Họ tên liên hệ<input value={draft.name} placeholder="Nhập tên liên hệ" onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}/></label><label>Số điện thoại <em>*</em><input value={draft.phone} inputMode="tel" placeholder="09xxxxxxxx" onChange={e => setDraft(d => ({ ...d, phone: e.target.value }))}/></label><label>Chương trình quan tâm<select value={draft.program} onChange={e => setDraft(d => ({ ...d, program: e.target.value }))}><option>Afterschool</option><option>MyTime</option></select></label><label>Chuyên môn<select value={draft.path} onChange={e => setDraft(d => ({ ...d, path: e.target.value }))}><option>Hội họa</option><option>Piano</option></select></label></div> : <div className={styles.form}><p>Thêm những thành viên đang quan tâm. Có thể bổ sung sau.</p>{draft.members.map((m, i) => <div className={styles.memberEditor} key={m.id}><div className={styles.memberHead}><strong>Thành viên {i + 1}</strong><button className={styles.textButton} onClick={() => setDraft(d => ({ ...d, members: d.members.filter(x => x.id !== m.id) }))}>Xóa</button></div><label>Họ tên<input value={m.name} onChange={e => setDraft(d => ({ ...d, members: d.members.map(x => x.id === m.id ? { ...x, name: e.target.value } : x) }))}/></label><label>Vai trò dự kiến<select value={m.role} onChange={e => setDraft(d => ({ ...d, members: d.members.map(x => x.id === m.id ? { ...x, role: e.target.value as Role } : x) }))}><option>Parent</option><option>Student</option><option>Guest</option></select></label><label>Tuổi (nếu biết)<input inputMode="numeric" value={m.age} onChange={e => setDraft(d => ({ ...d, members: d.members.map(x => x.id === m.id ? { ...x, age: e.target.value } : x) }))}/></label><label>Chương trình quan tâm<select value={m.program ?? draft.program} onChange={e => setDraft(d => ({ ...d, members: d.members.map(x => x.id === m.id ? { ...x, program: e.target.value } : x) }))}><option>Afterschool</option><option>MyTime</option></select></label><label>Chuyên môn quan tâm<select value={m.path ?? draft.path} onChange={e => setDraft(d => ({ ...d, members: d.members.map(x => x.id === m.id ? { ...x, path: e.target.value } : x) }))}><option>Hội họa</option><option>Piano</option></select></label></div>)}<button className={styles.secondary} onClick={() => setDraft(d => ({ ...d, members: [...d.members, makeMember(d.program,d.path)] }))}>+ Thêm thành viên</button></div>}
      {error && <p className={styles.error} role="alert">{error}</p>}</div><div className={styles.drawerFoot}><button className={styles.secondary} onClick={() => step === 2 ? (setStep(1), setError("")) : setMode(null)}>{step === 2 ? "Quay lại" : "Hủy"}</button><button className={styles.primary} onClick={() => { if (step === 1) { if (!/^0\d{9}$/.test(draft.phone.replace(/\D/g, ""))) { setError("Nhập số điện thoại Việt Nam hợp lệ gồm 10 chữ số."); return; } setError(""); setStep(2); } else save(); }}>{step === 1 ? "Tiếp tục" : mode === "create" ? "Tạo Lead" : "Lưu thay đổi"}</button></div></aside></div>}
  </main>;
}
function Field({ label, value }: { label: string; value: string }) { return <div className={styles.field}><span>{label}</span><strong>{value}</strong></div>; }
