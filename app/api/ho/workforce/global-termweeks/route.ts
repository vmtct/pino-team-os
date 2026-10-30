import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleHoGlobalTermWeeksRead, type HoGlobalTermWeeksEnv } from "@/lib/ho-global-termweeks-read-facade";
export const runtime = "nodejs";
export async function GET(request:Request):Promise<Response>{
  const {env}=await getCloudflareContext({async:true}) as unknown as {env:HoGlobalTermWeeksEnv};
  return handleHoGlobalTermWeeksRead(request,env);
}