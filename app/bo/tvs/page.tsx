import Link from "next/link";
import { TvManagementView } from "./TvManagementView";
export default function TvManagementPage(){
  return <><div style={{display:"flex",justifyContent:"flex-end",padding:"8px 20px"}}><Link href="/bo/pinoria-tv-mesh">Configure Pinoria House mesh ↗</Link><Link href="/bo/pinoria-tv-dialogue" style={{marginLeft:16}}>Social Dialogue preview ↗</Link></div><TvManagementView/></>;
}
