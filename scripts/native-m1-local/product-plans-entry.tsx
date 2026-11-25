/** PAP-2183 / PLT-PRODUCT-PLAN — local synthetic presentation, no live transport. */
import {createRoot} from "react-dom/client";
import {BoRegistrationWorkspace,type BoWorkspaceSource} from "@/app/bo/components/registration/BoRegistrationWorkspace";
import {ProductPlanM1Content} from "@/app/ho/billing/product-plans/ProductPlanM1Content";
import {PLAN_READ,PLAN_EDIT} from "@/app/ho/billing/product-plans/schema";
import {hoModules} from "@/lib/ho-system";
import {PRODUCT_PLAN_REVIEW_PATH,parseProductPlanReviewQuery,isProductPlanLocalOrigin} from "@/app/ho/billing/product-plans/product-plan-m1-preview";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import "../../public/ho-authority-source/ho-scoped.css";
import "../../app/components/workspace-renderer/tdd-detail-layout.css";
import "../../app/components/workspace-renderer/tdd-table-geometry.css";
import "../../app/components/workspace-renderer/tdd-freeze.css";
const route=PRODUCT_PLAN_REVIEW_PATH;
const query=parseProductPlanReviewQuery(new URLSearchParams(location.search));
if(!isProductPlanLocalOrigin(location.origin)||location.pathname!==route||!query||self.origin!=="null")throw Error("Local sandbox only");
const source:BoWorkspaceSource={surface:"ho",readOnly:true,ephemeral:true,modules:hoModules,routeForModule:key=>key==="productPlans"?route:"#unavailable-local-module",scopeLabel:()=>"",load:async()=>{throw Error("No live transport");}};
createRoot(document.getElementById("root")!).render(<BoRegistrationWorkspace source={source} moduleKey="productPlans" currentUser={{displayName:"M1 · Dữ liệu mẫu"}} content={<ProductPlanM1Content scopeKey="synthetic-presentation-only" permissionKeys={[PLAN_READ,PLAN_EDIT]} initialRecord={query.record}/>}/>);
