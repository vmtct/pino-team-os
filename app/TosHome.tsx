import Link from "next/link";
import { TosShell } from "@/app/components/tos-shell";
import { TOS_HOME_FOOTER } from "@/app/components/tos-shell/navigation";
import styles from "./tos-home.module.css";

const apps = [
  { id: "shift", title: "Ca làm", copy: "Check-in/out, lịch, đăng ký và chấm công của bạn.", href: "/dashboard", icon: "◷", tone: styles.shift },
  { id: "classroom", title: "Lớp học", copy: "Lớp hôm nay, học viên, giáo án, journal và thành tựu.", href: "/classroom", icon: "▤", tone: styles.classroom },
  { id: "tasks", title: "Việc", copy: "Những việc cần xử lý theo đúng ngữ cảnh công việc.", href: "/tasks", icon: "◌", tone: styles.tasks },
  { id: "training", title: "Đào tạo & Chứng nhận", copy: "Training bắt buộc, skill passport và qualification của bạn.", href: "/training", icon: "◇", tone: styles.tasks },
  { id: "pinoria", title: "Pinoria", copy: "Hiện diện House và các thao tác Pinoria được phân quyền.", href: "/pinoria", icon: "◈", tone: styles.pinoria },
] as const;

function todayLabel() {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date());
}

export default function TosHome() {
  return (
    <TosShell
      title="PINO Team"
      subtitle={todayLabel()}
      theme="home"
      footerItems={TOS_HOME_FOOTER}
      activeFooterId="home"
      home
    >
      <div className={styles.page}>
        <section className={styles.intro}>
          <span>TEAM OPS</span>
          <h2>Hôm nay bạn làm gì?</h2>
          <p>Chọn đúng app theo context công việc. Khi vào app, thanh dưới sẽ đổi thành navigation riêng của app đó.</p>
        </section>

        <section className={styles.launcher} aria-label="Ứng dụng PINO Team">
          {apps.map((app) => (
            <Link key={app.id} href={app.href} className={`${styles.appCard} ${app.tone}`}>
              <span className={styles.appIcon}>{app.icon}</span>
              <span className={styles.appCopy}>
                <strong>{app.title}</strong>
                <small>{app.copy}</small>
              </span>
              <span className={styles.arrow}>›</span>
            </Link>
          ))}
        </section>

        <Link className={styles.profileLink} href="/info">Hồ sơ của tôi <span>›</span></Link>
      </div>
    </TosShell>
  );
}
