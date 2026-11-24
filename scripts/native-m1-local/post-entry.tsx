/** PAP-2337 / PNR-APP-HUB — canonical sandbox presentation adapter only. */
import {createRoot} from "react-dom/client";
import {BoPostSubmitShell} from "@/app/bo/content/posts/BoPostSubmitShell";
import {HoPostApprovalShell} from "@/app/ho/content/post-approval/HoPostApprovalShell";
import {BoRegistrationWorkspace,type BoWorkspaceSource} from "@/app/bo/components/registration/BoRegistrationWorkspace";
import {TddPreferencePolicy} from "@/app/components/workspace-renderer/Record";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import "../../public/ho-authority-source/ho-scoped.css";
import "../../app/components/workspace-renderer/tdd-detail-layout.css";
import "../../app/components/workspace-renderer/tdd-table-geometry.css";
import "../../app/components/workspace-renderer/tdd-freeze.css";
const route=location.pathname,ho=route==="/ho/content/post-approval";
if(location.origin!=="http://192.168.1.6:8800"||self.origin!=="null"||(!ho&&route!=="/bo/piner-posts")||new URLSearchParams(location.search).get("m1Preview")!=="1")throw Error("Local sandbox only");
const key=ho?"postApproval":"piner-posts";
const source:BoWorkspaceSource={surface:ho?"ho":undefined,readOnly:true,ephemeral:true,modules:{[key]:{label:ho?"Duyệt bài đăng":"Bài đăng",group:"Content",fields:[]}},routeForModule:k=>k===key?route+"?m1Preview=1":"#unavailable-local-module",scopeLabel:()=>"",load:async()=>{throw Error("No live transport");}};
createRoot(document.getElementById("root")!).render(<BoRegistrationWorkspace source={source} moduleKey={key} currentUser={{displayName:"M1 · Dữ liệu mẫu"}} content={<TddPreferencePolicy.Provider value="ephemeral">{ho?<HoPostApprovalShell/>:<BoPostSubmitShell/>}</TddPreferencePolicy.Provider>}/>);
