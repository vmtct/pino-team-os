import {getCloudflareContext} from "@opennextjs/cloudflare";
import {handleTosPlsWish} from "@/lib/tos-pls-wish-handler";
export const runtime="nodejs";
export const dynamic="force-dynamic";
async function handle(r:Request){const {env}=await getCloudflareContext({async:true}) as unknown as {env:Parameters<typeof handleTosPlsWish>[1]};return handleTosPlsWish(r,env);}
export const GET=handle;
export const POST=handle;
export const PUT=handle;
export const PATCH=handle;
export const DELETE=handle;
