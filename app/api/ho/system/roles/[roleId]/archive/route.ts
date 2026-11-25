import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleNativeRoleLifecycle, type HoRoleLifecycleEnv } from "@/lib/ho-role-lifecycle-facade";
export const runtime="nodejs";
type Context={params:Promise<{roleId:string}>};
export async function POST(request:Request,context:Context):Promise<Response>{
  const {env}=await getCloudflareContext({async:true}) as unknown as {env:HoRoleLifecycleEnv};
  const {roleId}=await context.params;
  return handleNativeRoleLifecycle(request,env,roleId);
}
