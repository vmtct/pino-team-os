/** PAP-2153 / PNR-WORLD: canonical BO local review, no live data transport. */
import {createRoot} from "react-dom/client";
import {useState} from "react";
import {BoRegistrationWorkspace,type BoWorkspaceSource} from "@/app/bo/components/registration/BoRegistrationWorkspace";
import {unifiedBoWorkspaceSource} from "@/app/bo/architecture/bo-unified-workspace-source";
import {AvatarDirectoryDsa} from "@/app/bo/pinoria-avatars/AvatarDirectoryDsa";
import {avatarModule} from "@/app/bo/pinoria-avatars/avatar-dsa-model";
import {assertAvatarWorldReviewLocation,avatarWorldReviewRoute,avatarWorldReviewRecord,avatarWorldReviewScope,createAvatarWorldReview} from "@/app/bo/pinoria-avatars/avatar-world-m1-fixture";
import {SelfWorldTabContent} from "@/app/bo/pinoria-avatars/SelfWorldTabContent";
import {TddPreferencePolicy} from "@/app/components/workspace-renderer/Record";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import "../../public/bo-authority-source/bo-scoped.css";
import "../../app/bo/design-system/foundation.css";
import "../../app/components/workspace-renderer/tdd-detail-layout.css";
import "../../app/components/workspace-renderer/tdd-table-geometry.css";
import "../../app/components/workspace-renderer/tdd-freeze.css";
assertAvatarWorldReviewLocation(new URL(location.href),self.origin);
const source:BoWorkspaceSource={ephemeral:true,readOnly:true,modules:{...unifiedBoWorkspaceSource.modules,"pinoria-avatars":avatarModule},routeForModule:key=>key==="pinoria-avatars"?avatarWorldReviewRoute:"#unavailable-local-module",scopeLabel:()=> "M1 · Dữ liệu mẫu",load:async()=>{throw Error("No live transport");}};
function Review(){
 const [fixture]=useState(createAvatarWorldReview);
 const [state,setState]=useState(()=>fixture.read());
 const [instanceId,setInstanceId]=useState<string|null>(null);
 const [message,setMessage]=useState("");
 const content=<><p role="status">M1: Mô phỏng World, không lưu vào hệ thống.</p>{message&&<p role="status">{message}</p>}<SelfWorldTabContent scope={avatarWorldReviewScope} state={state} grants={fixture.grants} status="ready" busy={false} instanceId={instanceId} onOpen={setInstanceId} onBack={()=>setInstanceId(null)} onReload={()=>setState(fixture.read())} onConfirm={intent=>{try{setState(fixture.confirm(state,intent));setMessage("M1: Đã cập nhật mô phỏng.");}catch{setMessage("M1: Thao tác không hợp lệ.");}}}/></>;
 return <BoRegistrationWorkspace source={source} moduleKey="pinoria-avatars" currentUser={{displayName:"M1 · Dữ liệu mẫu"}} content={<AvatarDirectoryDsa review={{row:avatarWorldReviewRecord,centerId:avatarWorldReviewScope.centerId,worldContent:content}}/>}/>;
}
createRoot(document.getElementById("root")!).render(<TddPreferencePolicy.Provider value="ephemeral"><Review/></TddPreferencePolicy.Provider>);
