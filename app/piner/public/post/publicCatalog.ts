// PAP-1800: server-only public read model with explicit published-ID allowlist.
// Current mock is immutable by design; parent sessionStorage cannot publicly publish/revoke.
import "server-only";
import {POSTS,PHOTO_CAROUSELS} from "../../media";
import type {PublicPost} from "../../publicTypes";
import {isPublicFixture} from "../../publicApproved";
import {isInSpace,type PinerSpace} from "../../spaces";
const ALIASES:Record<string,string>={an:"Minh An",binh:"Gia Bình",mai:"Thanh Mai","pino-piano":"PINO Piano"};
function sanitize(p:(typeof POSTS)[number]):PublicPost{
 return {id:p.id,ownerId:p.ownerId,reactions:p.reactions,duration:p.duration,app:p.app,type:p.type,visual:p.visual,title:p.title,caption:p.caption,
   date:p.date,alias:ALIASES[p.ownerId]||"Piner",
   comments:p.comments.map(c=>({id:c.id,author:c.author,body:c.body})),
   frames:[...(PHOTO_CAROUSELS[p.id]??[p.visual])],
   videoSrc:p.type==="reel"?(p.app==="piano"?"/piner/media/piano-demo.mp4":"/piner/media/art-demo.mp4"):null};
}
export function publicPosts(space?:PinerSpace):PublicPost[]{
 return POSTS.filter(p=>isPublicFixture(p.id)&&p.visibility==="community"&&(!space||isInSpace(p,space))).map(sanitize);
}
export function publicPost(id:string):PublicPost|undefined{
 if(!isPublicFixture(id))return undefined;
 const p=POSTS.find(p=>p.id===id&&p.visibility==="community");
 return p?sanitize(p):undefined;
}
