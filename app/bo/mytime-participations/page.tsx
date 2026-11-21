import {headers} from "next/headers";
import {notFound} from "next/navigation";
import {BoParticipationTdd} from "@/app/components/mytime-workshop/ParticipationTdd";
/** PAP-2242: staged BO Participation directory; center scoped and read-only. */
export default async function Page(){
  const host=(await headers()).get("host")?.toLowerCase().split(":")[0]??"";
  if(host!=="bo.staging.pinohouse.art")notFound();
  return <BoParticipationTdd/>;
}
