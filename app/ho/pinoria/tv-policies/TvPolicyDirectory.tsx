"use client";
import { useContext, useState } from "react";
import { BoDataTable } from "@/app/bo/components/registration/BoDataTable";
import { BoTableSettings } from "@/app/bo/components/registration/BoTableSettings";
import { TddHostMenu } from "@/app/components/workspace-adapters/SurfaceWorkspace";
import { defaultTable } from "@/lib/bo-registration";
import { readHoTvPolicyDirectory, tvPolicyModule, tvPolicyUnavailableMessage } from "@/lib/ho-tv-policy-directory";

/** PAP-1386 / PAP-1419 S3 bounded Table. No S4 record opener or viewer action. */
export function TvPolicyDirectory() {
  const menu = useContext(TddHostMenu);
  const [value, setValue] = useState(() => defaultTable(tvPolicyModule.fields));
  const [settings, setSettings] = useState<string | null>(null);
  const read = readHoTvPolicyDirectory();
  const policy = { identity: "name", search: [], filter: [], sort: [], group: [], edit: [], viewActions: [] };
  const update = (patch: Partial<typeof value>) => setValue(current => ({ ...current, ...patch }));
  const noop = () => {};
  return <section id="list-screen" data-pnr-tv-stage="s3-list" data-policy-directory-state={read.status}>
    <div className="page-heading"><div className="page-heading-left">
      {menu("menu-btn")}<h1>Pinoria TV</h1>
    </div></div>
    <BoDataTable module={tvPolicyModule} rows={[...read.rows]} loadState={tvPolicyUnavailableMessage}
      value={value} update={update} page={1} setPage={noop} onOpen={noop}
      onSettings={setSettings} filterOpen={false} setFilterOpen={noop}
      views={[]} changeViews={noop} activeView={null} applyView={noop}
      reset={() => setValue(defaultTable(tvPolicyModule.fields))} undo={noop} canUndo={false}
      showChrome={false} totalKnown={read.total !== null} policy={policy} />
    {settings ? <BoTableSettings screen={settings} setScreen={setSettings} onClose={() => setSettings(null)}
      fields={tvPolicyModule.fields} rows={[]} value={value} update={update}
      views={[]} setViews={noop} applyView={noop} policy={policy} /> : null}
  </section>;
}
