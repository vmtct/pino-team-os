"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { LogoutButton } from "@/app/components/tos-shell/LogoutButton";
import Image from "next/image";
import Link from "next/link";
import { hoRecordId } from "@/lib/ho-routes";
import type { BoModule } from "@/lib/bo-registration";
import readApi from "@/public/bo-authority-source/school-adapters.js";
import { defaultTable, norm, type BoRecord, type BoTableState } from "@/lib/bo-registration";
import { BoCenterSwitcher } from "./BoCenterSwitcher";
import { BoDataTable } from "./BoDataTable";
import { BoQuickView } from "./BoQuickView";
import { BoStudentCreate } from "./BoStudentCreate";
import { BoFullDetail } from "./BoFullDetail";
import { BoTableSettings, type BoSavedView } from "./BoTableSettings";
export type BoWorkspaceSource = { modules: Record<string, BoModule>; load: (key: string, fetcher: typeof fetch, options: Record<string, string>) => Promise<BoRecord[]>; scopeLabel: (key: string, options: Record<string, string>) => string; surface?: "ho"; readOnly?: boolean; allowStudentCreate?: boolean; isModuleReadOnly?: (key: string) => boolean; routeForModule?: (key: string) => string };
type WorkspaceSnapshot = { table: BoTableState; views: BoSavedView[]; activeView: string | null };
type Context = { displayName: string | null };
const icons: Record<string, string> = { students: "◉", classes: "▦", subscriptions: "▤", enrollments: "↗", visits: "◷", staffs: "◉", termWeeks: "▦", timekeeping: "◷", salaryPeriods: "▤", worlds: "◈", catalog: "▦", sets: "▤", users: "◉", roles: "▣", audits: "≡" };
/** One React owner for every live /bo table, drawer and detail. No prototype JS executes. */
export function BoRegistrationWorkspace({ currentUser, moduleKey = "students", options = {}, source = readApi, content, headerContent }: { source?: BoWorkspaceSource; currentUser: Context; moduleKey?: string; options?: Record<string, string>; content?: React.ReactNode; headerContent?: React.ReactNode }) {
  const key = Object.hasOwn(source.modules, moduleKey) ? moduleKey : "students";
  return <BoWorkspace source={source} key={key + JSON.stringify(options)} moduleKey={key} options={options} currentUser={currentUser} content={content} headerContent={headerContent} />;
}
function BoWorkspace({ moduleKey, options, currentUser, source, content, headerContent }: { source: BoWorkspaceSource; moduleKey: string; options: Record<string, string>; currentUser: Context; content?: React.ReactNode; headerContent?: React.ReactNode }) {
  const ho = source.surface === "ho";
  const readOnly = source.readOnly || source.isModuleReadOnly?.(moduleKey) === true;
  const studentCreate = moduleKey === "students" && (source === readApi || source.allowStudentCreate) && !readOnly;
  const definition = source.modules[moduleKey], [rows, setRows] = useState<BoRecord[]>([]), [loadState, setLoadState] = useState("loading");
  const [retry, setRetry] = useState(0);
  const [table, setTable] = useState(() => defaultTable(definition.fields)), [page, setPage] = useState(1), [filterOpen, setFilterOpen] = useState(false);
  const [drawer, setDrawer] = useState<BoRecord | "create" | null>(null), [detail, setDetail] = useState<BoRecord | null>(null), [settings, setSettings] = useState<string | null>(null);
  const [undoAvailable, setUndoAvailable] = useState(false);
  const [views, setViews] = useState<BoSavedView[]>([]), [activeView, setActiveView] = useState<string | null>(null);
  const [navSearch, setNavSearch] = useState(""), [collapsed, setCollapsed] = useState<string[]>([]), [mobileOpen, setMobileOpen] = useState(false);
  const [hoNavReady, setHoNavReady] = useState(false);
  const [hoRecordNotFound, setHoRecordNotFound] = useState(false);
  const history = useRef<WorkspaceSnapshot[]>([]), future = useRef<WorkspaceSnapshot[]>([]), tableRef = useRef(table), viewsRef = useRef(views), activeViewRef = useRef(activeView), returnScroll = useRef(0), returnTableScroll = useRef({ left: 0, top: 0 }), returnSubject = useRef<string | null>(null), restorePending = useRef(false), sidebar = useRef<HTMLElement>(null);
  useEffect(() => { tableRef.current = table; viewsRef.current = views; activeViewRef.current = activeView; }, [table, views, activeView]);
  // HO sidebar state survives client route transitions but is never shared with BO.
  useEffect(() => {
    if (!ho) return;
    try {
      const state = JSON.parse(sessionStorage.getItem("pino:ho:sidebar:v1") || "{}") as {collapsed?:unknown;search?:unknown};
      if (Array.isArray(state.collapsed)) setCollapsed(state.collapsed.filter((x):x is string => typeof x === "string" && Object.values(source.modules).some(m => m.group === x)).slice(0,10));
      if (typeof state.search === "string") setNavSearch(state.search.slice(0,100));
    } catch { /* storage unavailable or invalid; continue with defaults */ }
    setHoNavReady(true);
  }, [ho, source]);
  useEffect(() => {
    if (!ho || !hoNavReady) return;
    try { sessionStorage.setItem("pino:ho:sidebar:v1", JSON.stringify({collapsed,search:navSearch})); } catch { /* keep navigation working when storage is unavailable */ }
  }, [ho,hoNavReady,collapsed,navSearch]);
  function syncHoRecordFromUrl(data: BoRecord[]) {
    if (!ho) return;
    const target = hoRecordId(new URL(window.location.href).searchParams.get("record"));
    const row = target ? data.find(r => r.id === target) : undefined;
    setDrawer(row ?? null);
    setDetail(null);
    setHoRecordNotFound(Boolean(target && !row));
  }
  function setHoRecordUrl(id: string | null) {
    if (!ho) return;
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("record", id); else url.searchParams.delete("record");
    window.history.pushState(null, "", url.pathname + url.search + url.hash);
    setHoRecordNotFound(false);
  }
  useEffect(() => {
    if (!ho || loadState !== "ready") return;
    const onBack = () => syncHoRecordFromUrl(rows);
    window.addEventListener("popstate", onBack);
    return () => window.removeEventListener("popstate",onBack);
  }, [ho,loadState,rows]);

  useEffect(() => {
    const cancel = new AbortController();
    setLoadState("loading"); setRows([]); setDrawer(null); setDetail(null);
    // Cancellation and the adapter timeout both apply. Unmounted/stale module reads never publish.
    const fetcher: typeof fetch = (input, init) => fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([cancel.signal, init.signal]) : cancel.signal });
    void source.load(moduleKey, fetcher, options).then(data => { if (!cancel.signal.aborted) { setRows(data); setLoadState("ready"); if (ho) syncHoRecordFromUrl(data); } }).catch((error: unknown) => { if (!cancel.signal.aborted) { setRows([]); setLoadState(error instanceof Error ? error.message : "Không thể tải dữ liệu."); } });
    document.title = definition.label + (ho ? " · PINO Head Office" : " · PINO BO");
    return () => cancel.abort();
  }, [moduleKey, definition.label, options, source, retry, ho]);
  function update(patch: Partial<BoTableState>) { history.current.push({ table: structuredClone(tableRef.current), views: structuredClone(viewsRef.current), activeView: activeViewRef.current }); history.current = history.current.slice(-60); future.current = []; setUndoAvailable(true); setTable(t => ({ ...t, ...patch })); setPage(1); setActiveView(null); }
  function undo(redo = false) { const source = redo ? future : history, target = redo ? history : future, previous = source.current.pop(); if (!previous) return; target.current.push({ table: structuredClone(tableRef.current), views: structuredClone(viewsRef.current), activeView: activeViewRef.current }); setUndoAvailable(Boolean(history.current.length)); setTable(previous.table); setViews(previous.views); setPage(1); setActiveView(previous.activeView); }
  const undoRef = useRef(undo); useEffect(() => { undoRef.current = undo; });
  useEffect(() => { const key = (e: KeyboardEvent) => { if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z" || (e.target instanceof Element && e.target.closest("input,textarea,select"))) return; e.preventDefault(); undoRef.current(e.shiftKey); }; document.addEventListener("keydown", key); return () => document.removeEventListener("keydown", key); }, []);
  useEffect(() => {
    if (!mobileOpen) return;
    const origin = document.activeElement as HTMLElement | null, prev = document.body.style.overflow;
    document.body.style.overflow = "hidden"; sidebar.current?.querySelector<HTMLInputElement>("input")?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileOpen(false); if (e.key === "Tab") { const items = [...sidebar.current!.querySelectorAll<HTMLElement>('button:not(:disabled), input, a[href]')].filter(e => e.getClientRects().length); if (e.shiftKey && document.activeElement === items[0]) { e.preventDefault(); items.at(-1)?.focus(); } else if (!e.shiftKey && document.activeElement === items.at(-1)) { e.preventDefault(); items[0]?.focus(); } } };
    document.addEventListener("keydown", key); return () => { document.removeEventListener("keydown", key); document.body.style.overflow = prev; origin?.focus(); };
  }, [mobileOpen]);
  const groups = [...new Set(Object.values(source.modules).map(m => m.group))];
  function menu(id: string) { return <button type="button" className="mobile-menu lab-menu" id={id} aria-label="Mở menu" aria-expanded={mobileOpen} aria-controls="sidebar" onClick={() => setMobileOpen(v => !v)}>☰</button>; }
  function back() { restorePending.current = true; setDetail(null); if (ho) setHoRecordUrl(null); }
  useLayoutEffect(() => { if (detail || !restorePending.current) return; restorePending.current = false; window.scrollTo(0, returnScroll.current); const scroll = document.getElementById("table-scroll"); if (scroll) { scroll.scrollLeft = returnTableScroll.current.left; scroll.scrollTop = returnTableScroll.current.top; } document.querySelector<HTMLElement>('[data-open="' + returnSubject.current + '"]')?.focus({ preventScroll: true }); }, [detail]);
  const userLabel = currentUser.displayName || "Tài khoản";
  let scope = ""; try { scope = source.scopeLabel(moduleKey, options); } catch { /* adapter renders the invalid range error, with no fallback data */ }
  return <div id="app" data-surface={ho ? "ho" : undefined} data-bo-runtime="react" data-bo-module={moduleKey}><aside ref={sidebar} className={"sidebar " + (mobileOpen ? "show" : "")} id="sidebar">{ho ? <><div className="brand"><Image className="ho-brand-logo" src="https://assets.pinohouse.art/core/Pino%20Logo.png" alt="PINO House" width={46} height={46} unoptimized /><div className="brand-type"><strong>PINO House</strong><small>Head Office</small></div></div></> : <BoCenterSwitcher />}<div className="sidebar-finder"><label className="nav-query"><span>⌕</span><input id="nav-search" aria-label="Tìm module" placeholder="Tìm module..." autoComplete="off" value={navSearch} onChange={e => setNavSearch(e.target.value)} /></label><div className="nav-collapse-actions"><button type="button" id="collapse-all" title="Collapse all" disabled={collapsed.length === groups.length} onClick={() => setCollapsed(groups)}>⊟</button><button type="button" id="expand-all" title="Expand all" disabled={!collapsed.length} onClick={() => setCollapsed([])}>⊞</button></div></div><nav id="lab-nav" className="nav-scroll" aria-label="Module">{groups.map(group => { const items = Object.entries(source.modules).filter(([, m]) => m.group === group && norm(m.label).includes(norm(navSearch))), expanded = Boolean(navSearch) || !collapsed.includes(group); return items.length ? <section className="nav-group" key={group}><button type="button" className="nav-group-toggle" aria-expanded={expanded} onClick={() => setCollapsed(c => c.includes(group) ? c.filter(g => g !== group) : [...c, group])}><span>{group}</span><span className="nav-group-caret">{expanded ? "⌄" : "›"}</span></button>{expanded ? <div className="nav-group-links">{items.map(([key, m]) => (ho ? <Link className={"nav-link " + (key === moduleKey ? "active" : "")} aria-current={key === moduleKey ? "page" : undefined} href={source.routeForModule?.(key) ?? "/ho/centers"} prefetch={false} key={key} onClick={() => setMobileOpen(false)}><span className="nav-icon">{icons[key] || "▦"}</span><span className="nav-title">{m.label}</span></Link> : <a className={"nav-link " + (key === moduleKey ? "active" : "")} aria-current={key === moduleKey ? "page" : undefined} href={source.routeForModule?.(key) ?? (key === "students" ? "/bo" : "/bo?module=" + key)} key={key}><span className="nav-icon">{icons[key] || "▦"}</span><span className="nav-title">{m.label}</span></a>))}</div> : null}</section> : null; })}</nav><div className="sidebar-footer"><div className="avatar">{userLabel[0]}</div><div><strong>{userLabel}</strong><small>PINO House</small></div>{ho ? <LogoutButton /> : <span className="user-options">···</span>}</div></aside>
    <button type="button" className={"mobile-shade " + (mobileOpen ? "show" : "")} id="nav-scrim" aria-label="Đóng menu" onClick={() => setMobileOpen(false)} /><div className="shell"><main className="workspace" id="workspace">{content ? content : detail ? <BoFullDetail key={detail.id} module={definition} moduleKey={moduleKey} record={detail} mobileMenu={menu("detail-menu-btn")} onBack={back} onStudentNeutralized={studentCreate ? () => { setDetail(null); setRetry(n => n + 1); } : undefined} enableStudentSubscriptions={!ho && moduleKey === "students"} /> : <section id="list-screen"><div className="page-heading"><div className="page-heading-left">{menu("menu-btn")}<h1>{definition.label}</h1></div><div className="heading-actions">{!readOnly ? <button id="settings-btn" type="button" className="settings-trigger" title="Cài đặt bảng" aria-label="Cài đặt bảng" onClick={() => setSettings("home")}>☷</button> : null}{!readOnly ? <button id="add-record" type="button" className="primary-btn" onClick={() => setDrawer("create")}><span>＋</span> Tạo mới</button> : null}</div></div>{headerContent ?? null}{scope ? <p className="settings-hint">{scope}</p> : null}{ho && hoRecordNotFound ? <p role="status" className="settings-hint">Bản ghi trong liên kết không còn trong danh sách hoặc không có quyền xem.</p> : null}{ho && loadState !== "loading" && loadState !== "ready" ? <button type="button" className="secondary-btn" onClick={() => setRetry(n => n + 1)}>Thử lại</button> : null}<BoDataTable legacyStyles={ho} minimal={readOnly} module={definition} rows={rows} loadState={loadState} value={table} update={update} page={page} setPage={setPage} selected={typeof drawer === "object" ? drawer?.id : undefined} onOpen={record => { setDrawer(record); if (ho) setHoRecordUrl(record.id); }} onSettings={setSettings} filterOpen={filterOpen} setFilterOpen={setFilterOpen} views={views} changeViews={next => { update({}); setViews(next); }} activeView={activeView} applyView={view => { update(view?.state ?? defaultTable(definition.fields)); setActiveView(view?.id ?? null); }} reset={() => update(defaultTable(definition.fields))} undo={() => undo()} canUndo={undoAvailable} /></section>}</main></div>
    {drawer === "create" && studentCreate ? <BoStudentCreate onClose={() => setDrawer(null)} onCreated={() => { setDrawer(null); setRetry(n => n + 1); }} /> : drawer ? <BoQuickView legacyStyles={ho} key={typeof drawer === "string" ? "create" : drawer.id} module={definition} record={drawer === "create" ? null : drawer} onClose={() => { setDrawer(null); if (ho) setHoRecordUrl(null); }} onDetail={() => { if (drawer === "create") return; returnScroll.current = window.scrollY; const scroll = document.getElementById("table-scroll"); returnTableScroll.current = { left: scroll?.scrollLeft ?? 0, top: scroll?.scrollTop ?? 0 }; returnSubject.current = drawer.id; setDetail(drawer); setDrawer(null); window.scrollTo(0, 0); }} /> : null}
    {settings ? <BoTableSettings screen={settings} setScreen={setSettings} onClose={() => setSettings(null)} fields={definition.fields} rows={rows} value={table} update={update} views={views} setViews={next => { update({}); setViews(next); }} applyView={view => { update(view.state); setActiveView(view.id); }} /> : null}
  </div>;
}
