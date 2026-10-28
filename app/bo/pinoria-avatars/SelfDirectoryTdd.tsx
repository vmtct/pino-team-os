"use client";
import { useEffect, useState } from "react";
import readApi from "@/public/bo-authority-source/school-adapters.js";
import { BoRegistrationWorkspace } from "@/app/bo/components/registration/BoRegistrationWorkspace";
import { SurfaceWorkspace } from "@/app/components/workspace-adapters/SurfaceWorkspace";
import { createBoTddAdapter, type AuthenticatedSurfaceAdapter } from "@/lib/workspace-adapters";
import { browserTddNavigation, type AdapterNavigation } from "@/lib/workspace-adapters/navigation";
import { TddRegistry } from "@/lib/workspace-schema";
import { selfDefinition, selfFields, selfQuery } from "./schema";
import { selfDirectoryProvider } from "./provider";

type F = typeof selfFields;
type Bound = { adapter: AuthenticatedSurfaceAdapter<F>; navigation: AdapterNavigation<F> };
type Center = { id: string; displayName: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function asCenters(raw: unknown): Center[] {
  if (!raw || typeof raw !== "object" || !("data" in raw) || !Array.isArray(raw.data) || raw.data.length > 100) throw Error("Danh sách cơ sở không hợp lệ.");
  const list=raw.data as Record<string,unknown>[];
  if(list.some(c=>!c || typeof c.id!=="string" || !uuid.test(c.id) || typeof c.displayName!=="string" || !c.displayName.trim()))throw Error("Danh sách cơ sở không hợp lệ.");
  if(new Set(list.map(c=>c.id)).size!==list.length)throw Error("Cơ sở trùng ID.");
  return list.map(c=>({id:c.id as string,displayName:c.displayName as string}));
}
export function SelfDirectoryTdd(){
  const [centers,setCenters]=useState<Center[]>([]);
  const [selected,setSelected]=useState("");
  const [centerError,setCenterError]=useState("");
  const [ready,setReady]=useState<Bound|null>(null);
  const [error,setError]=useState("");
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    const ctl=new AbortController();
    void fetch("/api/bo/centers",{credentials:"same-origin",cache:"no-store",redirect:"error",signal:ctl.signal})
      .then(async response=>{if(!response.ok)throw Error(response.status===401?"Vui lòng đăng nhập lại.":"Không có quyền xem danh sách cơ sở.");return asCenters(await response.json());})
      .then(rows=>{if(!ctl.signal.aborted){setCenters(rows);setSelected(rows.length===1?rows[0].id:"");setCenterError(rows.length?"":"Không có cơ sở được cấp quyền.");}})
      .catch(e=>{if(!ctl.signal.aborted)setCenterError(e instanceof Error?e.message:"Không tải được cơ sở.");});
    return ()=>ctl.abort();
  },[]);
  useEffect(()=>{
    setReady(null);setError("");
    if(!selected)return;
    const ctl=new AbortController();let instance:AuthenticatedSurfaceAdapter<F>|null=null;
    void createBoTddAdapter({registry:new TddRegistry(),definition:selfDefinition,provider:selfDirectoryProvider(),centerId:selected},ctl.signal)
      .then(adapter=>{
        instance=adapter;
        if(ctl.signal.aborted){adapter.dispose();return;}
        setReady({adapter,navigation:browserTddNavigation("BO","pinoria-avatars",selfQuery)});
      }).catch(e=>{if(!ctl.signal.aborted)setError(e instanceof Error?e.message:"Không thể tải Self Directory.");});
    return ()=>{ctl.abort();instance?.dispose();};
  },[selected,retry]);
  const content=!centers.length
    ? <p role="status">{centerError||"Đang tải cơ sở…"}</p>
    : <section aria-label="Danh bạ Pinoria Self">
        <div className="tdd-self-center">
          <label htmlFor="self-directory-center">Cơ sở</label>{" "}
          <select id="self-directory-center" value={selected} onChange={e=>setSelected(e.target.value)}>
            <option value="">Chọn cơ sở</option>
            {centers.map(c=><option value={c.id} key={c.id}>{c.displayName}</option>)}
          </select>
          <p>Đọc theo quyền CENTER thực tế; hồ sơ thiếu Person/Self được giữ nguyên, không tự tạo.</p>
        </div>
        {selected ? error ? <p role="alert">Không thể mở danh bạ được cấp quyền. <button type="button" onClick={()=>setRetry(n=>n+1)}>Thử lại</button></p>
          : ready ? <SurfaceWorkspace adapter={ready.adapter} navigation={ready.navigation} initialQuery={selfQuery}/>
          : <p role="status">Đang xác minh quyền và tải danh bạ…</p> : <p role="status">Chọn một cơ sở đã được cấp quyền để đọc danh bạ.</p>}
      </section>;
  return <BoRegistrationWorkspace source={readApi} moduleKey="pinoria-avatars" currentUser={{displayName:null}} content={content}/>;
}
