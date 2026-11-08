"use client";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import { useEffect, useState } from "react";
import { BoActionButton } from "@pino/design-system/react";
import { CreateSelfDrawer } from "./CreateSelfDrawer";
import readApi from "@/public/bo-authority-source/school-adapters.js";
import { BoRegistrationWorkspace } from "@/app/bo/components/registration/BoRegistrationWorkspace";
import { SurfaceWorkspace } from "@/app/components/workspace-adapters/SurfaceWorkspace";
import { createBoTddAdapter, type AuthenticatedSurfaceAdapter } from "@/lib/workspace-adapters";
import { browserTddNavigation, type AdapterNavigation } from "@/lib/workspace-adapters/navigation";
import { TddRegistry } from "@/lib/workspace-schema";
import { selfDefinition, selfFields, selfQuery, selfProvider, verifySelfWardrobeApproval } from "./schema";
import { SelfWardrobeDetail } from "./SelfWardrobeDetail";
import { SelfLoadoutDetail } from "./SelfLoadoutDetail";
import { useBoCenterSelection } from "../components/registration/BoCenterSelection";
import type { DirectoryCenterSource } from "./centers";

import { SelfDirectoryProperties } from "./SharedProperties";

type F = typeof selfFields;
type Bound = { centerId: string; adapter: AuthenticatedSurfaceAdapter<F>; navigation: AdapterNavigation<F> };
type Failure = { centerId: string; retry: number; message: string };
// PAP-1447 / Epic PAP-1097: content-only TDD owns its nav metadata without a generic data adapter.
const selfDirectoryNavSource = {
  ...readApi,
  modules: {
    ...readApi.modules,
    "pinoria-avatars": { label: "Self Directory", group: "PINORIA", fields: [] },
  },
};
export function SelfDirectoryTdd(){
  // PAP-1458 / Epic PAP-1316: only the BO shell owns authorized Active Center.
  const center=useBoCenterSelection();
  const selected=(!center || center.loading || center.error) ? "" : center.selected;
  const source=center?.source ?? "centers";
  const content=<section aria-label="Danh bạ Pinoria Self">
    {!center ? <p role="alert">Không tìm thấy Center context của BO.</p> :
      center.loading ? <p role="status">Đang xác thực cơ sở được cấp quyền…</p> :
      center.error ? <p role="alert">{center.error}</p> :
      selected ? <ScopedSelfDirectory key={selected + ":" + source} selected={selected} centerSource={source}/> :
      <p role="status">Chọn trung tâm tại góc trên trái để xem Pinoria Self.</p>}
  </section>;
  return <BoRegistrationWorkspace source={selfDirectoryNavSource} moduleKey="pinoria-avatars" currentUser={{displayName:null}} content={content}/>;
}

/** Center-isolated component: A→B→A mounts a fresh adapter even if B never finished.
 * Unmount aborts pending Core reads and disposes the old scoped TDD controller. */
function ScopedSelfDirectory({selected,centerSource}: {selected: string; centerSource: DirectoryCenterSource}){
  const [ready,setReady]=useState<Bound|null>(null);
  const [failure,setFailure]=useState<Failure|null>(null);
  const [retry,setRetry]=useState(0);
  const [creating,setCreating]=useState(false);
  const [createdNotice,setCreatedNotice]=useState("");
  useEffect(()=>{
    const ctl=new AbortController();let instance:AuthenticatedSurfaceAdapter<F>|null=null;
    void createBoTddAdapter({
      registry:new TddRegistry(verifySelfWardrobeApproval),definition:selfDefinition,provider:selfProvider,
      centerId:selected,centerSource,
    },ctl.signal).then(adapter=>{
      instance=adapter;
      if(ctl.signal.aborted){adapter.dispose();return;}
      setReady({centerId:selected,adapter,navigation:browserTddNavigation("BO","pinoria-avatars",selfQuery)});
    }).catch(e=>{
      if(!ctl.signal.aborted)setFailure({centerId:selected,retry,message:e instanceof Error?e.message:"Không thể tải Self Directory."});
    });
    return ()=>{ctl.abort();instance?.dispose();};
  },[selected,centerSource,retry]);
  // A previous adapter can never render for a different Center, including on retry.
  const current=ready?.centerId===selected ? ready : null;
  const error=failure?.centerId===selected && failure.retry===retry ? failure.message : "";
  if(error) return <p role="alert">Không thể mở danh bạ được cấp quyền. <button type="button" onClick={()=>{setReady(null);setRetry(n=>n+1)}}>Thử lại</button></p>;
  if(!current)return <p role="status">Đang xác minh quyền và tải danh bạ…</p>;
  const canCreate=current.adapter.context.authorize("pinoria.self.create");
  return <>
    {createdNotice ? <p role="status">{createdNotice}</p> : null}
    <SurfaceWorkspace adapter={current.adapter} key={selected} navigation={current.navigation} initialQuery={selfQuery}
    tableHeaderActions={canCreate
      ? <BoActionButton type="button" variant="primary" onClick={()=>{setCreatedNotice("");setCreating(true)}}>＋ Tạo Self</BoActionButton>
      : null}
    detailProperties={properties => <SelfDirectoryProperties fields={properties.fields} record={properties.record} sections={properties.sections}/>}
    detailApprovedExtension={(row,context,activeTab,_principalId,onSaved) =>
      activeTab === "loadout"
        ? <SelfLoadoutDetail key={selected + ":" + row.id} row={row} centerId={selected} activeTab={activeTab}
            canView={context.authorize("pinoria.self.loadout.view")} canManage={context.authorize("pinoria.self.loadout.manage")}
            canViewItems={context.authorize("pinoria.self.item.view")} onSaved={onSaved}/>
        : <SelfWardrobeDetail key={selected + ":" + row.id} row={row} centerId={selected} activeTab={activeTab}
            canView={context.authorize("pinoria.self.item.view")} canManage={context.authorize("pinoria.self.item.manage")}
            onSaved={onSaved} />}/>
    {creating && canCreate ? <CreateSelfDrawer centerId={selected} onClose={()=>setCreating(false)}
      onCreated={()=>{setCreating(false);setCreatedNotice("Đã tạo Self.");setReady(null);setRetry(n=>n+1)}}/> : null}
  </>;
}
