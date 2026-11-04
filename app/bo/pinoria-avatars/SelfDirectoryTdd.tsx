"use client";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import { useEffect, useState } from "react";
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
  // PAP-1458 / Epic PAP-1316: BO shell is the sole owner of the authorized Active Center.
  // Never create a module-local Center picker or shadow Center discovery.
  const center=useBoCenterSelection();
  const blocked=!center || center.loading || Boolean(center.error);
  const selected=blocked ? "" : center.selected;
  const centerSource=center?.source ?? "centers";
  const [ready,setReady]=useState<Bound|null>(null);
  const [failure,setFailure]=useState<Failure|null>(null);
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    if(!selected)return;
    const ctl=new AbortController();let instance:AuthenticatedSurfaceAdapter<F>|null=null;
    void createBoTddAdapter({
      registry:new TddRegistry(verifySelfWardrobeApproval),definition:selfDefinition,provider:selfProvider,
      centerId:selected,centerSource,
    },ctl.signal).then(adapter=>{
      instance=adapter;
      if(ctl.signal.aborted){adapter.dispose();return;}
      setReady({centerId:selected,adapter,navigation:browserTddNavigation("BO","pinoria-avatars",selfQuery)});
    }).catch(e=>{if(!ctl.signal.aborted)setFailure({centerId:selected,retry,message:e instanceof Error?e.message:"Không thể tải Self Directory."});});
    return ()=>{ctl.abort();instance?.dispose();};
  },[selected,centerSource,retry]);
  // Prevent the old Center's TDD adapter/detail from appearing even for one render
  // while React cleans up the previous async request.
  const current=ready?.centerId===selected ? ready : null;
  const error=failure?.centerId===selected && failure.retry===retry ? failure.message : "";
  const content=<section aria-label="Danh bạ Pinoria Self">
        {!center ? <p role="alert">Không tìm thấy Center context của BO.</p> :
          center.loading ? <p role="status">Đang xác thực cơ sở được cấp quyền…</p> :
          center.error ? <p role="alert">{center.error}</p> : null}
        {selected ? error ? <p role="alert">Không thể mở danh bạ được cấp quyền. <button type="button" onClick={()=>setRetry(n=>n+1)}>Thử lại</button></p>
          : current ? <SurfaceWorkspace key={selected} adapter={current.adapter} navigation={current.navigation} initialQuery={selfQuery} detailProperties={properties => <SelfDirectoryProperties fields={properties.fields} record={properties.record} sections={properties.sections}/>}
          detailApprovedExtension={(row,context,activeTab,_principalId,onSaved) =>
            activeTab === "loadout"
              ? <SelfLoadoutDetail key={selected + ":" + row.id} row={row} centerId={selected} activeTab={activeTab}
                  canView={context.authorize("pinoria.self.loadout.view")} canManage={context.authorize("pinoria.self.loadout.manage")}
                  canViewItems={context.authorize("pinoria.self.item.view")} onSaved={onSaved}/>
              : <SelfWardrobeDetail key={selected + ":" + row.id} row={row} centerId={selected} activeTab={activeTab}
                  canView={context.authorize("pinoria.self.item.view")} canManage={context.authorize("pinoria.self.item.manage")}
                  onSaved={onSaved} />}/>
          : <p role="status">Đang xác minh quyền và tải danh bạ…</p>
          : !blocked ? <p role="status">Chọn trung tâm tại góc trên trái để xem Pinoria Self.</p> : null}
      </section>;
  return <BoRegistrationWorkspace source={selfDirectoryNavSource} moduleKey="pinoria-avatars" currentUser={{displayName:null}} content={content}/>;
}
