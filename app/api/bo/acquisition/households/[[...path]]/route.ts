import {getCloudflareContext} from "@opennextjs/cloudflare";
import {handleLeadHousehold,type LeadHouseholdEnv} from "@/lib/bo-lead-household-handler";
export const runtime="nodejs";
export const dynamic="force-dynamic";
async function dispatch(request:Request){const {env}=await getCloudflareContext({async:true}) as unknown as {env:LeadHouseholdEnv};return handleLeadHousehold(request,env);}
export const GET=dispatch;
export const POST=dispatch;
