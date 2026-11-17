/** PAP-1954 · BO Daily Payroll — collection is GET only, never a wage writer. */
import {getCloudflareContext} from "@opennextjs/cloudflare";
import {handleBoPayrollDailyRead,type BoPayrollDailyEnv} from "@/lib/bo-payroll-daily-handler";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request):Promise<Response>{
 const {env}=await getCloudflareContext({async:true}) as unknown as {env:BoPayrollDailyEnv};
 return handleBoPayrollDailyRead(request,env,"workforce/payroll/daily");
}
