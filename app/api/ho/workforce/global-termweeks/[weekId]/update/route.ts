import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleHoGlobalTermWeekUpdate } from "@/lib/ho-global-termweeks-update-facade";
import type { HoGlobalTermWeeksEnv } from "@/lib/ho-global-termweeks-read-facade";
export const runtime = "nodejs";
export async function POST(request:Request):Promise<Response>{
 const {env}=await getCloudflareContext({async:true}) as unknown as {env:HoGlobalTermWeeksEnv};
 return handleHoGlobalTermWeekUpdate(request,env);
}
