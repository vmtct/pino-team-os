"use client";
import { useBoCenterSelection } from "../components/registration/BoCenterSelection";

/** PAP-764 · Epic PAP-759 · SCH-OPENING-EVIDENCE.
 * No synthetic rows/approval API. Center selection is not a permission grant.
 * S3 BO ledger remains gated on PAP-761 authenticated Core contract.
 */
export function OpeningEvidenceStageGate() {
  const scope = useBoCenterSelection();
  const loading = !scope || scope.loading;
  const denied = scope !== null && !scope.loading && Boolean(
    scope.error || !scope.selected || !scope.centers.some(center => center.id === scope.selected),
  );
  return <section aria-label="Mở lớp và ca" data-opening-evidence-phase="AP_FSG1_NAV_ONLY">
    <div className="page-heading">
      <div className="page-heading-left"><h1>Mở lớp &amp; ca</h1></div>
    </div>
    <div className="grid-card" aria-live="polite">
      <p role={denied ? "alert" : "status"} className="settings-hint">
        {loading
          ? "Đang xác thực cơ sở được cấp quyền…"
          : denied
            ? scope?.error || "Chưa có cơ sở được cấp quyền."
            : "Chưa kết nối dữ liệu bằng chứng mở lớp và ca từ Core. Chức năng đọc và duyệt sẽ được mở sau khi hợp đồng dữ liệu và phân quyền được xác minh."}
      </p>
    </div>
  </section>;
}
