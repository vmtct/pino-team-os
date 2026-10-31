import {headers} from "next/headers";
import {notFound} from "next/navigation";
import {BoClassroomDiariesTdd} from "./BoClassroomDiariesTdd";
/** PAP-1220: staged BO read-only Diary; not exposed on Production until E2E. */
export default async function Page(){
 const host=(await headers()).get("host")?.toLowerCase().split(":")[0]??"";
 if(host!=="bo.staging.pinohouse.art")notFound();
 return <BoClassroomDiariesTdd/>;
}
