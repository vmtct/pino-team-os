import { TosShell } from "@/app/components/tos-shell";
import { TOS_SHIFT_FOOTER } from "@/app/components/tos-shell/navigation";

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
      <section className="card section">
        <span>THU NHẬP</span>
        <h2>Chưa sẵn sàng</h2>
        <p className="muted">TOS chưa có nguồn payroll authoritative cho nhân viên. Không hiển thị hoặc suy đoán số tiền cho tới khi PAP-707 cung cấp contract thật.</p>
      </section>
    </TosShell>
  );
}
