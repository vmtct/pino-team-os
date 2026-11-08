"use client";
import { useContext } from "react";
import { HoWorkspace } from "@/app/ho/HoWorkspace";
import { TddHostMenu } from "@/app/components/workspace-adapters/SurfaceWorkspace";
/** PAP-1669 / PLT-ATTR FSG1: HO Founder navigation and empty admission only.
 * Core registry/CRUD, Table/Drawer/Detail and synthetic rows deliberately absent.
 * Parent HO layout verifies staging host, session, cohort and Core Founder role.
 */
function CustomAttributesNavigationLanding() {
 const menu=useContext(TddHostMenu);
 return <section id="list-screen" data-plt-attr-stage="fsg1-nav">
  <div className="page-heading"><div className="page-heading-left">
   {menu("menu-btn")}<h1>Custom Attributes</h1>
  </div></div>
  <div className="grid-card" style={{padding:24}}>
   <p role="status" className="settings-hint">Chưa có thuộc tính để hiển thị. Chức năng cấu hình sẽ được triển khai ở bước tiếp theo.</p>
  </div>
 </section>;
}
export default function HoCustomAttributesPage() {
 return <HoWorkspace module="customAttributes" content={<CustomAttributesNavigationLanding/>}/>;
}
