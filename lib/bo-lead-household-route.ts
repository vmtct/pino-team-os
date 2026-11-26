/** PAP-2288 — exact BO Staging acquisition household aperture. */
const base="acquisition/households";
const uuid="[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const record=new RegExp("^"+base+"/"+uuid+"$");
const history=new RegExp("^"+base+"/"+uuid+"/history$");
const action=new RegExp("^"+base+"/"+uuid+"/(contact|members|primary|relationships|archive)$");
const child=new RegExp("^"+base+"/"+uuid+"/(members|relationships)/"+uuid+"/(update|retire|confirm)$");
const intent=new RegExp("^"+base+"/("+uuid+")/intents/("+uuid+")/(contacted|verify-contact|close|recovery)$");
export function leadHouseholdRoute(path:string){
 const search=path===base+"/search",recovery=path===base+"/recovery",create=path===base,detail=record.test(path),hist=history.test(path),a=action.exec(path),c=child.exec(path),i=intent.exec(path);
 if((!search&&!recovery&&!create&&!detail&&!hist&&!a&&!c&&!i)||(c?.[1]==="members"&&c[2]==="confirm"))return null;
 return {search,recovery,create,detail,hist,a,c,i,method:detail||hist?"GET":"POST"};
}
export function leadHouseholdHostDecision(host:string,pathname:string,method:string):"next"|"not_found"|null{
 const lower=pathname.toLowerCase();
 const namespace=["/api/bo/","/api/ho/","/api/tos/"].some(prefix=>lower===prefix+base||lower.startsWith(prefix+base+"/"));
 if(!namespace)return null;
 if(host!=="bo.staging.pinohouse.art"||!pathname.startsWith("/api/bo/"))return "not_found";
 const route=leadHouseholdRoute(pathname.slice("/api/bo/".length));
 return route&&route.method===method?"next":"not_found";
}
