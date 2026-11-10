// PAP-1800 · Preview-only approved public fixture IDs; no guardian session state.
export const PUBLIC_FIXTURE_IDS=Object.freeze(["a2","a4","a5","p2","p3","p5"] as const);
export function isPublicFixture(id:string):boolean{return PUBLIC_FIXTURE_IDS.some(key=>key===id);}
export const LOCAL_PUBLIC_COMMUNITY="/piner/public/community";
export function localPublicPermalink(id:string):string{return "/piner/public/post/"+encodeURIComponent(id);}

// HTTPS public demo verified 2026-11-10; real production host requires separate S0.
export const PUBLIC_PREVIEW_ORIGIN=process.env.NEXT_PUBLIC_PINER_PUBLIC_ORIGIN||"https://piner-community-public-preview.minhtri-van42.workers.dev";
export const publicCommunityHref=()=>PUBLIC_PREVIEW_ORIGIN+"/community";
export const publicPostHref=(id:string)=>PUBLIC_PREVIEW_ORIGIN+"/post/"+encodeURIComponent(id);
