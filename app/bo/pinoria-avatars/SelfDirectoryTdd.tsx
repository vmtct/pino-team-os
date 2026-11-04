"use client";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import { useEffect, useState } from "react";
import { PresentationState, SingleSelect } from "@pino/design-system/react";
import readApi from "@/public/bo-authority-source/school-adapters.js";
import { BoRegistrationWorkspace } from "@/app/bo/components/registration/BoRegistrationWorkspace";
import { SurfaceWorkspace } from "@/app/components/workspace-adapters/SurfaceWorkspace";
import { createBoTddAdapter, type AuthenticatedSurfaceAdapter } from "@/lib/workspace-adapters";
import { browserTddNavigation, type AdapterNavigation } from "@/lib/workspace-adapters/navigation";
import { TddRegistry } from "@/lib/workspace-schema";
import { selfDefinition, selfFields, selfQuery, selfProvider, verifySelfWardrobeApproval } from "./schema";
import { SelfWardrobeDetail } from "./SelfWardrobeDetail";
import { SelfLoadoutDetail } from "./SelfLoadoutDetail";
import { loadAuthorizedDirectoryCenters, type DirectoryCenter, type DirectoryCenterSource } from "./centers";

import { SelfDirectoryProperties } from "./SharedProperties";

type F = typeof selfFields;
type Bound = { adapter: AuthenticatedSurfaceAdapter<F>; navigation: AdapterNavigation<F> };
// PAP-1447 / Epic PAP-1097: content-only TDD owns its nav metadata without a generic data adapter.
const selfDirectoryNavSource = {
  ...readApi,
  modules: {
    ...readApi.modules,
    "pinoria-avatars": { label: "Self Directory", group: "PINORIA", fields: [] },
  },
};
export function SelfDirectoryTdd(){
  const [centers,setCenters]=useState<readonly DirectoryCenter[]>([]);
  const [selected,setSelected]=useState("");
  const [centerSource,setCenterSource]=useState<DirectoryCenterSource>("centers");
  const [centerError,setCenterError]=useState("");
  const [ready,setReady]=useState<Bound|null>(null);
  const [error,setError]=useState("");
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    const ctl=new AbortController();
    void loadAuthorizedDirectoryCenters(fetch,ctl.signal)
      .then(({centers:rows,source})=>{
        if(ctl.signal.aborted)return;
        setCenters(rows);setCenterSource(source);setSelected(rows.length===1?rows[0].id:"");
        setCenterError(rows.length?"":"Không có cơ sở hoạt động được cấp quyền.");
      })
      .catch(e=>{if(!ctl.signal.aborted)setCenterError(e instanceof Error?e.message:"Không tải được cơ sở.");});
    return ()=>ctl.abort();
  },[]);
  useEffect(()=>{
    setReady(null);setError("");
    if(!selected)return;
    const ctl=new AbortController();let instance:AuthenticatedSurfaceAdapter<F>|null=null;
    void createBoTddAdapter({
      registry:new TddRegistry(verifySelfWardrobeApproval),definition:selfDefinition,provider:selfProvider,
      centerId:selected,centerSource,
    },ctl.signal).then(adapter=>{
      instance=adapter;
      if(ctl.signal.aborted){adapter.dispose();return;}
      setReady({adapter,navigation:browserTddNavigation("BO","pinoria-avatars",selfQuery)});
    }).catch(e=>{if(!ctl.signal.aborted)setError(e instanceof Error?e.message:"Không thể tải Self Directory.");});
    return ()=>{ctl.abort();instance?.dispose();};
  },[selected,centerSource,retry]);
  // PAP-1456 / Epic PAP-1097: PINO DS center selection and loading presentation.
  const content=!centers.length
    ? centerError ? <p role="alert">{centerError}</p> : <PresentationState state="loading"/>
    : <section aria-label="Danh bạ Pinoria Self" aria-busy={Boolean(selected && !ready && !error)}>
        <div className="tdd-self-center pds-property-section">
          <div className="pds-property-row">
            <label className="pds-property-label" htmlFor="self-directory-center">Cơ sở</label>
            <SingleSelect id="self-directory-center" label="Cơ sở" value={selected}
              onChange={setSelected} describedBy="pinoria-self-center-help" required
              options={centers.map(center=>({value:center.id,label:center.displayName}))}/>
          </div>
          <p className="pds-property-label" id="pinoria-self-center-help">Chọn cơ sở được cấp quyền để xem Self.</p>
        </div>
        {selected ? error ? <p role="alert">Không thể mở danh bạ được cấp quyền. <button type="button" onClick={()=>setRetry(n=>n+1)}>Thử lại</button></p>
          : ready ? <SurfaceWorkspace adapter={ready.adapter} navigation={ready.navigation} initialQuery={selfQuery} detailProperties={properties => <SelfDirectoryProperties fields={properties.fields} record={properties.record} sections={properties.sections}/>}
          detailApprovedExtension={(row,context,activeTab,_principalId,onSaved) =>
            activeTab === "loadout"
              ? <SelfLoadoutDetail key={selected + ":" + row.id} row={row} centerId={selected} activeTab={activeTab}
                  canView={context.authorize("pinoria.self.loadout.view")} canManage={context.authorize("pinoria.self.loadout.manage")}
                  canViewItems={context.authorize("pinoria.self.item.view")} onSaved={onSaved}/>
              : <SelfWardrobeDetail key={selected + ":" + row.id} row={row} centerId={selected} activeTab={activeTab}
                  canView={context.authorize("pinoria.self.item.view")} canManage={context.authorize("pinoria.self.item.manage")}
                  onSaved={onSaved} />}/>
          : <PresentationState state="loading"/>
          : <p role="status">Chọn cơ sở đã được cấp quyền để đọc danh bạ.</p>}
      </section>;
  return <BoRegistrationWorkspace source={selfDirectoryNavSource} moduleKey="pinoria-avatars" currentUser={{displayName:null}} content={content}/>;
}
