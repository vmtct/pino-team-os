import {parseDialogueConfig} from './pap657-dialogue-config.ts';
import {advancePublishedDialogue} from './pap657-dialogue-engine.ts';
import {nearbyDialoguePairs,type PositionedActor} from './pap657-dialogue-proximity.ts';
import type {ActiveDialogue} from './pap657-dialogue-runtime.ts';
/** The configured proximity threshold is authoritative; never accept supplied pair claims. */
export function advanceSpatialDialogue(input:Readonly<{published:unknown;now:number;active:readonly ActiveDialogue[];actors:readonly PositionedActor[]}>):ActiveDialogue[]{
 const config=parseDialogueConfig(input.published);
 if(!config)return [];
 const nearby=nearbyDialoguePairs(input.actors,config.proximityPx);
 return advancePublishedDialogue({published:config,now:input.now,active:input.active,nearby});
}
