"use client";
/* PAP-1606 / PAP-1601 — S1 navigation-only placeholder.
 * G0-approved VI/EN technical mapping Table is PAP-1649 in separate Founder-gated S3.
 */
import { useContext } from "react";
import { TddHostMenu } from "@/app/components/workspace-adapters/SurfaceWorkspace";
import { LocalizedModuleTitle } from "@/lib/pino-nav-locale-context";

export function HoLanguageMappingPending() {
  const menu = useContext(TddHostMenu);
  return <section id="list-screen" data-pap-stage="PAP-1606-S1">
    <div className="page-heading">
      <div className="page-heading-left">
        {menu("ho-language-mappings-menu-btn")}
        <h1><LocalizedModuleTitle label="Language Mapping" moduleKey="languageMappings" /></h1>
      </div>
    </div>
    <p role="status" className="settings-hint">
      Bảng đối chiếu VI/EN chỉ đọc sẽ được triển khai tại S3, sau khi Founder duyệt S1 Navigation.
    </p>
  </section>;
}
