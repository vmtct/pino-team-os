/** PAP-2192 / PLT-ACCESS — local synthetic presentation only, no session or transport. */
import {createRoot} from "react-dom/client";
import {BoRegistrationWorkspace,type BoWorkspaceSource} from "@/app/bo/components/registration/BoRegistrationWorkspace";
import {RoleM1Content} from "@/app/ho/system/roles/RoleM1Preview";
import type {BoAccessPermission} from "@/lib/bo-access-model";
import {hoModules} from "@/lib/ho-system";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import "../../public/ho-authority-source/ho-scoped.css";
import "../../app/components/workspace-renderer/tdd-detail-layout.css";
import "../../app/components/workspace-renderer/tdd-table-geometry.css";
import "../../app/components/workspace-renderer/tdd-freeze.css";
const route="/ho/system/roles";
if(location.origin!=="http://192.168.1.6:8800"||location.pathname!==route||new URLSearchParams(location.search).get("m1Preview")!=="1"||self.origin!=="null")throw Error("Local sandbox only");
// These are synthetic catalog examples, not live grants or a complete Core catalog.
type Example=BoAccessPermission & {applicablePlatforms:("BO"|"TOS")[]};
const example=(key:string,domain:string,displayLabel:string,surface:"BO"|"TOS",kind:"read"|"mutation",scope:Example["allowedScopes"]):Example=>({key:"fixture."+key,domain,displayLabel,description:"M1 synthetic example",accessKind:kind,surfaceApplicability:surface,applicablePlatforms:[surface],allowedScopes:scope,contextualPolicy:null});
const catalog=[
 example("student.view","Student","Xem học viên","BO","read",["CENTER"]),
 example("student.edit","Student","Chỉnh sửa học viên","BO","mutation",["CENTER"]),
 example("enrollment.view","Enrollment","Xem ghi danh","BO","read",["CENTER"]),
 example("schedule.view","Schedule","Xem lịch học","BO","read",["CENTER"]),
 example("class.view","Class","Xem lớp học","TOS","read",["RUNNING_CLASS"]),
 example("class.attendance","Class","Điểm danh","TOS","mutation",["RUNNING_CLASS"]),
 example("mission.view","Mission","Xem nhiệm vụ","TOS","read",["CENTER","PATH"]),
 example("mission.complete","Mission","Hoàn thành nhiệm vụ","TOS","mutation",["RUNNING_CLASS"]),
];
const source:BoWorkspaceSource={surface:"ho",readOnly:true,ephemeral:true,modules:hoModules,routeForModule:key=>key==="roles"?route+"?m1Preview=1":"#unavailable-local-module",scopeLabel:()=>"",load:async()=>{throw Error("No live transport");}};
createRoot(document.getElementById("root")!).render(<BoRegistrationWorkspace source={source} moduleKey="roles" currentUser={{displayName:"M1 · Dữ liệu mẫu"}} content={<RoleM1Content scopeKey="synthetic-presentation-only" permissionKeys={["access.role.view","access.role.create"]} localCatalog={catalog}/>}/>);
