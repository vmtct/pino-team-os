import {BoEnrollmentTdd} from "./EnrollmentRuntime";
import {headers} from "next/headers";
import {notFound} from "next/navigation";
import {getCloudflareContext} from "@opennextjs/cloudflare";
import {boSkeletonEnabled} from "@/lib/bo-skeleton";
export default async function EnrollmentPage(){
 const host=(await headers()).get("host")??"";
 const {env}=await getCloudflareContext({async:true}) as unknown as {env:{APP_ENV?:string;BO_UI_ONLY?:string}};
 if(host.split(":")[0]!=="bo.staging.pinohouse.art"||!boSkeletonEnabled(env,host))notFound();
 return <BoEnrollmentTdd/>;
}
