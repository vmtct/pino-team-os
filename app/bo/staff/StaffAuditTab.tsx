import Link from "next/link";
import styles from "../bo.module.css";

/**
 * PAP-791. The current BO Access audit browse is NOT a Staff-scoped unified timeline.
 * Do not fetch global audit records into a Staff detail panel and filter in-browser.
 */
export function StaffAuditTab({ staffId }: { staffId: string }) {
  return <section className={styles.panel} data-testid="staff-v2-audit">
    <div className={styles.panelHeading}>
      <div>
        <h2>Audit & lịch sử hoạt động</h2>
        <p>Không có Staff-scoped aggregate ledger đã xác minh; màn hình này không dựng timeline giả từ profile snapshots.</p>
      </div>
      <span className={styles.readOnly}>read only</span>
    </div>
    <p>Đối tượng cần đối chiếu: <code>{staffId}</code></p>
    <p>Để tra cứu sự kiện, hãy dùng Staff ID canonical trên các nguồn Audit được phân quyền. Mỗi nguồn tự giới hạn kết quả và quyền truy cập; không tải toàn bộ lịch sử của các Staff khác ở đây.</p>
    <div className={styles.staffActions}>
      <Link className={styles.secondaryButton} href="/bo/system/audit">Mở Access Audit</Link>
      <Link className={styles.secondaryButton} href="/bo/training">Mở Training assignments</Link>
      <Link className={styles.secondaryButton} href="/bo/workforce">Mở Workforce</Link>
    </div>
    <p className={styles.readOnly}>Access Audit không được trình bày như lịch sử Staff đầy đủ. Chỉ hiển thị actor, timestamp, source và action khi có read-model Staff-scoped chính thức.</p>
  </section>;
}
