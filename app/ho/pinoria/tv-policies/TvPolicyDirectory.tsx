"use client";
import { useContext, useEffect, useRef, useState } from "react";
import { LocalizedModuleTitle } from "@/lib/pino-nav-locale-context";
import { BoDataTable } from "@/app/bo/components/registration/BoDataTable";
import { BoTableSettings } from "@/app/bo/components/registration/BoTableSettings";
import { TddHostMenu } from "@/app/components/workspace-adapters/SurfaceWorkspace";
import { defaultTable, type BoRecord } from "@/lib/bo-registration";
import {
  loadHoTvPolicyDirectory, presentHoTvPolicyRows, tvPolicyModule,
  tvPolicyDeniedMessage, tvPolicyLoginMessage, tvPolicyUnavailableMessage,
  type TvPolicyDirectoryRead,
} from "@/lib/ho-tv-policy-directory";
import { readTvPolicyLocation, tvPolicyLocationUrl, type TvPolicyLocation } from "@/lib/ho-tv-policy-navigation";
import { TvPolicyRecord } from "./TvPolicyRecord";

const listLocation: TvPolicyLocation = { policyId: null, pane: "drawer", tab: "overview" };

/** PAP-650 / PNR-TV · PAP-1419 S3+S4: the same authorized Core Directory
 * record drives Table, one-column Quick Drawer and Overview-first Full Detail.
 * The URL is presentation state, never a privilege or a source of Policy data.
 */
export function TvPolicyDirectory() {
  const menu = useContext(TddHostMenu);
  const [value, setValue] = useState(() => defaultTable(tvPolicyModule.fields));
  const [settings, setSettings] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [read, setRead] = useState<TvPolicyDirectoryRead | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [location, setLocation] = useState<TvPolicyLocation>(listLocation);
  const returnScroll = useRef({ y: 0, x: 0 });

  useEffect(() => {
    const sync = () => {
      const next = readTvPolicyLocation(window.location.search);
      setLocation(next);
      if (next.policyId) { setRead(null); setRefresh(n => n + 1); }
      else requestAnimationFrame(() => {
        window.scrollTo(0, returnScroll.current.y);
        const table = document.getElementById("table-scroll");
        if (table) table.scrollLeft = returnScroll.current.x;
      });
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  useEffect(() => {
    let live = true;
    void loadHoTvPolicyDirectory().then(result => {
      // S4 Back must preserve the Founder’s exact Table page, filters and scroll.
      if (live) setRead(result);
    });
    return () => { live = false; };
  }, [refresh]);

  function navigate(next: TvPolicyLocation, push = true) {
    const url = tvPolicyLocationUrl(window.location.href, next);
    const previous = (window.history.state ?? {}) as { pnrTvDepth?: number };
    const depth = Number.isSafeInteger(previous.pnrTvDepth) ? previous.pnrTvDepth! : 0;
    const state = { ...previous, pnrTvDepth: push ? depth + 1 : depth };
    if (push) window.history.pushState(state, "", url);
    else window.history.replaceState(state, "", url);
    setLocation(next);
  }

  function openRecord(record: BoRecord) {
    returnScroll.current = {
      y: window.scrollY,
      x: document.getElementById("table-scroll")?.scrollLeft ?? 0,
    };
    setSettings(null);
    setFilterOpen(false);
    navigate({ policyId: record.id, pane: "drawer", tab: "overview" });
    setRead(null);
    setRefresh(n => n + 1);
  }

  function openDetail() {
    if (!location.policyId) return;
    navigate({ policyId: location.policyId, pane: "detail", tab: "overview" });
    setRead(null);
    setRefresh(n => n + 1);
    window.scrollTo(0, 0);
  }

  function closeRecord() {
    const depth = (window.history.state as { pnrTvDepth?: number } | null)?.pnrTvDepth;
    if (typeof depth === "number" && depth > 0) {
      window.history.back();
    } else {
      navigate(listLocation, false);
      requestAnimationFrame(() => window.scrollTo(0, returnScroll.current.y));
    }
  }

  function selectTab(tab: TvPolicyLocation["tab"]) {
    if (!location.policyId) return;
    navigate({ ...location, tab }, false);
  }

  const policy = {
    identity: "name",
    search: ["name", "typeName", "scope", "center", "resolution"],
    filter: ["typeName", "scope", "center", "resolution", "inherited", "aspectRatio"],
    sort: ["name", "typeName", "scope", "center", "resolution", "active", "latest"],
    group: [], edit: [], viewActions: [],
  };
  const update = (patch: Partial<typeof value>) => setValue(current => ({ ...current, ...patch }));
  const noop = () => {};
  const loadState = read === null ? "loading" : read.status === "ready" ? "ready"
    : read.status === "denied"
      ? read.reason === "LOGIN_REQUIRED" ? tvPolicyLoginMessage : tvPolicyDeniedMessage
      : tvPolicyUnavailableMessage;
  const rows = presentHoTvPolicyRows(read?.rows ?? []);
  const selected = rows.find(row => row.id === location.policyId) ?? null;
  const recordState = read === null ? "loading" : read.status;

  if (location.policyId && location.pane === "detail")
    return <TvPolicyRecord policy={selected} state={recordState} pane="detail"
      tab={location.tab} onClose={closeRecord} onDetail={openDetail} onTabChange={selectTab}
      returnFocus={() => document.querySelector<HTMLElement>('tr[data-record="' + location.policyId + '"]')} />;

  return <>
    <section id="list-screen" data-pnr-tv-stage="s3-list" data-pnr-tv-s4="enabled"
      data-policy-directory-state={read?.status ?? "loading"}>
      <div className="page-heading"><div className="page-heading-left">
        {menu("menu-btn")}<h1><LocalizedModuleTitle label="Pinoria TV" moduleKey="tvPolicies" /></h1>
      </div></div>
      <BoDataTable module={tvPolicyModule} rows={rows} loadState={loadState}
        value={value} update={update} page={page} setPage={setPage} onOpen={openRecord}
        onPrimaryCellOpen={openRecord} selected={location.policyId ?? undefined}
        onSettings={setSettings} filterOpen={filterOpen} setFilterOpen={setFilterOpen}
        views={[]} changeViews={noop} activeView={null} applyView={noop}
        reset={() => setValue(defaultTable(tvPolicyModule.fields))} undo={noop} canUndo={false}
        showChrome minimal openEnabled totalKnown={read?.status === "ready"} policy={policy} />
      {settings ? <BoTableSettings screen={settings} setScreen={setSettings} onClose={() => setSettings(null)}
        fields={tvPolicyModule.fields} rows={rows} value={value} update={update}
        views={[]} setViews={noop} applyView={noop} policy={policy} /> : null}
    </section>
    {location.policyId ? <TvPolicyRecord policy={selected} state={recordState} pane="drawer"
      tab={location.tab} onClose={closeRecord} onDetail={openDetail} onTabChange={selectTab}
      returnFocus={() => document.querySelector<HTMLElement>('tr[data-record="' + location.policyId + '"]')} /> : null}
  </>;
}
