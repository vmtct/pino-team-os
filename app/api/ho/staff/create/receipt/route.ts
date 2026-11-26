// PAP-2358 · WFM-STAFF. Exact staging HO admission in feature BFF.
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleHoManualStaffReceipt, type HoManualStaffCreateEnv } from "@/lib/ho-manual-staff-create-facade";
export const runtime = "nodejs";
export async function POST(request:Request):Promise<Response>{
  const {env}=await getCloudflareContext({async:true}) as unknown as {env:HoManualStaffCreateEnv};
  return handleHoManualStaffReceipt(request,env);
}
