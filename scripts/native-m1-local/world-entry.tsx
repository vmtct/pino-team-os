/** PAP-2143 / PNR-WORLD: native activation-only M1, isolated synthetic state. */
import {createRoot} from "react-dom/client";
import {BoRegistrationWorkspace,type BoWorkspaceSource} from "@/app/bo/components/registration/BoRegistrationWorkspace";
import {HoWorldCatalog,type WorldPreviewBoundary} from "@/app/ho/pinoria/worlds/HoWorldCatalog";
import {createWorldActivationFixture,WORLD_M1_ID,WORLD_M1_ROUTE,WORLD_M1_MARKER} from "@/app/ho/pinoria/worlds/world-activation-m1-fixture";
import {TddPreferencePolicy} from "@/app/components/workspace-renderer/Record";
import {hoModules} from "@/lib/ho-system";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import "../../public/ho-authority-source/ho-scoped.css";
import "../../app/ho/ho-theme.css";
import "../../app/components/workspace-renderer/tdd-detail-layout.css";
import "../../app/components/workspace-renderer/tdd-table-geometry.css";
import "../../app/components/workspace-renderer/tdd-freeze.css";
const tabs=["overview","scenes","preview","history"];
function readRef(){
 const url=new URL(location.href),q=url.searchParams,record=q.get("record"),surface=q.get("surface"),tab=q.get("tab");
 if(url.origin!=="http://desktop-isrdren:8800"||url.pathname!==WORLD_M1_ROUTE||self.origin!=="null"||url.hash||
 [...q.keys()].some(k=>!["record","surface","tab"].includes(k)||q.getAll(k).length!==1)||
 (record!==null&&record!==WORLD_M1_MARKER)||(surface!==null&&(record!==WORLD_M1_MARKER||surface!=="detail"))||
 (tab!==null&&(surface!=="detail"||!tabs.includes(tab))))throw Error("Local sandbox only");
 return {id:record?WORLD_M1_ID:null,tab:surface==="detail"?tab??"overview":null};
}
readRef();
const boundary:WorldPreviewBoundary={transport:createWorldActivationFixture(),readRef,writeRef(id,tab,push=false){
 if((id!==null&&id!==WORLD_M1_ID)||(tab!==undefined&&(id!==WORLD_M1_ID||!tabs.includes(tab))))throw Error("Invalid local World reference");
 const q=new URLSearchParams();if(id)q.set("record",WORLD_M1_MARKER);if(tab){q.set("surface","detail");q.set("tab",tab);}
 const next=WORLD_M1_ROUTE+(q.size?"?"+q.toString():"");if(push)history.pushState(null,"",next);else history.replaceState(null,"",next);
}};
const source:BoWorkspaceSource={surface:"ho",readOnly:true,ephemeral:true,modules:hoModules,routeForModule:key=>key==="worlds"?WORLD_M1_ROUTE:"#unavailable-local-module",scopeLabel:()=>"",load:async()=>{throw Error("No live transport");}};
createRoot(document.getElementById("root")!).render(<BoRegistrationWorkspace source={source} moduleKey="worlds" currentUser={{displayName:"M1 · Dữ liệu mẫu"}} content={<><p role="status">M1 · Mô phỏng kích hoạt World, không lưu vào hệ thống.</p><TddPreferencePolicy.Provider value="ephemeral"><HoWorldCatalog canManage preview={boundary}/></TddPreferencePolicy.Provider></>}/>);
