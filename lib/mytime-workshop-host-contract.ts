// PAP-2164 / MT-WORKSHOP: exact staging-only page and private API routes. No cross-platform or generic descendant.
const UUID="[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const detail=new RegExp("^("+UUID+")(/history|/cancel)?$");
const PAGE=/^\/(ho|bo)\/mytime-workshops$/;
const API=/^\/api\/(ho|bo)\/learning\/mytime-workshops(?:\/(.*))?$/;
export function workshopHostDecision(host:string,path:string,method:string):"next"|"not_found"|null{
 const lower=path.toLowerCase(),related=["/ho/mytime-workshops","/bo/mytime-workshops","/api/ho/learning/mytime-workshops","/api/bo/learning/mytime-workshops"].some(p=>lower===p||lower.startsWith(p+"/"));
 if(!related)return null;
 const page=PAGE.exec(path),api=API.exec(path),surface=page?.[1]??api?.[1];
 if(!surface||host!==surface+".staging.pinohouse.art")return "not_found";
 if(page)return method==="GET"||method==="HEAD"?"next":"not_found";
 if(!api)return "not_found";
 const tail=api[2];
 if(tail===undefined)return method==="GET"||surface==="ho"&&method==="POST"?"next":"not_found";
 const match=detail.exec(tail);
 if(match){const suffix=match[2];return method==="GET"&&suffix!=="/cancel"||surface==="ho"&&(method==="PATCH"&&suffix===undefined||method==="POST"&&suffix==="/cancel")?"next":"not_found";}
 return surface==="ho"&&method==="GET"&&/^lookup\/(centers|missions|specialties|staff)$/.test(tail)?"next":"not_found";
}
