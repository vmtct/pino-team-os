"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { prototypeChoiceAssets } from "./prototype-assets";

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleLowerCase("vi-VN");
}

const codeToNumber: Record<string, string> = {
  A1: "1",
  A2: "2",
  A3: "3",
  B1: "4",
  B2: "5",
  B3: "6",
};

const ownedStatus: Record<string, string> = {
  A1: "Đang mang",
  A2: "Đã có",
  A3: "Giữ nguyên",
};

type VisualConfig = {
  title: string;
  src?: string;
  scale?: number;
  x?: number;
  y?: number;
};

// These source PNGs are registration-canvas layers (2048×2048), not cropped thumbnails.
// Each preview therefore needs a slot-aware crop to bring the painted pixels into the 62px medallion.
const visualByCode: Record<string, VisualConfig> = {
  A1: { title: prototypeChoiceAssets.A1.displayName, src: prototypeChoiceAssets.A1.src, scale: 3.2, x: 0, y: 45 },
  A2: { title: prototypeChoiceAssets.A2.displayName, src: prototypeChoiceAssets.A2.src, scale: 3.15, x: 0, y: 10 },
  A3: { title: "Giữ hiện tại" },
  B1: { title: prototypeChoiceAssets.B1.displayName, src: prototypeChoiceAssets.B1.src, scale: 1.25, x: 0, y: 0 },
  B2: { title: prototypeChoiceAssets.B2.displayName, src: prototypeChoiceAssets.B2.src, scale: 1.4, x: 0, y: 1 },
  B3: { title: prototypeChoiceAssets.B3.displayName, src: prototypeChoiceAssets.B3.src, scale: 2.35, x: 0, y: 11 },
};

