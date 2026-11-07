"use client";
import { useContext } from "react";
import { HoWorkspace } from "@/app/ho/HoWorkspace";
import { TddHostMenu } from "@/app/components/workspace-adapters/SurfaceWorkspace";

/** PAP-1386 / PNR-TV S1 — navigation only; does not simulate Core Policy rows. */
function TvPoliciesNavLanding() {
 const menu=useContext(TddHostMenu);
 return <section id="list-screen" data-pnr-tv-stage="s1-nav">
  <div className="page-heading"><div className="page-heading-left">
   {menu("menu-btn")}<h1>Pinoria TV</h1>
  </div></div>
  <div className="grid-card" style={{padding:24}}>
   <p role="status" className="settings-hint">Danh sách chính sách trình chiếu sẽ xuất hiện tại đây khi kết nối dữ liệu được hoàn tất.</p>
  </div>
 </section>;
}
export default function HoTvPoliciesPage() {
 return <HoWorkspace module="tvPolicies" content={<TvPoliciesNavLanding/>}/>;
}
