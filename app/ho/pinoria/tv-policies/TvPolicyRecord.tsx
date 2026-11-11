"use client";
/** PAP-650 / PNR-TV · PAP-1385: Core-authorized Policy with Founder visibility DSA.
 * Existing Drawer remains read-only; no Viewer, device, fake History or ACL expansion.
 */
import { useContext } from "react";
import type { BoRecord } from "@/lib/bo-registration";
import { DrawerFrame } from "@/app/components/workspace-renderer/DrawerFrame";
import { DetailFrame } from "@/app/components/workspace-renderer/DetailFrame";
import { PropertySections } from "@/app/components/workspace-renderer/Properties";
import { RecordState } from "@/app/components/workspace-renderer/Record";
import { TddHostMenu } from "@/app/components/workspace-adapters/SurfaceWorkspace";
import { tvPolicyModule } from "@/lib/ho-tv-policy-directory";
import { TvPolicyVisibilityEditor, type TvVisibilityCenter } from "./TvPolicyVisibilityEditor";
import type { TvPolicyPane, TvPolicyLocation } from "@/lib/ho-tv-policy-navigation";
import { tvPolicyS4State } from "@/lib/ho-tv-policy-navigation";

const sections = [
  { id: "policy", label: "Thông tin Policy", fields: [
    "name", "typeName", "scope", "center", "resolution",
    "inherited", "active", "latest", "aspectRatio",
  ] },
  { id: "audit", label: "Thông tin hệ thống", fields: [
    "createdAt", "createdByUser", "updatedAt", "updatedByUser",
  ] },
] as const;

type Props = Readonly<{
  policy: BoRecord | null;
  centers: readonly TvVisibilityCenter[];
  state: "loading" | "ready" | "denied" | "unavailable";
  pane: TvPolicyPane;
  tab: TvPolicyLocation["tab"];
  onClose: () => void;
  onDetail: () => void;
  onTabChange: (tab: TvPolicyLocation["tab"]) => void;
  returnFocus: () => HTMLElement | null;
}>;

export function TvPolicyRecord({ policy, centers, state, pane, tab, onClose, onDetail, onTabChange, returnFocus }: Props) {
  const menu = useContext(TddHostMenu);
  const validated = tvPolicyS4State(state, Boolean(policy));
  const content = validated === "ready" && policy
    ? <PropertySections fields={tvPolicyModule.fields} record={policy} sections={sections}
        variant={pane === "drawer" ? "drawer" : "detail"} />
    : validated === "unavailable"
      ? <p role="alert">Không thể xác minh chi tiết Policy từ Core. Vui lòng thử lại.</p>
      : <RecordState status={validated} />;
  if (pane === "drawer") {
    return <DrawerFrame title={policy?.name ?? "Chi tiết Policy"} path="Pinoria TV / Policy"
      onClose={onClose}
      footer={<button type="button" id="full-detail" className="primary-btn"
        disabled={validated !== "ready"} onClick={onDetail}>↗ Full Detail</button>}>
      {content}
    </DrawerFrame>;
  }
  return <DetailFrame title={policy?.name ?? "Chi tiết Policy"}
    subtitle={policy?.id} mobileMenu={menu("detail-menu-btn")} onBack={onClose}
    returnFocus={returnFocus}
    tabs={[{ id: "overview", label: "Tổng quan" }, { id: "history", label: "Lịch sử" }]}
    selected={tab} onSelect={next => onTabChange(next === "history" ? "history" : "overview")}>
    {validated !== "ready" ? content : tab === "overview" ? <>{content}{policy ? <TvPolicyVisibilityEditor key={policy.id} policy={policy} centers={centers}/> : null}</>
      : <section className="v24-prop-section" data-pnr-tv-history="unavailable">
        <div className="v24-section-heading"><h4>Lịch sử</h4></div>
        <p role="status">Chưa có dữ liệu lịch sử Policy đã xác minh từ Core. Không hiển thị sự kiện giả hoặc suy diễn người thực hiện.</p>
      </section>}
  </DetailFrame>;
}
