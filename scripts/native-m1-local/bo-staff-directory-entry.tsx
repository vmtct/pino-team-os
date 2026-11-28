/** PAP-2411 / WFM-STAFF: isolated canonical local presentation, not live authority. */
import {createRoot} from "react-dom/client";
import {BoLocalReviewCenter} from "@/app/bo/components/registration/BoCenterSelection";
import {STAFF_DIRECTORY_MOCK_ID} from "@/app/bo/workforce/staffs/staff-directory-m1-fixture";
import {createBoStaffReviewController,BoStaffReviewContent} from "@/app/bo/workforce/staffs/StaffDirectoryReviewContent";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import "../../public/bo-authority-source/bo-scoped.css";
import "../../app/bo/design-system/foundation.css";
import "../../app/components/workspace-renderer/tdd-detail-layout.css";
import "../../app/components/workspace-renderer/tdd-table-geometry.css";
import "../../app/components/workspace-renderer/tdd-freeze.css";
const route="/bo/workforce/staffs",centerId="STAFF-MOCK-CENTER",q=new URLSearchParams(location.search);
if(!["http://desktop-isrdren:8800","http://desktop-isrdren.tail3ee007.ts.net:8800"].includes(location.origin)||location.pathname!==route||self.origin!=="null"||[...q.keys()].some(k=>!['record','view','surface'].includes(k))||q.getAll("record").length>1||q.getAll("view").length>1||q.getAll("surface").length>1||(q.has("surface")&&(q.get("surface")!=="detail"||!q.has("record")||q.get("view")==="register"))||(q.has("record")&&q.get("record")!==STAFF_DIRECTORY_MOCK_ID)||(q.has("view")&&!['all','active','deactivated','register'].includes(q.get("view")!)))throw Error("Local sandbox only");
const controller=createBoStaffReviewController();
createRoot(document.getElementById("root")!).render(<BoLocalReviewCenter center={{id:centerId,displayName:"C\u1ea7n Th\u01a1 - M\u1eabu"}}><BoStaffReviewContent controller={controller} view={q.get("view")??"all"}/></BoLocalReviewCenter>);
