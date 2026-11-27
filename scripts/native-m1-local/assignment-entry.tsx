/** PAP-2425 / MISSION-ASSIGNMENT — isolated canonical local native review. */
import {createRoot} from "react-dom/client";
import {BoRegistrationWorkspace,type BoWorkspaceSource} from "@/app/bo/components/registration/BoRegistrationWorkspace";
import {unifiedBoWorkspaceSource} from "@/app/bo/architecture/bo-unified-workspace-source";
import {MissionAssignmentM1} from "@/app/bo/missions/MissionAssignmentM1";
import {ASSIGNMENT_M1_ID,ASSIGNMENT_M1_ROUTE} from "@/app/bo/missions/assignment-m1-fixture";
import {TddPreferencePolicy} from "@/app/components/workspace-renderer/Record";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import "../../public/bo-authority-source/bo-scoped.css";
import "../../app/bo/design-system/foundation.css";
import "../../app/components/workspace-renderer/tdd-detail-layout.css";
import "../../app/components/workspace-renderer/tdd-table-geometry.css";
import "../../app/components/workspace-renderer/tdd-freeze.css";
const route=ASSIGNMENT_M1_ROUTE,q=new URLSearchParams(location.search);
if(location.origin!=="http://desktop-isrdren:8800"||location.pathname!==route||self.origin!=="null"||[...q.keys()].some(k=>k!=="record")||q.getAll("record").length>1||(q.has("record")&&q.get("record")!==ASSIGNMENT_M1_ID))throw Error("Local sandbox only");
const source:BoWorkspaceSource={ephemeral:true,readOnly:true,modules:unifiedBoWorkspaceSource.modules,routeForModule:key=>key==="missions"?route:"#unavailable-local-module",scopeLabel:()=>"M1 · Dữ liệu mẫu",load:async()=>{throw Error("No live transport");}};
const record=q.get("record")??undefined;
createRoot(document.getElementById("root")!).render(<TddPreferencePolicy.Provider value="ephemeral"><BoRegistrationWorkspace source={source} moduleKey="missions" currentUser={{displayName:"M1 · Dữ liệu mẫu"}} content={<MissionAssignmentM1 initialRecord={record}/>}/></TddPreferencePolicy.Provider>);
