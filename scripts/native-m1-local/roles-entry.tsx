/** PAP-2408 / PLT-ACCESS — exact native Role UI, isolated in-memory local boundary. */
import {useState} from "react";
import {createRoot} from "react-dom/client";
import {BoRegistrationWorkspace,type BoWorkspaceSource} from "@/app/bo/components/registration/BoRegistrationWorkspace";
import {ReadyRoles} from "@/app/ho/system/roles/HoRolesTdd";
import {createNativeRolePreview,ROLE_LOCAL_MARKER,ROLE_LOCAL_ROUTE} from "@/app/ho/system/roles/role-native-preview-boundary";
import {TddPreferencePolicy} from "@/app/components/workspace-renderer/Record";
import {hoModules} from "@/lib/ho-system";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import "../../public/ho-authority-source/ho-scoped.css";
import "../../app/ho/ho-theme.css";
import "../../app/components/workspace-renderer/tdd-detail-layout.css";
import "../../app/components/workspace-renderer/tdd-table-geometry.css";
import "../../app/components/workspace-renderer/tdd-freeze.css";
const route=ROLE_LOCAL_ROUTE, query=new URLSearchParams(location.search),record=query.get("record");
if(location.origin!=="http://desktop-isrdren:8800"||location.pathname!==route||self.origin!=="null"||[...query.keys()].some(k=>k!=="record")||query.getAll("record").length>1||(record!==null&&record!==ROLE_LOCAL_MARKER))throw Error("Local sandbox only");
const source:BoWorkspaceSource={surface:"ho",readOnly:true,ephemeral:true,modules:hoModules,routeForModule:key=>key==="roles"?route:"#unavailable-local-module",scopeLabel:()=>"",load:async()=>{throw Error("No live transport");}};
const boundary=createNativeRolePreview(record!==null);
function Preview(){const [generation,setGeneration]=useState(0);return <><p role="status">M1 · Dữ liệu mô phỏng, không lưu vào hệ thống.</p><TddPreferencePolicy.Provider value="ephemeral"><ReadyRoles key={generation} ready={boundary.ready} nativeLifecycle transport={boundary.transport} submitCreate={boundary.submitCreate} onVerified={()=>setGeneration(n=>n+1)}/></TddPreferencePolicy.Provider></>;}
createRoot(document.getElementById("root")!).render(<BoRegistrationWorkspace source={source} moduleKey="roles" currentUser={{displayName:"M1 · Dữ liệu mẫu"}} content={<Preview/>}/>);
