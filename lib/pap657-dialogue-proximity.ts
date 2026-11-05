import type {DialoguePair} from './pap657-dialogue-runtime';
export type PositionedActor=Readonly<{id:string;zoneId:string;x:number;y:number}>;
/** Proximity derives only pair identities and approved zone, never learner claims. */
export function nearbyDialoguePairs(actors:readonly PositionedActor[],proximityPx:number):Omit<DialoguePair,'lines'>[]{
 if(!Number.isFinite(proximityPx)||proximityPx<40||proximityPx>140)return [];
 const result:Omit<DialoguePair,'lines'>[]=[];
 for(let i=0;i<actors.length;i++)for(let j=i+1;j<actors.length;j++){
  const a=actors[i],b=actors[j];
  if(!/^[a-zA-Z0-9_:-]{1,80}$/.test(a.id)||!/^[a-zA-Z0-9_:-]{1,80}$/.test(b.id)||a.id===b.id||a.zoneId!==b.zoneId||!/^[a-zA-Z0-9_:-]{1,80}$/.test(a.zoneId))continue;
  if(![a.x,a.y,b.x,b.y].every(Number.isFinite))continue;
  if(Math.hypot(a.x-b.x,a.y-b.y)>proximityPx)continue;
  result.push({actorA:a.id,actorB:b.id,zoneId:a.zoneId});
 }
 return result;
}
