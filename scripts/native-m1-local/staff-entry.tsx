/** PAP-2345 / PLT-M1-DELIVERY: local-only presentation entry, never a live session. */
import {createRoot} from "react-dom/client";
import {parseStaffLocalRoute,staffLocalRouteSearch} from "@/app/ho/staff/staff-local-route-state";
import {createHoStaffReviewController,HoStaffReviewContent} from "@/app/ho/staff/StaffReviewContent";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import "../../public/ho-authority-source/ho-scoped.css";
import "../../app/components/workspace-renderer/tdd-detail-layout.css";
import "../../app/components/workspace-renderer/tdd-table-geometry.css";
import "../../app/components/workspace-renderer/tdd-freeze.css";
import "./staff-navigation.css";

const route="/ho/staff";
const origin=location.origin.toLowerCase();
const params=new URLSearchParams(location.search);
if(!["http://desktop-isrdren:8800","http://192.168.1.6:8800"].includes(origin)||location.pathname!==route||self.origin!=="null"||
  !parseStaffLocalRoute(params))throw Error("Local sandbox only");
const controller=createHoStaffReviewController({readParams:()=>new URLSearchParams(location.search),routeSearch:staffLocalRouteSearch});
createRoot(document.getElementById("root")!).render(<HoStaffReviewContent controller={controller}/>);
