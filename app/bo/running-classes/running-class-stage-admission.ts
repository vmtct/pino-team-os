/** PAP-2225 — one server-owned phase, no browser/query opt-in. */
import {RC_REVIEW_PATH,parseRunningClassReviewQuery} from "./running-class-review-query";
export const RUNNING_CLASS_LIVE_ADMISSION=true;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const tracking=["utm_source","utm_medium","utm_campaign","utm_term","utm_content"];
export function parseRunningClassLiveQuery(input:URLSearchParams,legacy=false):string|null{
 const p=new URLSearchParams(input);
 if(legacy){if(p.getAll("module").length!==1||p.get("module")!=="classes")return null;p.delete("module");}
 for(const k of tracking)p.delete(k);
 for(const k of p.keys())if(p.getAll(k).length!==1||!["centerId","record"].includes(k)||!uuid.test(p.get(k)??""))return null;
 const out=new URLSearchParams();
 for(const k of ["centerId","record"])if(p.has(k))out.set(k,p.get(k)!);
 return RC_REVIEW_PATH+(out.size?"?"+out.toString():"");
}
export function parseRunningClassStageQuery(input:URLSearchParams,legacy=false):string|null{
 return RUNNING_CLASS_LIVE_ADMISSION?parseRunningClassLiveQuery(input,legacy):parseRunningClassReviewQuery(input,legacy);
}
