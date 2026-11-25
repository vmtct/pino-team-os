/** PAP-2369 / SCH-LEARNING-SPACE — local synthetic presentation, no live transport. */
import {createRoot} from "react-dom/client";
import {BoRegistrationWorkspace,type BoWorkspaceSource} from "@/app/bo/components/registration/BoRegistrationWorkspace";
import {LearningSpaceM1Content} from "@/app/ho/learning-spaces/LearningSpaceM1Content";
import {SPACE_READ,SPACE_EDIT} from "@/app/ho/learning-spaces/schema";
import {hoModules} from "@/lib/ho-system";
import {SPACE_PATH,parseSpaceReviewQuery} from "@/app/ho/learning-spaces/learning-space-m1-preview";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import "../../../public/ho-authority-source/ho-scoped.css";
import "../../components/workspace-renderer/tdd-detail-layout.css";
import "../../components/workspace-renderer/tdd-table-geometry.css";
import "../../components/workspace-renderer/tdd-freeze.css";
const query=parseSpaceReviewQuery(new URLSearchParams(location.search));
if(!["http://desktop-isrdren:8800","http://desktop-isrdren.tail3ee007.ts.net:8800"].includes(location.origin)||location.pathname!==SPACE_PATH||!query||self.origin!=="null")throw Error("Local sandbox only");
const source:BoWorkspaceSource={surface:"ho",readOnly:true,ephemeral:true,modules:{...hoModules,learningSpaces:{label:"Không gian học",group:"Learning",fields:[]}},routeForModule:key=>key==="learningSpaces"?SPACE_PATH:"#unavailable-local-module",scopeLabel:()=>"",load:async()=>{throw Error("No live transport");}};
createRoot(document.getElementById("root")!).render(<BoRegistrationWorkspace source={source} moduleKey="learningSpaces" currentUser={{displayName:"M1 · Dữ liệu mẫu"}} content={<LearningSpaceM1Content scopeKey="synthetic-presentation-only" permissionKeys={[SPACE_READ,SPACE_EDIT]} initialRecord={query.record}/>}/>);
