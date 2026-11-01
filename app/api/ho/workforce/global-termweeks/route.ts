import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleHoGlobalTermWeeksRead, type HoGlobalTermWeeksEnv } from "@/lib/ho-global-termweeks-read-facade";
import { handleHoGlobalTermWeeksCreate } from "@/lib/ho-global-termweeks-create-facade";
export const runtime = "nodejs";
export async function GET(request:Request):Promise<Response>{
  const {env}=await getCloudflareContext({async:true}) as unknown as {env:HoGlobalTermWeeksEnv};
  return handleHoGlobalTermWeeksRead(request,env);
}
export async function POST(request:Request):Promise<Response>{
  const {env}=await getCloudflareContext({async:true}) as unknown as {env:HoGlobalTermWeeksEnv};
  return handleHoGlobalTermWeeksCreate(request,env);
}
