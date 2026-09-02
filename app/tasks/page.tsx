import { TosShell } from "@/app/components/tos-shell";
import { TOS_TASKS_FOOTER } from "@/app/components/tos-shell/navigation";
import styles from "./tasks.module.css";

export default function TasksPage() {
  return (
    <TosShell
      title="Việc"
      subtitle="Việc cần xử lý"
      theme="tasks"
      footerItems={TOS_TASKS_FOOTER}
      activeFooterId="all"
    >
      <section className={styles.empty}>
        <span>ATTENTION INBOX</span>
        <h2>Chưa có việc cần xử lý</h2>
        <p>
          Khi các app có việc cần bạn xử lý, chúng sẽ xuất hiện tại đây và dẫn về đúng nơi để thao tác.
        </p>
      </section>
    </TosShell>
  );
}
