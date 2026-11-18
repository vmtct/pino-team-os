/** PAP-2032 / PNR-WISH — exact BO staging host/verb allowlist. */
const root="/api/bo/pinoria/pls-wish/events";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function boPlsWishHostDecision(host:string,path:string,method:string):"next"|"not_found"|null{
 if(path==="/bo/pinoria-wish-events"||path.startsWith("/bo/pinoria-wish-events/"))return host==="bo.staging.pinohouse.art"&&path==="/bo/pinoria-wish-events"&&(method==="GET"||method==="HEAD")?"next":"not_found";
 if(path!==root&&!path.startsWith(root+"/"))return null;
 if(host!=="bo.staging.pinohouse.art")return "not_found";
 const parts=path===root?[]:path.slice(root.length+1).split("/");
 return (method==="GET"&&(!parts.length||parts.length===1&&uuid.test(parts[0]!)||parts.length===3&&uuid.test(parts[0]!)&&parts[1]==="reward-media"&&/^(?:[1-9]|10)$/.test(parts[2]!)))||(method==="POST"&&parts.length===2&&uuid.test(parts[0]!)&&parts[1]==="invalidate")?"next":"not_found";
}
