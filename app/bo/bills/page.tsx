import {headers} from "next/headers";
import {notFound} from "next/navigation";
import {BoBillsTdd} from "./BoBillsTdd";
/** PAP-1421 / Epic PAP-1362: bounded staging-only BO Bills route. */
export default async function Page(){
 const host=(await headers()).get("host")?.toLowerCase().split(":")[0]??"";
 if(host!=="bo.staging.pinohouse.art")notFound();
 return <BoBillsTdd/>;
}
