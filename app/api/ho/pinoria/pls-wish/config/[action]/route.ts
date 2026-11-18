import {getCloudflareContext} from "@opennextjs/cloudflare";
import {handleHoPlsWishRequest} from "@/lib/ho-pls-wish-handler";
import type {HoItemEnv} from "@/lib/ho-pinoria-item-handler";
export const runtime="nodejs";
export const dynamic="force-dynamic";
async function handle(r:Request){const {env}=await getCloudflareContext({async:true}) as unknown as {env:HoItemEnv};return handleHoPlsWishRequest(r,env);}
export const GET=handle;
export const POST=handle;
