import {parseDialogueConfig} from './pap657-dialogue-config.ts';
import {scheduleDialogue,type ActiveDialogue,type DialoguePair} from './pap657-dialogue-runtime.ts';
/** Never infer dialogue text or override published policy. Invalid config disables new interactions. */
export function advancePublishedDialogue(input:Readonly<{published:unknown;now:number;active:readonly ActiveDialogue[];nearby:readonly Omit<DialoguePair,'lines'>[]}>):ActiveDialogue[]{
 const config=parseDialogueConfig(input.published);
 if(!config)return [];
 const candidates:DialoguePair[]=input.nearby.map((pair,index)=>({...pair,lines:config.pool[index%config.pool.length]??[]}));
 return scheduleDialogue({now:input.now,durationMs:config.durationMs,active:input.active,candidates});
}
