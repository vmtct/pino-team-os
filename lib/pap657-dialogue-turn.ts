import type {ActiveDialogue} from './pap657-dialogue-runtime';
/** Only the speaking actor displays one line at a time; no simultaneous two-sided bubbles. */
export function visibleDialogueLine(dialogue:ActiveDialogue,actorId:string,now:number):string|null{
 if(!Number.isFinite(now)||now<dialogue.startedAt||now>=dialogue.expiresAt||dialogue.lines.length!==2)return null;
 const duration=dialogue.expiresAt-dialogue.startedAt;
 if(duration<=0)return null;
 const turn=Math.min(1,Math.floor((now-dialogue.startedAt)/(duration/2)));
 return (turn===0?dialogue.actorA:dialogue.actorB)===actorId?dialogue.lines[turn]:null;
}
