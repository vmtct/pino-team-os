/** PAP-2387: subsequent rejection cannot resolve an earlier unknown command. */
export function parentCreateMayEdit(previouslyUncertain:boolean,definiteRejection:boolean){return !previouslyUncertain&&definiteRejection;}
