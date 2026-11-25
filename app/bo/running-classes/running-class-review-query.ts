/** PLT-DELIVERY / PAP-2225 / PAP-2359: isolated Staging fixture URL, not authority. */
export const RC_REVIEW_PATH="/bo/running-classes";
export const RC_REVIEW_SEED="RUNNING-CLASS-MOCK-001";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const tracking=new Set(["utm_source","utm_medium","utm_campaign","utm_term","utm_content"]);
export function parseRunningClassReviewQuery(input:URLSearchParams,legacy=false):string|null {
 const p=new URLSearchParams(input);
 if(legacy){if(p.getAll("module").length!==1||p.get("module")!=="classes")return null;p.delete("module");}
 for(const k of tracking)p.delete(k);
 for(const k of p.keys())if(p.getAll(k).length!==1||!["centerId","record"].includes(k))return null;
 if(p.has("centerId")&&!uuid.test(p.get("centerId")!))return null;
 if(p.has("record")&&p.get("record")!==RC_REVIEW_SEED)return null;
 const out=new URLSearchParams();
 for(const k of ["centerId","record"])if(p.has(k))out.set(k,p.get(k)!);
 return RC_REVIEW_PATH+(out.size?"?"+out.toString():"");
}
export function runningClassSearchParams(query:Record<string,string|string[]|undefined>):URLSearchParams{
 const p=new URLSearchParams();for(const [k,v] of Object.entries(query)){if(typeof v==="string")p.append(k,v);else if(Array.isArray(v))for(const item of v)p.append(k,item);}return p;
}
