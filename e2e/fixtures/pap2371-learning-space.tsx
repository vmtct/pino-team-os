/** PAP-2371: isolated synthetic browser test only; no product route or real session. */
import {createRoot} from "react-dom/client";
import {LearningSpaceM1Content} from "../../app/ho/learning-spaces/LearningSpaceM1Content";
const q=new URLSearchParams(location.search);
if(location.origin!=="https://learning-space-test.invalid")throw Error("Synthetic test origin only");
createRoot(document.getElementById("root")!).render(<LearningSpaceM1Content scopeKey="isolated-test" permissionKeys={q.has("denied")?[]:["delivery.schedule.manage"]} initialRecord={q.get("record")??undefined} writesEnabled={!q.has("readonly")}/>);
