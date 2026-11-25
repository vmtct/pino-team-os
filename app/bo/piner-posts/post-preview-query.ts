/** PAP-2337: pure route-bound M1 fixture query, never an authorization decision. */
export const valid=(id:string|null|undefined):id is string=>typeof id==="string"&&/^POST-MOCK-\d{3,}$/.test(id);
export function parsePostReviewQuery(input:URLSearchParams):{legacy:boolean;canonical:string}|null{
 const p=new URLSearchParams(input);
 for(const k of ["utm_source","utm_medium","utm_campaign","utm_term","utm_content"])p.delete(k);
 for(const k of p.keys())if(p.getAll(k).length!==1||!["m1Preview","centerId","record","tab"].includes(k))return null;
 const legacy=p.has("m1Preview"),center=p.get("centerId"),record=p.get("record"),tab=p.get("tab");
 if(legacy&&p.get("m1Preview")!=="1")return null;
 if(p.has("centerId")&&(!center||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(center)))return null;
 if(p.has("record")&&!valid(record))return null;
 if(p.has("tab")&&(!record||!["overview","media","history"].includes(tab??"")))return null;
 const out=new URLSearchParams();for(const k of ["centerId","record","tab"])if(p.has(k))out.set(k,p.get(k)!);
 return {legacy,canonical:out.toString()};
}
