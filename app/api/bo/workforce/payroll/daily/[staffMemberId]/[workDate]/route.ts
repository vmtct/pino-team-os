/** PAP-1954 · BO Daily Payroll — exact Staff/day detail GET only. */
import {getCloudflareContext} from "@opennextjs/cloudflare";
import {handleBoPayrollDailyRead,type BoPayrollDailyEnv} from "@/lib/bo-payroll-daily-handler";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Context={params:Promise<{staffMemberId:string;workDate:string}>};
export async function GET(request:Request,context:Context):Promise<Response>{
 const {env}=await getCloudflareContext({async:true}) as unknown as {env:BoPayrollDailyEnv};
 const {staffMemberId,workDate}=await context.params;
 return handleBoPayrollDailyRead(request,env,"workforce/payroll/daily/"+staffMemberId+"/"+workDate);
}
