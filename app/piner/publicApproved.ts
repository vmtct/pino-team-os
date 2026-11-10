// PAP-1803 · local-only shared synthetic URL contract. Public Internet preview was disabled.
// A genuine public release needs PAP-1802 Core consent/ACL/revocation and Founder S0.
export const PUBLIC_FIXTURE_IDS=Object.freeze(["a2","a4","a5","p2","p3","p5","sys-event","sys-news"] as const);
export function isPublicFixture(id:string):boolean{return PUBLIC_FIXTURE_IDS.some(key=>key===id);}
export const LOCAL_PUBLIC_COMMUNITY="/piner/public";
export function publicCommunityHref(space:"house"|"mytime"="house"){return space==="mytime"?"/piner/public/mytime":LOCAL_PUBLIC_COMMUNITY;}
export function publicPostHref(id:string){return "/piner/public/post/"+encodeURIComponent(id);}
export function publicProfileHref(id:string){return "/piner/public/profile/"+encodeURIComponent(id);}