export function ChoiceFinalPolishLayer({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const style = document.createElement("style");
    style.dataset.pinoriaChoicePolish = "true";
    style.textContent = `
      @keyframes pinoriaChoiceHeaderIn {
        from { opacity: 0; transform: translateY(-16px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes pinoriaChoiceBagIn {
        from { opacity: 0; transform: translateX(-34px) scale(.985); }
        to { opacity: 1; transform: translateX(0) scale(1); }
      }
      @keyframes pinoriaChoiceShopIn {
        from { opacity: 0; transform: translateX(34px) scale(.985); }
        to { opacity: 1; transform: translateX(0) scale(1); }
      }
      @keyframes pinoriaChoiceCardIn {
        from { opacity: 0; transform: translateY(16px) scale(.955); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes pinoriaChoiceTimer {
        from { transform: scaleX(1); }
        to { transform: scaleX(.05); }
      }
      .pinoriaChoiceHeader {
        animation: pinoriaChoiceHeaderIn .48s cubic-bezier(.2,.82,.2,1) both;
      }
      .pinoriaChoiceHeader h1 {
        font-size: clamp(36px,3.75vw,50px) !important;
      }
      .pinoriaChoiceTimerBar {
        transform-origin: left center;
        animation: pinoriaChoiceTimer 8s linear both;
      }
      .pinoriaChoiceGroup {
        box-sizing: border-box !important;
        padding: 10px 12px 12px !important;
        border-radius: 24px !important;
        gap: 8px !important;
        overflow: hidden;
        position: relative;
      }
      .pinoriaChoiceGroupBag {
        background: linear-gradient(115deg,rgba(27,48,31,.78),rgba(21,37,26,.63)) !important;
        border: 1px solid rgba(203,224,197,.13) !important;
        animation: pinoriaChoiceBagIn .55s .20s cubic-bezier(.2,.82,.2,1) both;
      }
      .pinoriaChoiceGroupShop {
        background: linear-gradient(115deg,rgba(91,76,35,.38),rgba(49,48,27,.55)) !important;
        border: 1px solid rgba(229,202,116,.34) !important;
        box-shadow: 0 16px 38px rgba(8,12,7,.12), inset 0 1px 0 rgba(255,245,197,.05) !important;
        animation: pinoriaChoiceShopIn .55s .42s cubic-bezier(.2,.82,.2,1) both;
      }
      .pinoriaChoiceGroupBag > div:first-child strong { color: #d7e8cf !important; }
      .pinoriaChoiceGroupShop > div:first-child strong { color: #f3d681 !important; }
      .pinoriaChoiceGroup > div:first-child strong {
        font-size: 11px !important;
        letter-spacing: .16em !important;
      }
      .pinoriaChoiceGroup > div:first-child > span {
        font-size: 9px !important;
        letter-spacing: .02em !important;
      }
      .pinoriaChoiceCard {
        opacity: 0;
        animation: pinoriaChoiceCardIn .42s cubic-bezier(.18,.82,.2,1) forwards;
      }
      .pinoriaChoiceCard[data-choice-order="1"] { animation-delay: .43s; }
      .pinoriaChoiceCard[data-choice-order="2"] { animation-delay: .51s; }
      .pinoriaChoiceCard[data-choice-order="3"] { animation-delay: .59s; }
      .pinoriaChoiceCard[data-choice-order="4"] { animation-delay: .73s; }
      .pinoriaChoiceCard[data-choice-order="5"] { animation-delay: .81s; }
      .pinoriaChoiceCard[data-choice-order="6"] { animation-delay: .89s; }
      .pinoriaChoiceCardOwned {
        background: linear-gradient(145deg,rgba(36,58,39,.93),rgba(24,42,29,.94)) !important;
        border-color: rgba(214,231,207,.13) !important;
        box-shadow: inset 0 1px 0 rgba(255,255,255,.05) !important;
      }
      .pinoriaChoiceCardShop {
        background: linear-gradient(145deg,rgba(74,67,39,.78),rgba(37,45,29,.92)) !important;
        border-color: rgba(226,200,116,.30) !important;
        box-shadow: inset 0 1px 0 rgba(255,244,198,.045) !important;
      }
      .pinoriaChoiceCardFeatured {
        background: radial-gradient(circle at 48% 42%,rgba(227,199,112,.22),transparent 50%),linear-gradient(145deg,rgba(99,87,45,.83),rgba(43,50,31,.94)) !important;
        border-color: rgba(230,205,126,.58) !important;
        box-shadow: 0 0 28px rgba(216,189,114,.10), inset 0 1px 0 rgba(255,255,255,.08) !important;
      }
      .pinoriaChoiceNumber {
        width: 44px !important;
        height: 44px !important;
        border-radius: 15px !important;
        font-size: 20px !important;
        letter-spacing: 0 !important;
        box-shadow: inset 0 0 0 1px rgba(255,255,255,.08), 0 8px 18px rgba(0,0,0,.12) !important;
      }
      .pinoriaChoiceCardOwned .pinoriaChoiceNumber {
        background: #203524 !important;
        color: #e5efdc !important;
      }
      .pinoriaChoiceCardShop .pinoriaChoiceNumber {
        background: #3c3823 !important;
        color: #f4d77d !important;
      }
      .pinoriaChoiceVisualHost {
        position: relative !important;
        overflow: hidden !important;
        isolation: isolate;
      }
      .pinoriaChoiceAsset {
        position: absolute !important;
        left: 50% !important;
        top: 50% !important;
        width: 100% !important;
        height: 100% !important;
        max-width: none !important;
        object-fit: contain !important;
        pointer-events: none !important;
        user-select: none !important;
        filter: drop-shadow(0 5px 8px rgba(0,0,0,.18));
      }
      @media (prefers-reduced-motion: reduce) {
        .pinoriaChoiceHeader,.pinoriaChoiceGroup,.pinoriaChoiceCard,.pinoriaChoiceTimerBar {
          animation: none !important;
          opacity: 1 !important;
          transform: none !important;
        }
      }
    `;
    root.appendChild(style);

    let observer: MutationObserver;
    let raf = 0;

    const polish = () => {
      const choiceHeading = Array.from(root.querySelectorAll<HTMLHeadingElement>("h1")).find((heading) => normalize(heading.textContent).includes("muốn mang gì theo hôm nay"));
      if (!choiceHeading) return;

      const header = choiceHeading.parentElement;
      if (header) {
        header.classList.add("pinoriaChoiceHeader");
        const instruction = header.querySelector<HTMLParagraphElement>("p");
        if (instruction) instruction.textContent = "Nói số 1 đến 6 để thầy cô chọn giúp con.";
        header.querySelector<HTMLElement>("[aria-label='Còn 8 giây'] i")?.classList.add("pinoriaChoiceTimerBar");
      }

      const prototypeTag = Array.from(root.querySelectorAll<HTMLElement>("div")).find((element) => normalize(element.textContent).startsWith("tv prototype · core relay simulation"));
      if (prototypeTag) {
        prototypeTag.style.opacity = ".25";
        prototypeTag.style.fontSize = "7px";
        prototypeTag.style.padding = "3px 6px";
      }

      const reviewButton = Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find((button) => {
        const text = normalize(button.textContent);
        return text === "duyệt" || text === "điều khiển duyệt";
      });
      if (reviewButton) {
        reviewButton.style.opacity = ".22";
        reviewButton.style.padding = "5px 8px";
        reviewButton.style.fontSize = "8px";
      }

      const strongs = Array.from(root.querySelectorAll<HTMLElement>("strong"));
      const bagTitle = strongs.find((element) => normalize(element.textContent).includes("túi đồ")) ?? null;
      const shopTitle = strongs.find((element) => normalize(element.textContent).includes("cửa hàng")) ?? null;

      const bagSection = bagTitle?.parentElement?.parentElement;
      if (bagTitle && bagSection) {
        bagTitle.textContent = "TÚI ĐỒ CỦA CON";
        bagSection.classList.add("pinoriaChoiceGroup", "pinoriaChoiceGroupBag");
        const bagMeta = bagTitle.parentElement?.querySelector<HTMLElement>(":scope > span");
        if (bagMeta) {
          bagMeta.textContent = "Con đang có sẵn";
          bagMeta.style.display = "inline-flex";
          bagMeta.style.padding = "3px 7px";
          bagMeta.style.borderRadius = "999px";
          bagMeta.style.color = "#bfcdb8";
          bagMeta.style.background = "#dcebd60a";
          bagMeta.style.border = "1px solid #dcebd612";
        }
      }

      const shopSection = shopTitle?.parentElement?.parentElement;
      if (shopTitle && shopSection) {
        shopTitle.textContent = "CỬA HÀNG HÔM NAY";
        shopSection.classList.add("pinoriaChoiceGroup", "pinoriaChoiceGroupShop");
        const shopMeta = shopTitle.parentElement?.querySelector<HTMLElement>(":scope > span");
        if (shopMeta) {
          const balanceMatch = shopMeta.textContent?.match(/\d[\d.]*/u)?.[0] ?? "";
          shopMeta.textContent = balanceMatch ? `Đổi bằng PLS · ${balanceMatch} PLS hiện có` : "Đổi bằng PLS";
          shopMeta.style.display = "inline-flex";
          shopMeta.style.padding = "4px 8px";
          shopMeta.style.borderRadius = "999px";
          shopMeta.style.background = "#f0d18a14";
          shopMeta.style.border = "1px solid #f0d18a34";
          shopMeta.style.color = "#eadba7";
        }
      }

      root.querySelectorAll<HTMLElement>("b").forEach((codeNode) => {
        const raw = codeNode.dataset.choiceCode || codeNode.textContent?.trim().toUpperCase() || "";
        const code = raw in codeToNumber ? raw : "";
        if (!code) return;

        codeNode.dataset.choiceCode = code;
        codeNode.textContent = codeToNumber[code];
        codeNode.classList.add("pinoriaChoiceNumber");

        const card = codeNode.parentElement;
        if (!card) return;
        card.dataset.choiceOrder = codeToNumber[code];
        card.classList.add("pinoriaChoiceCard");
        const isShop = code.startsWith("B");
        card.classList.toggle("pinoriaChoiceCardOwned", !isShop);
        card.classList.toggle("pinoriaChoiceCardShop", isShop);
        card.classList.toggle("pinoriaChoiceCardFeatured", code === "B2");

        const visual = visualByCode[code];
        const title = card.querySelector<HTMLElement>("strong");
        if (title) {
          if (visual?.title) title.textContent = visual.title;
          title.style.whiteSpace = "normal";
          title.style.overflow = "hidden";
          title.style.display = "-webkit-box";
          title.style.setProperty("-webkit-line-clamp", "2");
          title.style.setProperty("-webkit-box-orient", "vertical");
          title.style.fontSize = "15px";
          title.style.lineHeight = "1.08";
        }

        const visualHost = card.children.item(1);
        if (visualHost instanceof HTMLElement) {
          visualHost.classList.add("pinoriaChoiceVisualHost");
          if (visual?.src) {
            let image = visualHost.querySelector<HTMLImageElement>("[data-pinoria-choice-asset]");
            if (!image) {
              visualHost.replaceChildren();
              image = document.createElement("img");
              image.src = visual.src;
              image.alt = "";
              image.decoding = "async";
              image.loading = "eager";
              image.draggable = false;
              image.dataset.pinoriaChoiceAsset = code;
              image.className = "pinoriaChoiceAsset";
              visualHost.appendChild(image);
            }
            image.style.transform = `translate(-50%, -50%) translate(${visual.x ?? 0}%, ${visual.y ?? 0}%) scale(${visual.scale ?? 1})`;
          }
        }

        const detailPills = Array.from(card.querySelectorAll<HTMLElement>("span"));
        if (!isShop && ownedStatus[code]) {
          const statusPill = detailPills.find((node) => {
            const text = normalize(node.textContent);
            return text.includes("trang bị") || text.includes("sở hữu") || text.includes("không đổi") || text.includes("đang mang") || text === "đã có" || text === "giữ nguyên";
          });
          if (statusPill) statusPill.textContent = ownedStatus[code];
        }

        if (isShop) {
          const price = code === "B1" ? prototypeChoiceAssets.B1.price : code === "B2" ? prototypeChoiceAssets.B2.price : code === "B3" ? prototypeChoiceAssets.B3.price : null;
          if (price) {
            const pricePill = detailPills.find((node) => /pls/u.test(normalize(node.textContent)));
            if (pricePill) pricePill.textContent = price;
          }
        }

        if (code === "B2") {
          const heroBadge = detailPills.find((span) => normalize(span.textContent) === "gợi ý");
          if (heroBadge) {
            heroBadge.style.right = "16px";
            heroBadge.style.top = "14px";
            heroBadge.style.padding = "4px 8px";
            heroBadge.style.background = "#d9c47b";
            heroBadge.style.opacity = ".88";
          }
        }
      });
    };

    const schedulePolish = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        observer.disconnect();
        polish();
        observer.observe(root, { subtree: true, childList: true });
      });
    };

    observer = new MutationObserver(schedulePolish);
    observer.observe(root, { subtree: true, childList: true });
    polish();

    return () => {
      observer.disconnect();
      if (raf) cancelAnimationFrame(raf);
      style.remove();
    };
  }, []);

  return <div ref={rootRef} style={{ display: "contents" }}>{children}</div>;
}
