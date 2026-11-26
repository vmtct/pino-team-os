/** PAP-2371 exact Learning Space namespace, pure host-safe contract. */
export const HO_LEARNING_SPACE_API="/api/ho/learning-spaces";
const root=HO_LEARNING_SPACE_API,id=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export type Route={method:"GET"|"POST"|"PATCH"|"DELETE";suffix:string;kind:"list"|"detail"|"related"|"create"|"update"|"remove"};
export function learningSpaceRoute(path:string,method:string):Route|null{
 if(path===root){if(method==="GET")return {method,suffix:"",kind:"list"};if(method==="POST")return {method,suffix:"",kind:"create"};return null;}
 if(!path.startsWith(root+"/"))return null;
 const suffix=path.slice(root.length),parts=suffix.slice(1).split("/");
 if(!id.test(parts[0]??""))return null;
 if(parts.length===1){if(method==="GET")return {method,suffix,kind:"detail"};if(method==="PATCH")return {method,suffix,kind:"update"};if(method==="DELETE")return {method,suffix,kind:"remove"};}
 if(parts.length===2&&method==="GET"&&(parts[1]==="classes"||parts[1]==="history"))return {method,suffix,kind:"related"};
 return null;
}

/** Canonical Staging navigation state, not authorization. */
export function parseLiveSpaceQuery(params:URLSearchParams):{record?:string}|null{
 const keys=[...params.keys()].filter(k=>!["utm_source","utm_medium","utm_campaign","utm_term","utm_content"].includes(k));
 if(keys.some(k=>k!=="record")||params.getAll("record").length>1)return null;
 const record=params.get("record");
 return record===null?{}:id.test(record)?{record}:null;
}
