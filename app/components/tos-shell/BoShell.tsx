"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import styles from "./bo-shell.module.css";

export type BoNavChild = {
  label: string;
  href: string;
};

export type BoNavItem = {
  label: string;
  href?: string;
  children?: BoNavChild[];
};

export type BoNavGroup = {
  label: string;
  items: BoNavItem[];
};

type FlatDestination = {
  group: string;
  label: string;
  href: string;
};function pathMatches(pathname: string, href?: string) {
  if (!href) return false;
  if (href === "/bo") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function itemIsActive(pathname: string, item: BoNavItem) {
  return pathMatches(pathname, item.href) || Boolean(item.children?.some((child) => pathMatches(pathname, child.href)));
}

export function BoShell({
  children,
  title = "PINO House",
  subtitle = "Back Office",
  groups,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  groups: BoNavGroup[];
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [query, setQuery] = useState("");

  const destinations = useMemo(() => groups.flatMap((group) => group.items.flatMap((item) => {
    const own = item.href ? [{ group: group.label, label: item.label, href: item.href }] : [];
    const children = (item.children ?? []).map((child) => ({ group: item.label, label: child.label, href: child.href }));
    return [...own, ...children];
  })), [groups]);  const activeContext = useMemo(() => {
    for (const group of groups) {
      const item = group.items.find((candidate) => itemIsActive(pathname, candidate));
      if (item) return { group: group.label, item: item.label };
    }
    return { group: "Back Office", item: "Workspace" };
  }, [groups, pathname]);

  const filteredDestinations = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return destinations;
    return destinations.filter((item) => `${item.group} ${item.label}`.toLowerCase().includes(normalized));
  }, [destinations, query]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
      if (event.key === "Escape") {
        setCommandOpen(false);
        setMenuOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function closeNavigation() {
    setMenuOpen(false);
    setCommandOpen(false);
    setQuery("");
  }  return (
    <div className={styles.shell}>
      <aside className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ""}`}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>P</span>
          <div><strong>{title}</strong><small>{subtitle}</small></div>
          <button className={styles.closeMenu} type="button" onClick={() => setMenuOpen(false)} aria-label="Đóng menu">×</button>
        </div>
        <div className={styles.foundationBadge}>PLT-BO · CANONICAL</div>

        <nav className={styles.nav} aria-label="Điều hướng Back Office">
          {groups.map((group) => (
            <section className={styles.navGroup} key={group.label}>
              <span>{group.label}</span>
              {group.items.map((item) => {
                const active = itemIsActive(pathname, item);
                return (
                  <div key={`${group.label}:${item.label}`}>
                    {item.href ? (
                      <Link href={item.href} className={active ? styles.navActive : undefined} onClick={closeNavigation} aria-current={pathMatches(pathname, item.href) ? "page" : undefined}>
                        <i aria-hidden="true" /><b>{item.label}</b>
                      </Link>
                    ) : (
                      <span className={styles.navDisabled} aria-disabled="true"><i aria-hidden="true" /><b>{item.label}</b><small>Chưa tích hợp</small></span>
                    )}
                    {active && item.children?.length ? (
                      <div className={styles.subnav} aria-label={`${item.label} context`}>
                        {item.children.map((child) => <Link key={child.href} href={child.href} className={pathMatches(pathname, child.href) ? styles.subnavActive : undefined} onClick={closeNavigation}>{child.label}</Link>)}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </section>
          ))}
        </nav>        <div className={styles.sidebarFooter}>
          <span className={styles.footerMark}>BO</span>
          <div><strong>Canonical surface</strong><small>Authority stays in Core</small></div>
        </div>
      </aside>

      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <button className={styles.menuButton} type="button" onClick={() => setMenuOpen(true)} aria-label="Mở menu">☰</button>
          <div className={styles.context}>
            <span>{activeContext.group}</span>
            <strong>{activeContext.item}</strong>
          </div>
          <button className={styles.commandButton} type="button" onClick={() => setCommandOpen(true)} aria-label="Mở điều hướng nhanh">
            <span>Tìm màn hình…</span><kbd>Ctrl K</kbd>
          </button>
          <span className={styles.surfaceChip}>BO</span>
        </header>
        <main className={styles.main}>{children}</main>
      </div>

      {menuOpen ? <button className={styles.scrim} type="button" onClick={() => setMenuOpen(false)} aria-label="Đóng menu" /> : null}
      {commandOpen ? (
        <div className={styles.commandScrim} onMouseDown={() => setCommandOpen(false)}>
          <section className={styles.commandPalette} onMouseDown={(event) => event.stopPropagation()} aria-label="Điều hướng nhanh">
            <div className={styles.commandInput}>
              <span aria-hidden="true">⌕</span>
              <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Đi tới…" aria-label="Tìm màn hình Back Office" />
              <kbd>ESC</kbd>
            </div>
            <small className={styles.commandLabel}>Đi nhanh</small>            <div className={styles.commandResults}>
              {filteredDestinations.length ? filteredDestinations.map((item) => (
                <Link key={`${item.group}:${item.href}`} href={item.href} onClick={closeNavigation}>
                  <span>{item.label}</span><small>{item.group}</small>
                </Link>
              )) : <p>Không có màn hình phù hợp.</p>}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}