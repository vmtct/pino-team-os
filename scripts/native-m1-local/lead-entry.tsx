/** PAP-2286 / PLT-LEAD: canonical i5, synthetic presentation only. */
import {createRoot} from "react-dom/client";
import {BoRegistrationWorkspace,type BoWorkspaceSource} from "@/app/bo/components/registration/BoRegistrationWorkspace";
import {LeadHouseholdM1Preview} from "@/app/bo/sales/leads/LeadHouseholdM1Preview";
import {TddPreferencePolicy} from "@/app/components/workspace-renderer/Record";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import "../../public/bo-authority-source/bo-scoped.css";
import "../../app/bo/design-system/foundation.css";
import "../../app/components/workspace-renderer/tdd-detail-layout.css";
import "../../app/components/workspace-renderer/tdd-table-geometry.css";
import "../../app/components/workspace-renderer/tdd-freeze.css";

const route="/bo/sales/leads";
if(location.origin!=="http://192.168.1.6:8800"||location.pathname!==route||new URLSearchParams(location.search).get("m1Preview")!=="1"||self.origin!=="null")throw Error("Local sandbox only");
const source:BoWorkspaceSource={
  readOnly:true,ephemeral:true,
  modules:{"sales/leads":{label:"Leads",group:"Operations",fields:[]}},
  routeForModule:key=>key==="sales/leads"?route+"?m1Preview=1":"#unavailable-local-module",
  scopeLabel:()=>"",
  load:async()=>{throw Error("No live transport");}
};
createRoot(document.getElementById("root")!).render(
  <BoRegistrationWorkspace source={source} moduleKey="sales/leads" currentUser={{displayName:"M1 · Dữ liệu mẫu"}}
    content={<TddPreferencePolicy.Provider value="ephemeral"><LeadHouseholdM1Preview/></TddPreferencePolicy.Provider>}/>
);
