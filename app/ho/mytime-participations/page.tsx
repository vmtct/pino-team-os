import {getCloudflareContext} from "@opennextjs/cloudflare";
import {headers} from "next/headers";
import {HoWorkspace} from "@/app/ho/HoWorkspace";
import {authorizeHoShell,type HoEnv} from "@/lib/ho-auth";
import {HoParticipationTdd} from "@/app/components/mytime-workshop/ParticipationTdd";
/** PAP-2242: HO Participation directory is global and read-only. */
export default async function Page(){
  const {env}=await getCloudflareContext({async:true}) as unknown as {env:HoEnv};
  const context=await authorizeHoShell(new Headers(await headers()),env);
  return <HoWorkspace module="mytimeParticipations" content={context.permissionKeys.includes("learning.mytime_workshop.ho_view")?<HoParticipationTdd/>:<p role="alert">Bạn không có quyền xem Participation.</p>}/>;
}
