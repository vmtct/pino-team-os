/** PAP-2371 exact route; handler retains live Founder admission. */
import {getCloudflareContext} from "@opennextjs/cloudflare";
import {handleHoLearningSpaceRequest} from "@/lib/ho-learning-space-handler";
import type {HoWorldEnv} from "@/lib/ho-world-handler";
export const runtime="nodejs";
export const dynamic="force-dynamic";
async function handle(request:Request){const {env}=await getCloudflareContext({async:true}) as unknown as {env:HoWorldEnv};return handleHoLearningSpaceRequest(request,env);}
export const GET=handle;
export const POST=handle;
export const PATCH=handle;
export const DELETE=handle;
