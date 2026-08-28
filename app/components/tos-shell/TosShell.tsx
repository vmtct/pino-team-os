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

export type BoNavItem = {
  label: string;
  href: string;
};

export type BoNavGroup = {
  label: string;
  items: BoNavItem[];
};

export type BoWorkspaceItem = {
  id: string;
  label: string;
  href: string;
  meta?: string;
};

export type BoWorkspaceSwitcher = {
  activeId: string;
  items: BoWorkspaceItem[];
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

export function BoShell({
  children,
  title = "PINO Team",
  subtitle = "Back Office",
  groups,
  activeHref,
  workspaceSwitcher,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  groups: BoNavGroup[];
  activeHref?: string;
  workspaceSwitcher?: BoWorkspaceSwitcher;
}) {
  const activeWorkspace = workspaceSwitcher?.items.find((item) => item.id === workspaceSwitcher.activeId);

  return (
    <div className={styles.boShell}>
      <aside className={styles.boSidebar}>
        <div className={styles.boBrand}>
          <span className={styles.boMark}>P</span>
          <div>
            <strong>{title}</strong>
            <small>{subtitle}</small>
          </div>
        </div>

        {workspaceSwitcher ? (
          <details className={styles.boWorkspaceSwitcher}>
            <summary>
              <span>Workspace</span>
              <strong>{activeWorkspace?.label ?? "Select"}</strong>
              <b aria-hidden="true">⌄</b>
            </summary>
            <div className={styles.boWorkspaceMenu}>
              {workspaceSwitcher.items.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className={item.id === workspaceSwitcher.activeId ? styles.boWorkspaceActive : undefined}
                >
                  <span>{item.label}</span>
                  {item.meta ? <small>{item.meta}</small> : null}
                </Link>
              ))}
            </div>
          </details>
        ) : null}

        <nav className={styles.boNav} aria-label="Điều hướng Back Office">
          {groups.map((group) => (
            <section key={group.label} className={styles.boNavGroup}>
              <span>{group.label}</span>
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={item.href === activeHref ? styles.boNavActive : undefined}
                  aria-current={item.href === activeHref ? "page" : undefined}
                >
                  {item.label}
                </Link>
              ))}
            </section>
          ))}
        </nav>
      </aside>

      <main className={styles.boMain}>{children}</main>
    </div>
  );
}
