import { LogoutButton } from "@/app/components/tos-shell/LogoutButton";
import styles from "./forbidden.module.css";

/** A denied TOS session must always have a working account-switch exit.
 * The server 403 remains authoritative; this component never grants access. */
export default function TosV4Forbidden() {
  return <main className={styles.page}>
    <section className={styles.card} aria-labelledby="tos-v4-denied-title">
      <span className={styles.eyebrow}>PINO · TEAM OS</span>
      <h1 id="tos-v4-denied-title">Tài khoản chưa có quyền vào TOS</h1>
      <p>Bạn đã đăng nhập, nhưng tài khoản hiện tại chưa được cấp quyền TOS. Bạn có thể đăng xuất để dùng tài khoản khác.</p>
      <LogoutButton className={styles.switchButton} />
      <p className={styles.note}>Nếu đây là tài khoản Founder, quyền truy cập cần được cấp tại Core. Không cần tạo hồ sơ Staff giả.</p>
    </section>
  </main>;
}
