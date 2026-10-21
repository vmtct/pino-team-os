/** Validated publishable dialogue configuration; malformed revisions fail closed. */
export type DialogueConfig=Readonly<{revision:number;durationMs:number;proximityPx:number;maxTvBubbles:number;maxZoneBubbles:number;pool:readonly (readonly [string,string])[]}>;
const isObject=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export function parseDialogueConfig(value:unknown):DialogueConfig|null{
 if(!isObject(value))return null;
 const {revision,durationMs,proximityPx,maxTvBubbles,maxZoneBubbles,pool}=value;
 if(!Number.isSafeInteger(revision)||!(Number(revision)>0)||!Number.isSafeInteger(durationMs)||Number(durationMs)<1000||Number(durationMs)>15000)return null;
 if(!Number.isSafeInteger(proximityPx)||Number(proximityPx)<40||Number(proximityPx)>140||maxTvBubbles!==3||maxZoneBubbles!==1)return null;
 if(!Array.isArray(pool)||pool.length>40)return null;
 const safe=(x:unknown)=>typeof x==='string'&&x.length>0&&x.length<=120&&x.trim()===x&&!/[<>\u0000-\u001f]/.test(x);
 if(!pool.every(x=>Array.isArray(x)&&x.length===2&&x.every(safe)))return null;
 return {revision:Number(revision),durationMs:Number(durationMs),proximityPx:Number(proximityPx),maxTvBubbles:3,maxZoneBubbles:1,pool:pool.map(x=>[x[0],x[1]] as const)};
}
