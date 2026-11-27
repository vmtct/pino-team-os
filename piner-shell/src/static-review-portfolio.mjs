// PAP-2377 / PAP-2342 — bounded, immutable synthetic review content.
// Uses existing server member chrome; no fixture API, provider or client lifecycle.
import {decidePinerStaticM1} from "../../lib/m1-preview/piner-static-admission.ts";
import {readSyntheticReviewDecision} from "./synthetic-review-decision.mjs";
import {approvedSourceRevision,registrations,artifacts} from "./static-review-artifacts.mjs";
const sha=async text=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text))),x=>x.toString(16).padStart(2,"0")).join("");
export async function readStaticReviewPortfolio(request,env,memberChrome) {
 try {
  if(env?.APP_ENV!=="staging"||env?.PINER_SYNTHETIC_REVIEW_ENABLED!=="true"||memberChrome?.runtime!==true)return null;
  const url=new URL(request.url);
  if(!Object.hasOwn(registrations,url.pathname))return null;
  const registration=registrations[url.pathname],bytes=artifacts[url.pathname];
  const digest=await sha(bytes);
  if(digest!==registration.sha256)return null;
  const data=JSON.parse(bytes);
  if(data.posts?.length!==1||data.posts[0].synthetic!==true||data.posts[0].key!==data.fixtureId||data.posts[0].media?.length!==data.photoCount||data.posts[0].space!==data.space)return null;
  // The existing renderer needs a current authorized profile for House;
  // no fabricated profile or persistent association to this synthetic post.
  const selected=memberChrome.selectedId;
  if(data.space==="house"&&(!selected||!memberChrome.students?.some(p=>p.id===selected)))return null;
  const review=await readSyntheticReviewDecision(request,env.PINER_SYNTHETIC_REVIEW,memberChrome,env.PINER_SYNTHETIC_REVIEW_ENABLED);
  if(review.allowed!==true)return null;
  const decision=decidePinerStaticM1({environment:env.APP_ENV,featureEnabled:true,requestUrl:request.url,method:request.method,
    approvedSourceRevision,registration,
    verifiedArtifact:{route:data.route,fixtureId:data.fixtureId,photoCount:data.photoCount,sourceRevision:data.sourceRevision,sha256:digest},
    proof:{authenticated:true,surfaceAuthorized:true,featureReviewAuthorized:true,scopeAuthorized:true,program:review.program}});
  if(!decision.allowed||decision.program!==data.space)return null;
  return {space:data.space,state:"ready",profileKey:data.space==="house"?selected:null,posts:data.posts};
 } catch {return null;}
}
