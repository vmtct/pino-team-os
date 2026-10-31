import Link from "next/link";
import {headers} from "next/headers";
import {TvsTdd} from "./TvsTdd";
import { TvManagementView } from "./TvManagementView";
export default async function TvManagementPage(){
  if((await headers()).get("host")?.toLowerCase().split(":")[0]==="bo.staging.pinohouse.art")return <TvsTdd/>;
  return <><div style={{display:"flex",justifyContent:"flex-end",padding:"8px 20px"}}><Link href="/bo/pinoria-tv-mesh">Configure Pinoria House mesh ↗</Link><Link href="/bo/pinoria-tv-dialogue" style={{marginLeft:16}}>Social Dialogue preview ↗</Link></div><TvManagementView/></>;
}
