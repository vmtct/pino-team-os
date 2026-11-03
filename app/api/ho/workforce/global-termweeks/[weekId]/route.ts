import {getCloudflareContext} from '@opennextjs/cloudflare';
import {handleHoTermWeek} from '@/lib/ho-termweek-facade';
import type {HoGlobalTermWeeksEnv} from '@/lib/ho-global-termweeks-read-facade';
export const runtime='nodejs';
async function handle(request:Request){const {env}=await getCloudflareContext({async:true}) as unknown as {env:HoGlobalTermWeeksEnv};return handleHoTermWeek(request,env);}
export const GET=handle;
