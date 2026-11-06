"use client";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import { useEffect, useState } from "react";
import { HoWorkspace } from "@/app/ho/HoWorkspace";
import { SurfaceWorkspace } from "@/app/components/workspace-adapters/SurfaceWorkspace";
import { createHoTddAdapter, type AuthenticatedSurfaceAdapter } from "@/lib/workspace-adapters";
import { browserTddNavigation, type AdapterNavigation } from "@/lib/workspace-adapters/navigation";
import { TddRegistry } from "@/lib/workspace-schema";
import { BoApiError } from "@/lib/bo-api-error";
import { HoSpecialtyMissionsTab } from "./HoSpecialtyMissionsTab";
import { specialtyDefinition, specialtyFields, specialtyProvider, specialtyQuery, verifySpecialtyExtension } from "./schema";

type F = typeof specialtyFields;
type Ready = {adapter:AuthenticatedSurfaceAdapter<F>;navigation:AdapterNavigation<F>};
const rejectWrite = async (): Promise<never> => { throw new Error("SPECIALTY_WRITER_UNAVAILABLE"); };

/** PAP-1495: one HO host, standard TDD/property grid, read-only until V2 readback. */
export function HoSpecialties() {
  const [ready,setReady]=useState<Ready|null>(null);
  const [error,setError]=useState("");
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    let adapter:AuthenticatedSurfaceAdapter<F>|null=null;
    void createHoTddAdapter({registry:new TddRegistry(verifySpecialtyExtension),
      definition:specialtyDefinition,provider:specialtyProvider},controller.signal).then(result=>{
        adapter=result;
        if(controller.signal.aborted){result.dispose();return;}
        setReady({adapter:result,navigation:browserTddNavigation("HO","specialties",specialtyQuery)});
      }).catch(error=>{if(!controller.signal.aborted)setError(error instanceof BoApiError && [401,403].includes(error.status)
        ?"Bạn không có quyền xem Chuyên đề.":"Chưa tải được danh mục Chuyên đề.");});
    return ()=>{controller.abort();adapter?.dispose();};
  },[retry]);
  const content=error?<p role="alert">{error} <button type="button" onClick={()=>{setReady(null);setError("");setRetry(n=>n+1);}}>Thử lại</button></p>
    :ready?<SurfaceWorkspace adapter={ready.adapter} navigation={ready.navigation} initialQuery={specialtyQuery}
      detailApprovedExtension={(_row,_context,tab)=>tab==="missions"?<>
        <p role="status">Chưa tải được nhiệm vụ liên kết.</p>
        <HoSpecialtyMissionsTab pathProgramId="" levels={[]} missionCatalog={[]} disabled
          onLink={rejectWrite} onUnlink={rejectWrite} onOpenMission={()=>{}} />
      </>:null}/>:<p role="status">Đang tải Chuyên đề…</p>;
  return <HoWorkspace module="specialties" content={content}/>;
}
