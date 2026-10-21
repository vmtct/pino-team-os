/** Deterministic, fail-closed social-dialogue scheduler. No learner claims are generated here. */
export type DialoguePair = Readonly<{actorA:string;actorB:string;zoneId:string;lines:readonly string[]}>;
export type ActiveDialogue = Readonly<{actorA:string;actorB:string;zoneId:string;startedAt:number;expiresAt:number;lines:readonly string[]}>;
const safeId=(value:string)=>typeof value==='string'&&/^[a-zA-Z0-9_:-]{1,80}$/.test(value);
const safeLine=(value:string)=>typeof value==='string'&&value.length>0&&value.length<=120&&value.trim()===value&&!/[<>\u0000-\u001f]/.test(value);
export function scheduleDialogue(input:Readonly<{now:number;durationMs:number;candidates:readonly DialoguePair[];active:readonly ActiveDialogue[]}>):ActiveDialogue[]{
 if(!Number.isSafeInteger(input.now)||!Number.isSafeInteger(input.durationMs)||input.durationMs<1000||input.durationMs>15000)return [];
 const active=input.active.filter(x=>x.expiresAt>input.now&&x.startedAt<=input.now&&safeId(x.zoneId)&&safeId(x.actorA)&&safeId(x.actorB)).slice(0,3);
 const occupiedZones=new Set(active.map(x=>x.zoneId));
 const occupiedActors=new Set(active.flatMap(x=>[x.actorA,x.actorB]));
 for(const p of input.candidates){
  if(active.length>=3)break;
  if(!safeId(p.zoneId)||!safeId(p.actorA)||!safeId(p.actorB)||p.actorA===p.actorB||occupiedZones.has(p.zoneId)||occupiedActors.has(p.actorA)||occupiedActors.has(p.actorB))continue;
  if(p.lines.length<2||p.lines.length>8||!p.lines.every(safeLine))continue;
  active.push({actorA:p.actorA,actorB:p.actorB,zoneId:p.zoneId,startedAt:input.now,expiresAt:input.now+input.durationMs,lines:[...p.lines]});
  occupiedZones.add(p.zoneId);occupiedActors.add(p.actorA);occupiedActors.add(p.actorB);
 }
 return active;
}
