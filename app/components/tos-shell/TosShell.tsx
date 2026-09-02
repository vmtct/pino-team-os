import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./tos-shell.module.css";

export type TosAppTheme = "home" | "shift" | "classroom" | "tasks" | "pinoria";

export type TosFooterItem = {
  id: string;
  label: string;
  href: string;
  icon?: ReactNode;
};

function assertFooterLimit(items: TosFooterItem[]) {
  if (items.length > 5) {
    throw new Error("TOS contextual footer navigation is limited to 5 items by Team Surface Doctrine v1.");
  }
}

const themeClass: Record<TosAppTheme, string> = {
  home: styles.themeHome,
  shift: styles.themeShift,
  classroom: styles.themeClassroom,
  tasks: styles.themeTasks,
  pinoria: styles.themePinoria,
};

export function TosShell({
  children,
  title,
  subtitle,
  theme = "home",
  homeHref = "/",
  backHref,
  footerItems,
  activeFooterId,
  home = false,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  theme?: TosAppTheme;
  homeHref?: string;
  backHref?: string;
  footerItems: TosFooterItem[];
  activeFooterId?: string;
  home?: boolean;
}) {
  assertFooterLimit(footerItems);

  return (
    <div className={`${styles.opsShell} ${themeClass[theme]}`}>
      <header className={styles.opsHeader}>
        <div className={styles.opsHeaderCopy}>
          <span className={styles.opsKicker}>{home ? "PINO TEAM · TOS" : "TOS APP"}</span>
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        <div className={styles.opsHeaderActions}>
          {backHref ? (
            <Link className={styles.iconButton} href={backHref} aria-label="Quay lại">
              ←
            </Link>
          ) : null}
          {!home ? (
            <Link className={styles.iconButton} href={homeHref} aria-label="Về Home">
              ⌂
            </Link>
          ) : null}
        </div>
      </header>

      <main className={styles.opsContent}>{children}</main>

      <nav
        className={`${styles.opsFooter} ${home ? styles.opsFooterHome : styles.opsFooterFeature}`}
        aria-label={home ? "Điều hướng ứng dụng TOS" : `Điều hướng ${title}`}
      >
        {footerItems.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={item.id === activeFooterId ? styles.footerActive : undefined}
            aria-current={item.id === activeFooterId ? "page" : undefined}
          >
            {item.icon ? <span className={styles.footerIcon}>{item.icon}</span> : null}
            <small>{item.label}</small>
          </Link>
        ))}
      </nav>
    </div>
  );
}

