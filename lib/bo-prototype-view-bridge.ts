/** Same canonical client/state/queue as the BO app; no parallel persistence engine. */
import { createBoPublicViewBrowserRuntime } from './bo-public-view-browser-runtime';
export function create(moduleKey:string,role:'manager'|'staff',allowedFields:string[]){
 return createBoPublicViewBrowserRuntime({moduleKey,role,allowedFields});
}
