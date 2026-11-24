/** PAP-2183 / PLT-PRODUCT-PLAN — local synthetic presentation, no live transport. */
import {createRoot} from "react-dom/client";
import {BoRegistrationWorkspace,type BoWorkspaceSource} from "@/app/bo/components/registration/BoRegistrationWorkspace";
import {ProductPlanM1Content} from "@/app/ho/billing/product-plans/ProductPlanM1Content";
import {PLAN_READ,PLAN_EDIT} from "@/app/ho/billing/product-plans/schema";
import {hoModules} from "@/lib/ho-system";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import "../../public/ho-authority-source/ho-scoped.css";
import "../../app/components/workspace-renderer/tdd-detail-layout.css";
import "../../app/components/workspace-renderer/tdd-table-geometry.css";
import "../../app/components/workspace-renderer/tdd-freeze.css";
const route="/ho/billing/product-plans";
const query=new URLSearchParams(location.search);
if(location.origin!=="http://192.168.1.6:8800"||location.pathname!==route||query.get("m1Preview")!=="1"||self.origin!=="null")throw Error("Local sandbox only");
const source:BoWorkspaceSource={surface:"ho",readOnly:true,ephemeral:true,modules:hoModules,routeForModule:key=>key==="productPlans"?route+"?m1Preview=1":"#unavailable-local-module",scopeLabel:()=>"",load:async()=>{throw Error("No live transport");}};
createRoot(document.getElementById("root")!).render(<BoRegistrationWorkspace source={source} moduleKey="productPlans" currentUser={{displayName:"M1 · Dữ liệu mẫu"}} content={<ProductPlanM1Content scopeKey="synthetic-presentation-only" permissionKeys={[PLAN_READ,PLAN_EDIT]} initialRecord={query.get("record")??undefined}/>}/>);
