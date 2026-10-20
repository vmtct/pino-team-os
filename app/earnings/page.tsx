import Link from "next/link";
import { TosShell } from "@/app/components/tos-shell";
import { TOS_SHIFT_FOOTER } from "@/app/components/tos-shell/navigation";
import styles from "./earnings.module.css";

export default function EarningsPage() {
  return (
    <TosShell
      title="Ca làm"
      theme="shift"
      footerItems={TOS_SHIFT_FOOTER}
      activeFooterId="income"
      compactAppHeader
      backHref="/"
      appIconSrc="https://pub-892fa79b018d4d2f9b0808189dd2ce46.r2.dev/AppIcon/shift.png"
    >
      <div className={styles.stack}>
        <section className={styles.intro}>
          <span>THU NHẬP</span>
          <h2>Chưa sẵn sàng</h2>
          <p>Theo dõi thu nhập và lịch sử thanh toán khi có nguồn payroll authoritative dành cho chính nhân viên.</p>
        </section>

        <section className={styles.hero} aria-labelledby="earnings-state">
          <span className={styles.pill}>Dữ liệu chưa khả dụng</span>
          <p id="earnings-state">Thu nhập kỳ này</p>
          <strong>Chưa sẵn sàng</strong>
          <small>Không suy đoán số tiền, đơn giá, số giờ tính lương hoặc trạng thái chốt từ dữ liệu chấm công.</small>
        </section>

        <section className={styles.card}>
          <h3>Chi tiết kỳ này</h3>
          <div className={styles.row}><span>Tiền công cơ bản</span><strong>Chưa sẵn sàng</strong></div>
          <div className={styles.row}><span>Điều chỉnh</span><strong>Chưa sẵn sàng</strong></div>
          <div className={styles.row}><span>Đã thanh toán</span><strong>Chưa sẵn sàng</strong></div>
          <div className={styles.row}><span>Trạng thái</span><strong>Chưa sẵn sàng</strong></div>
        </section>

        <section className={styles.card}>
          <h3>Yêu cầu tính thêm giờ</h3>
          <p className={styles.muted}>Gửi khoảng giờ đã làm nhưng chưa được tính trong giờ công chuẩn. Chỉ yêu cầu được duyệt mới được cộng vào lương.</p>
          <Link href="/earnings/extra-time" className={styles.action}>Tạo yêu cầu / Xem lịch sử →</Link>
        </section>
        <section className={styles.card}>
          <h3>Kỳ lương trước</h3>
          <p className={styles.muted}>Chưa có staff-self payroll contract để đọc kỳ trước một cách an toàn.</p>
        </section>
      </div>
    </TosShell>
  );
}
