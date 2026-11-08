"use client";
import { useContext, useEffect, useState } from "react";
import { LocalizedModuleTitle } from "@/lib/pino-nav-locale-context";
import { BoDataTable } from "@/app/bo/components/registration/BoDataTable";
import { BoTableSettings } from "@/app/bo/components/registration/BoTableSettings";
import { TddHostMenu } from "@/app/components/workspace-adapters/SurfaceWorkspace";
import { defaultTable } from "@/lib/bo-registration";
import {
  loadHoTvPolicyDirectory, tvPolicyModule,
  tvPolicyDeniedMessage, tvPolicyLoginMessage, tvPolicyUnavailableMessage,
  type TvPolicyDirectoryRead,
} from "@/lib/ho-tv-policy-directory";

/** PAP-1386 / PAP-1419 S3: real private Founder-only read. No S4 opener or Viewer. */
export function TvPolicyDirectory() {
  const menu = useContext(TddHostMenu);
  const [value, setValue] = useState(() => defaultTable(tvPolicyModule.fields));
  const [settings, setSettings] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [read, setRead] = useState<TvPolicyDirectoryRead | null>(null);
  useEffect(() => {
    let live = true;
    void loadHoTvPolicyDirectory().then(result => {
      if (live) { setRead(result); setPage(1); }
    });
    return () => { live = false; };
  }, []);
  const policy = { identity: "name", search: [], filter: [], sort: [], group: [], edit: [], viewActions: [] };
  const update = (patch: Partial<typeof value>) => setValue(current => ({ ...current, ...patch }));
  const noop = () => {};
  const loadState = read === null ? "loading" : read.status === "ready" ? "ready"
    : read.status === "denied"
      ? read.reason === "LOGIN_REQUIRED" ? tvPolicyLoginMessage : tvPolicyDeniedMessage
      : tvPolicyUnavailableMessage;
  const rows = [...(read?.rows ?? [])];
  return <section id="list-screen" data-pnr-tv-stage="s3-list"
    data-policy-directory-state={read?.status ?? "loading"}>
    <div className="page-heading"><div className="page-heading-left">
      {menu("menu-btn")}<h1><LocalizedModuleTitle label="Pinoria TV" moduleKey="tvPolicies" /></h1>
    </div></div>
    <BoDataTable module={tvPolicyModule} rows={rows} loadState={loadState}
      value={value} update={update} page={page} setPage={setPage} onOpen={noop}
      onSettings={setSettings} filterOpen={false} setFilterOpen={noop}
      views={[]} changeViews={noop} activeView={null} applyView={noop}
      reset={() => setValue(defaultTable(tvPolicyModule.fields))} undo={noop} canUndo={false}
      showChrome={false} openEnabled={false} totalKnown={read?.status === "ready"} policy={policy} />
    {settings ? <BoTableSettings screen={settings} setScreen={setSettings} onClose={() => setSettings(null)}
      fields={tvPolicyModule.fields} rows={rows} value={value} update={update}
      views={[]} setViews={noop} applyView={noop} policy={policy} /> : null}
  </section>;
}
