import {headers} from "next/headers";
import {OpenStudioView} from "./OpenStudioView";
import {BoOpenStudioPassTdd} from "./BoOpenStudioPassTdd";
/** PAP-1224: staging BO uses canonical typed Pass TDD; preserve existing Production operations. */
export default async function OpenStudioPage(){
 const host=(await headers()).get("host")?.toLowerCase().replace(/:\\d+$/,"")??"";
 return host==="bo.staging.pinohouse.art"?<BoOpenStudioPassTdd/>:<OpenStudioView/>;
}
