import {getCloudflareContext} from "@opennextjs/cloudflare";
import {handleHoPersonRequest} from "@/lib/ho-person-handler";
import type {HoWorldEnv} from "@/lib/ho-world-handler";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request){const {env}=await getCloudflareContext({async:true}) as unknown as {env:HoWorldEnv};return handleHoPersonRequest(request,env);}