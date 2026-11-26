// PAP-2358 · WFM-STAFF. Exact HO Staging read admission; authorization stays in BFF.
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleHoManualStaffDirectory, type HoManualStaffCreateEnv } from "@/lib/ho-manual-staff-create-facade";
export const runtime = "nodejs";
export async function GET(request:Request):Promise<Response>{
  const {env}=await getCloudflareContext({async:true}) as unknown as {env:HoManualStaffCreateEnv};
  return handleHoManualStaffDirectory(request,env);
}
