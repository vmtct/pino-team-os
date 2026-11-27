/** PAP-1523 M1-A: canonical Person TDD with one synthetic record; no live data or auth. */
import {createRoot} from "react-dom/client";
import {HoPersonSupportFixtureWorkspace} from "@/app/ho/system/people/HoPersonSupportFixture";

import {SUPPORT_FIXTURE_ID} from "@/app/ho/system/people/person-support-preview";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import "../../public/ho-authority-source/ho-scoped.css";
import "../../app/ho/ho-theme.css";
import "../../app/components/workspace-renderer/tdd-detail-layout.css";
import "../../app/components/workspace-renderer/tdd-table-geometry.css";
import "../../app/components/workspace-renderer/tdd-freeze.css";
const route="/ho/system/people", query=new URLSearchParams(location.search);
const record=query.get("record");
if(location.origin!=="http://desktop-isrdren:8800"||location.pathname!==route||self.origin!=="null"||location.hash||[...query.keys()].some(k=>k!=="record")||query.getAll("record").length>1||(record!==null&&record!==SUPPORT_FIXTURE_ID))throw Error("Local sandbox only");
createRoot(document.getElementById("root")!).render(<HoPersonSupportFixtureWorkspace/>);
