import {getCloudflareContext} from "@opennextjs/cloudflare";
import {handleBoOpeningEvidence,type BoOpeningEvidenceEnv} from "@/lib/bo-opening-evidence-handler";
export const dynamic="force-dynamic";
type Context={params:Promise<{path?:string[]}>};
async function handle(request:Request,context:Context){
 const {env}=await getCloudflareContext({async:true});
 const {path}=await context.params;
 return handleBoOpeningEvidence(request,env as unknown as BoOpeningEvidenceEnv,path??[]);
}
export const GET=handle;
export const POST=handle;
