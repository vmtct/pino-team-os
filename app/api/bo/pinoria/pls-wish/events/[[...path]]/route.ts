import {getCloudflareContext} from "@opennextjs/cloudflare";
import {handleBoPlsWishEvent,type BoPlsWishEnv} from "@/lib/bo-pls-wish-handler";
export const dynamic="force-dynamic";
async function handle(r:Request){const {env}=await getCloudflareContext({async:true});return handleBoPlsWishEvent(r,env as unknown as BoPlsWishEnv);}
export const GET=handle;
export const POST=handle;
