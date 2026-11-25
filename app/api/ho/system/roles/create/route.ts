import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleNativeRoleLifecycle, type HoRoleLifecycleEnv } from "@/lib/ho-role-lifecycle-facade";
export const runtime="nodejs";
export async function POST(request:Request):Promise<Response>{
  const {env}=await getCloudflareContext({async:true}) as unknown as {env:HoRoleLifecycleEnv};
  return handleNativeRoleLifecycle(request,env);
}
