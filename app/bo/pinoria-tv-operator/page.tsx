import Link from "next/link";
import { TvDeviceDiagnostics } from "./TvDeviceDiagnostics";
import { TvOperatorQueue } from "@/app/pinoria/tv-operator/TvOperatorQueue";

/** BO entry for PAP-659. Core TOS ACL remains authoritative for every command. */
export default function PinoriaTvOperatorPage() {
  return <main style={{padding:24, maxWidth:1100, margin:"0 auto"}}>
    <header style={{display:"flex", justifyContent:"space-between", gap:16, alignItems:"center"}}>
      <div><small>PINORIA · TV OPERATIONS</small><h1>Điều khiển TV</h1><p>Đọc queue và điều khiển presentation; không thực thi lại nghiệp vụ.</p></div>
      <Link href="/bo/tvs">Quản lý thiết bị ↗</Link>
    </header>
    <TvOperatorQueue />
    <TvDeviceDiagnostics />
  </main>;
}
