"use client";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import { useEffect,useState } from "react";
import { BoRegistrationWorkspace,type BoWorkspaceSource } from "@/app/bo/components/registration/BoRegistrationWorkspace";
import { SurfaceWorkspace } from "@/app/components/workspace-adapters/SurfaceWorkspace";
import { createHoTddAdapter,type AuthenticatedSurfaceAdapter } from "@/lib/workspace-adapters";
import { browserTddNavigation,type AdapterNavigation } from "@/lib/workspace-adapters/navigation";
import { TddRegistry } from "@/lib/workspace-schema";
import { hoModules,hoRoutes,type HoModule } from "@/lib/ho-system";
import { atlasDefinition,atlasProvider,atlasMemoryTransport,atlasQuery,atlasCoverage,atlasGaps,atlasScenarios,configureAtlas,type AtlasFields,type AtlasScenario } from "./schema";
import { demoForm,demoLoaders,resetDemoForm } from "./content";
const source: BoWorkspaceSource={surface:"ho",readOnly:true,ephemeral:true,modules:hoModules,routeForModule:key=>hoRoutes[key as HoModule],scopeLabel:()=>"",load:async()=>{throw Error("Atlas generic load forbidden");}};
type Ready={adapter:AuthenticatedSurfaceAdapter<AtlasFields>;navigation:AdapterNavigation<AtlasFields>};
export function ReferenceAtlas(){
 const [scenario,setScenario]=useState<AtlasScenario>("populated"),[revision,setRevision]=useState(0),[ready,setReady]=useState<Ready|null>(null),[error,setError]=useState(false);
 useEffect(()=>{const controller=new AbortController();let owned:AuthenticatedSurfaceAdapter<AtlasFields>|null=null;configureAtlas(scenario);resetDemoForm();
  void createHoTddAdapter({registry:new TddRegistry(),definition:atlasDefinition,provider:atlasProvider,fetcher:atlasMemoryTransport},controller.signal).then(adapter=>{owned=adapter;if(controller.signal.aborted){adapter.dispose();return;}setReady({adapter,navigation:browserTddNavigation("HO","tddReference",atlasQuery)});}).catch(()=>{if(!controller.signal.aborted)setError(true);});
  return ()=>{controller.abort();owned?.dispose();};
 },[scenario,revision]);
 const reset=(next:AtlasScenario)=>{ready?.navigation.change({kind:"table",tab:"overview",query:atlasQuery},true);setReady(null);setError(false);setScenario(next);setRevision(x=>x+1);};
 const content=<><section aria-label="TDD demo controls" className="v24-prop-section"><h2>TDD Reference — SYNTHETIC DEMO</h2><p role="note">Mọi bản ghi, quyền, audit và trạng thái Lưu/Đang lưu/Thành công bên dưới đều là MÔ PHỎNG trong RAM. Không kết nối Core, không lưu backend hoặc browser storage; reload/reset xóa thay đổi.</p><label>Kịch bản mô phỏng <select className="edit-input" value={scenario} onChange={e=>reset(e.target.value as AtlasScenario)}>{atlasScenarios.map(value=><option key={value} value={value}>{value}</option>)}</select></label><button className="secondary-btn" type="button" onClick={()=>reset("populated")}>Reset demo</button><details><summary>Coverage và giới hạn</summary><p>{new Set(atlasCoverage.map(x=>x.kind)).size}/16 registered field kinds · tất cả chỉ dữ liệu giả lập.</p><ul>{atlasGaps.map(gap=><li key={gap}>{gap}</li>)}</ul></details></section>
 {error?<p role="alert">Không khởi tạo được demo. <button type="button" onClick={()=>reset(scenario)}>Thử lại demo</button></p>:ready?<SurfaceWorkspace adapter={ready.adapter} navigation={ready.navigation} initialQuery={atlasQuery} businessForms={[demoForm]} businessLoaders={demoLoaders}/>:<p role="status">Đang khởi tạo demo…</p>}</>;
 return <BoRegistrationWorkspace source={source} moduleKey="tddReference" currentUser={{displayName:"SYNTHETIC DEMO"}} content={content}/>;
}
