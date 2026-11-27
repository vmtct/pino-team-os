/** PAP-2153: confirmation must not silently rebase to newer Core state. */
import type {AvatarWorldState} from "./avatar-world-contract";
export function worldConfirmationStamp(state:AvatarWorldState,grants:ReadonlySet<string>){
 return JSON.stringify({state,grants:[...grants].sort()});
}
