import {headers} from "next/headers";
import {notFound} from "next/navigation";
import {BoOpenStudioPassesTdd} from "./BoOpenStudioPassesTdd";
/** PAP-1224: never render the new Open Studio Pass module on Production BO. */
export default async function Page(){
 const hostname=(await headers()).get("host")?.toLowerCase().split(":")[0]??"";
 if(hostname!=="bo.staging.pinohouse.art")notFound();
 return <BoOpenStudioPassesTdd/>;
}
