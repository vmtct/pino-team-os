// PAP-1943 / PNR-APP-HUB — adapter contract, fail-closed until real Identity G4.
export const PROGRAMS=Object.freeze({
 house:{key:"house",label:"PINO Afterschool",tagline:"Hết giờ học, đến giờ con khám phá.",path:"/piner/house"},
 mytime:{key:"mytime",label:"MyTime by PINO",tagline:"Hết những bận rộn, đến giờ mình tận hưởng.",path:"/piner/mytime"}
});
export const TABS=Object.freeze(["home","grid","reels","community"]);
export const ADAPTER_STATES=Object.freeze(["unauthenticated","loading","empty","denied","error","ready"]);
export function routeFor(space,tab="home"){
 if(!Object.hasOwn(PROGRAMS,space)||!TABS.includes(tab))throw Error("Invalid Piner route");
 return PROGRAMS[space].path+(tab==="home"?"":"/"+tab);
}
export function parseRoute(path){
 if(["/","/piner","/piner/","/index.html"].includes(path))return {kind:"launcher"};
 const m=path.match(/^\/piner\/(house|mytime)(?:\/(grid|reels|community))?\/?$/);
 return m?{kind:"member",space:m[1],tab:m[2]||"home"}:null;
}
export function getShellAdapter(){
 // No actor, student, adult, Center, post, media, share or permission may be synthesized.
 return Object.freeze({state:"unauthenticated",actor:null,center:null,children:[],posts:[],media:[],grants:[]});
}
export function assertFailClosed(s){
 if(s.state!=="unauthenticated"||s.actor!==null||s.center!==null||s.children.length||s.posts.length||s.media.length||s.grants.length)throw Error("PAP1943 unauthorized projection");
 return s;
}
