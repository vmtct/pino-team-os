/** PAP-2153 / PNR-WORLD: canonical BO local review, no live data transport. */
import {createRoot} from "react-dom/client";
import {BoRegistrationWorkspace,type BoWorkspaceSource} from "@/app/bo/components/registration/BoRegistrationWorkspace";
import {unifiedBoWorkspaceSource} from "@/app/bo/architecture/bo-unified-workspace-source";
import {AvatarWorldReview} from "@/app/bo/pinoria-avatars/AvatarWorldReview";
import {avatarModule} from "@/app/bo/pinoria-avatars/avatar-dsa-model";
import {assertAvatarWorldReviewLocation,avatarWorldReviewRoute} from "@/app/bo/pinoria-avatars/avatar-world-m1-fixture";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import "../../public/bo-authority-source/bo-scoped.css";
import "../../app/bo/design-system/foundation.css";
import "../../app/components/workspace-renderer/tdd-detail-layout.css";
import "../../app/components/workspace-renderer/tdd-table-geometry.css";
import "../../app/components/workspace-renderer/tdd-freeze.css";
assertAvatarWorldReviewLocation(new URL(location.href),self.origin);
const source:BoWorkspaceSource={ephemeral:true,readOnly:true,modules:{...unifiedBoWorkspaceSource.modules,"pinoria-avatars":avatarModule},routeForModule:key=>key==="pinoria-avatars"?avatarWorldReviewRoute:"#unavailable-local-module",scopeLabel:()=> "M1 · Dữ liệu mẫu",load:async()=>{throw Error("No live transport");}};
createRoot(document.getElementById("root")!).render(<BoRegistrationWorkspace source={source} moduleKey="pinoria-avatars" currentUser={{displayName:"M1 · Dữ liệu mẫu"}} content={<AvatarWorldReview/>}/>);
