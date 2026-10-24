import {parseDialogueConfig} from './pap657-dialogue-config';
import {advancePublishedDialogue} from './pap657-dialogue-engine';
import {nearbyDialoguePairs,type PositionedActor} from './pap657-dialogue-proximity';
import type {ActiveDialogue} from './pap657-dialogue-runtime';
/** The configured proximity threshold is authoritative; never accept supplied pair claims. */
export function advanceSpatialDialogue(input:Readonly<{published:unknown;now:number;active:readonly ActiveDialogue[];actors:readonly PositionedActor[]}>):ActiveDialogue[]{
 const config=parseDialogueConfig(input.published);
 if(!config)return [];
 const nearby=nearbyDialoguePairs(input.actors,config.proximityPx);
 const eligible=new Set(nearby.map(p=>[p.actorA,p.actorB,p.zoneId].join('|')));
 const active=input.active.filter(x=>eligible.has([x.actorA,x.actorB,x.zoneId].join('|')));
 return advancePublishedDialogue({published:config,now:input.now,active,nearby});
}
