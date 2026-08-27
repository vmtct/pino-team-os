"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import pinoriaStyles from "./pinoria.module.css";
import presenceStyles from "./presence-prototype-layer.module.css";
import styles from "./live-house-polish-layer.module.css";

function addClass(element: Element | null, className: string) {
  if (element instanceof HTMLElement) element.classList.add(className);
}

export function LiveHousePolishLayer({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [headerHost, setHeaderHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const sync = () => {
      const main = root.querySelector<HTMLElement>(`.${pinoriaStyles.main}`);
      addClass(main, styles.mainPolish);

      const sectionHeads = Array.from(root.querySelectorAll<HTMLElement>(`.${pinoriaStyles.sectionHead}`));
      const liveHead = sectionHeads.find((head) => {
        const title = head.querySelector("h1")?.textContent?.trim() ?? "";
        return title === "Live House" || title === "Nhà PINO hôm nay";
      });

      if (!liveHead || !liveHead.parentElement) {
        setHeaderHost(null);
        return;
      }

      // The refined page owns the Live House title so the operational hierarchy is not duplicated.
      liveHead.style.display = "none";
      const parent = liveHead.parentElement;
      const commandHost = parent.querySelector<HTMLElement>("[data-pinoria-ops-command-host]");
      if (!commandHost) return;

      let nextHeaderHost = parent.querySelector<HTMLElement>("[data-pinoria-polish-header-host]");
      if (!nextHeaderHost) {
        nextHeaderHost = document.createElement("div");
        nextHeaderHost.dataset.pinoriaPolishHeaderHost = "true";
        commandHost.insertAdjacentElement("beforebegin", nextHeaderHost);
      }
      setHeaderHost(nextHeaderHost);
      addClass(commandHost, styles.commandHost);

      addClass(commandHost.querySelector(`.${presenceStyles.opsPanel}`), styles.commandCenter);
      addClass(commandHost.querySelector(`.${presenceStyles.opsTop}`), styles.commandTop);
      addClass(commandHost.querySelector(`.${presenceStyles.shiftSummary}`), styles.shiftSummary);
      addClass(commandHost.querySelector(`.${presenceStyles.staffGuard}`), styles.statusCard);
      addClass(commandHost.querySelector(`.${presenceStyles.tvStatus}`), styles.statusCard);
      addClass(commandHost.querySelector(`.${presenceStyles.opsActions}`), styles.commandActions);
      addClass(commandHost.querySelector(`.${presenceStyles.independentNote}`), styles.techNoteHidden);
      addClass(commandHost.querySelector(`.${presenceStyles.attentionHeader}`), styles.attentionHeader);
      addClass(commandHost.querySelector(`.${presenceStyles.attentionGrid}`), styles.attentionGrid);
      commandHost.querySelectorAll(`.${presenceStyles.attentionCard}`).forEach((item) => addClass(item, styles.attentionCard));

      const liveGrid = parent.querySelector<HTMLElement>(`.${pinoriaStyles.liveGrid}`);
      addClass(liveGrid, styles.liveGrid);
      addClass(liveGrid?.querySelector(`.${pinoriaStyles.houseCard}`) ?? null, styles.houseCard);
      addClass(liveGrid?.querySelector(`.${pinoriaStyles.houseMap}`) ?? null, styles.houseMap);

      const listHeader = parent.querySelector<HTMLElement>(`[data-pinoria-presence-list-host] .${presenceStyles.presenceListHeader}`);
      addClass(listHeader, styles.listHeader);

      const learnerGrid = parent.querySelector<HTMLElement>(`.${pinoriaStyles.learnerGrid}`);
      addClass(learnerGrid, styles.learnerGrid);
      learnerGrid?.querySelectorAll<HTMLElement>(`.${pinoriaStyles.learnerCard}`).forEach((card) => {
        addClass(card, styles.learnerCard);
        addClass(card.querySelector(`.${pinoriaStyles.avatar}`), styles.learnerAvatar);
        addClass(card.querySelector(`.${pinoriaStyles.learnerTitle}`), styles.learnerTitle);
        addClass(card.querySelector(`.${pinoriaStyles.learnerTitle} .${pinoriaStyles.badge}`), styles.presenceBadge);
        addClass(card.querySelector(`.${pinoriaStyles.detailRows}`), styles.detailRows);
        card.querySelectorAll(`.${pinoriaStyles.detail}`).forEach((detail) => addClass(detail, styles.detail));
        addClass(card.querySelector(`.${pinoriaStyles.actionStack}`), styles.actionStack);
        addClass(card.querySelector(`.${presenceStyles.cardUtilityRow}`), styles.utilityRow);
      });

      const recent = parent.querySelector<HTMLElement>(`.${presenceStyles.recentCard}`);
      addClass(recent, styles.recentCard);
      addClass(recent?.querySelector(`.${presenceStyles.recentList}`) ?? null, styles.recentList);
      recent?.querySelectorAll(`.${presenceStyles.recentItem}`).forEach((item) => addClass(item, styles.recentItem));
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={rootRef} className={styles.scope}>
      {children}
      {headerHost ? createPortal(
        <header className={styles.pageHeader}>
          <div>
            <span>VẬN HÀNH PINORIA</span>
            <h1>Nhà PINO hôm nay</h1>
            <p>Check-in, theo dõi hiện diện và xử lý những việc cần hoàn tất trước Check-out — trong một màn hình.</p>
          </div>
          <div className={styles.pageContext}>
            <span>RECEPTION OPS</span>
            <strong>Hiện diện trước · trình chiếu sau</strong>
          </div>
        </header>,
        headerHost,
      ) : null}
    </div>
  );
}
