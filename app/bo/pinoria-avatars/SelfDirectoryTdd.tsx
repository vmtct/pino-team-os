"use client";
import { useEffect, useState } from "react";
import readApi from "@/public/bo-authority-source/school-adapters.js";
import { BoRegistrationWorkspace } from "@/app/bo/components/registration/BoRegistrationWorkspace";
import { SurfaceWorkspace } from "@/app/components/workspace-adapters/SurfaceWorkspace";
import { createBoTddAdapter, type AuthenticatedSurfaceAdapter } from "@/lib/workspace-adapters";
import { browserTddNavigation, type AdapterNavigation } from "@/lib/workspace-adapters/navigation";
import { TddRegistry } from "@/lib/workspace-schema";
import { selfDefinition, selfFields, selfQuery, selfProvider } from "./schema";
import { loadAuthorizedDirectoryCenters, type DirectoryCenter, type DirectoryCenterSource } from "./centers";

type F = typeof selfFields;
type Bound = { adapter: AuthenticatedSurfaceAdapter<F>; navigation: AdapterNavigation<F> };
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
      registry:new TddRegistry(),definition:selfDefinition,provider:selfProvider,
      centerId:selected,centerSource,
    },ctl.signal).then(adapter=>{
      instance=adapter;
      if(ctl.signal.aborted){adapter.dispose();return;}
      setReady({adapter,navigation:browserTddNavigation("BO","pinoria-avatars",selfQuery)});
    }).catch(e=>{if(!ctl.signal.aborted)setError(e instanceof Error?e.message:"Không thể tải Self Directory.");});
    return ()=>{ctl.abort();instance?.dispose();};
  },[selected,centerSource,retry]);
  const content=!centers.length
    ? <p role="status">{centerError||"Đang tải cơ sở…"}</p>
    : <section aria-label="Danh bạ Pinoria Self">
        <div className="tdd-self-center">
          <label htmlFor="self-directory-center">Cơ sở</label>{" "}
          <select id="self-directory-center" value={selected} onChange={e=>setSelected(e.target.value)}>
            <option value="">Chọn cơ sở</option>
            {centers.map(c=><option value={c.id} key={c.id}>{c.displayName}</option>)}
          </select>
          <p>Chọn cơ sở đã được cấp quyền. Việc đọc Pinoria Self vẫn yêu cầu quyền riêng từ Core.</p>
        </div>
        {selected ? error ? <p role="alert">Không thể mở danh bạ được cấp quyền. <button type="button" onClick={()=>setRetry(n=>n+1)}>Thử lại</button></p>
          : ready ? <SurfaceWorkspace adapter={ready.adapter} navigation={ready.navigation} initialQuery={selfQuery}/>
          : <p role="status">Đang xác minh quyền và tải danh bạ…</p>
          : <p role="status">Chọn cơ sở đã được cấp quyền để đọc danh bạ.</p>}
      </section>;
  return <BoRegistrationWorkspace source={readApi} moduleKey="pinoria-avatars" currentUser={{displayName:null}} content={content}/>;
}
