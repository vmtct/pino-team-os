/** PAP-2192 / PLT-ACCESS — local synthetic presentation only, no session or transport. */
import {createRoot} from "react-dom/client";
import {BoRegistrationWorkspace,type BoWorkspaceSource} from "@/app/bo/components/registration/BoRegistrationWorkspace";
import {RoleM1Content} from "@/app/ho/system/roles/RoleM1Preview";
import {hoModules} from "@/lib/ho-system";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import "../../public/ho-authority-source/ho-scoped.css";
import "../../app/components/workspace-renderer/tdd-detail-layout.css";
import "../../app/components/workspace-renderer/tdd-table-geometry.css";
import "../../app/components/workspace-renderer/tdd-freeze.css";
const route="/ho/system/roles";
if(location.origin!=="http://192.168.1.6:8800"||location.pathname!==route||new URLSearchParams(location.search).get("m1Preview")!=="1"||self.origin!=="null")throw Error("Local sandbox only");
const source:BoWorkspaceSource={surface:"ho",readOnly:true,ephemeral:true,modules:hoModules,routeForModule:key=>key==="roles"?route+"?m1Preview=1":"#unavailable-local-module",scopeLabel:()=>"",load:async()=>{throw Error("No live transport");}};
createRoot(document.getElementById("root")!).render(<BoRegistrationWorkspace source={source} moduleKey="roles" currentUser={{displayName:"M1 · Dữ liệu mẫu"}} content={<RoleM1Content scopeKey="synthetic-presentation-only" permissionKeys={["access.role.view","access.role.create","access.role.edit"]}/>}/>);
