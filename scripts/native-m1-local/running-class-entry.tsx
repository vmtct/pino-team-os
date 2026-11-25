/** PLT-DELIVERY / PAP-1037 / PAP-2225 — canonical local presentation only. */
import {createRoot} from "react-dom/client";
import {BoRegistrationWorkspace,type BoWorkspaceSource} from "@/app/bo/components/registration/BoRegistrationWorkspace";
import {BoLocalReviewCenter} from "@/app/bo/components/registration/BoCenterSelection";
import school from "@/public/bo-authority-source/school-adapters.js";
import {createRunningClassReview} from "@/app/bo/running-classes/running-class-review";
import {classTableModule,RUNNING_CLASS_MOCK_ID} from "@/app/bo/running-classes/running-class-presentation";
import {TddPreferencePolicy} from "@/app/components/workspace-renderer/Record";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import "../../public/bo-authority-source/bo-scoped.css";
import "../../app/bo/design-system/foundation.css";
import "../../app/components/workspace-renderer/tdd-detail-layout.css";
import "../../app/components/workspace-renderer/tdd-table-geometry.css";
import "../../app/components/workspace-renderer/tdd-freeze.css";
const route="/bo/running-classes",q=new URLSearchParams(location.search);
if(!["http://desktop-isrdren:8800","http://desktop-isrdren.tail3ee007.ts.net:8800"].includes(location.origin)
 ||location.pathname!==route||self.origin!=="null"||[...q.keys()].some(k=>k!=="record")
 ||q.getAll("record").length>1||(q.has("record")&&q.get("record")!==RUNNING_CLASS_MOCK_ID))throw Error("Local sandbox only");
const review=createRunningClassReview();
const source:BoWorkspaceSource={
  ephemeral:true,modules:{...school.modules,classes:classTableModule(school.modules.classes)},runningClassReview:review,
  routeForModule:key=>key==="classes"?route:"#unavailable-local-module",
  scopeLabel:()=>"M1 · Dữ liệu mẫu — không ghi vào hệ thống",
  load:async key=>{if(key!=="classes")throw Error("Local module only");return review.list();}
};
createRoot(document.getElementById("root")!).render(<TddPreferencePolicy.Provider value="ephemeral">
  <BoLocalReviewCenter center={review.catalog.centers[0]!}><BoRegistrationWorkspace source={source} moduleKey="classes" currentUser={{displayName:"M1 · Dữ liệu mẫu"}}/></BoLocalReviewCenter>
</TddPreferencePolicy.Provider>);
