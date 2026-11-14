/** PAP-1970 · GET-only native Salary facade, reusing authorized Core review transport. */
import {getCloudflareContext} from "@opennextjs/cloudflare";
import {type BoPayrollReviewEnv} from "@/lib/bo-payroll-extra-review-handler";
import {handleNativeExceptionRead} from "@/lib/bo-payroll-exceptions-native-handler";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request):Promise<Response>{
 const {env}=await getCloudflareContext({async:true}) as unknown as {env:BoPayrollReviewEnv};
 return handleNativeExceptionRead(request,env);
}
