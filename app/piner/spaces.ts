// PAP-1805 · PINO House and MyTime share shell and renderers; only identity/content tokens differ.
import type {MediaPost} from "./media";
export type PinerSpace="house"|"mytime";
export const SPACES={
 house:{label:"PINO Afterschool",subtitle:"Hết giờ học, đến giờ con khám phá.",description:"Hội Họa & Piano của các bạn nhỏ.",tone:"house",href:"/piner/house",publicHref:"/piner/public"},
 mytime:{label:"MyTime by PINO",subtitle:"Hết những bận rộn, đến giờ mình tận hưởng.",description:"Những tác phẩm và giai điệu của chính bạn.",tone:"mytime",href:"/piner/mytime",publicHref:"/piner/public/mytime"}
} as const;
export function postSpace(post:Pick<MediaPost,"ownerId">):PinerSpace{return post.ownerId==="mai"?"mytime":"house";}
export function isInSpace(post:Pick<MediaPost,"ownerId">,space:PinerSpace){return postSpace(post)===space;}
export const pathFor=(space:PinerSpace,tab:"home"|"grid"|"reels"|"community")=>"/piner/"+space+(tab==="home"?"":"/"+tab);
