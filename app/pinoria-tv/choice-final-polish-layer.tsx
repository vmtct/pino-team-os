"use client";

import { useEffect, useRef, type ReactNode } from "react";

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleLowerCase("vi-VN");
}

function findTextElement(root: HTMLElement, selector: string, text: string) {
  return Array.from(root.querySelectorAll<HTMLElement>(selector)).find((element) => normalize(element.textContent) === normalize(text)) ?? null;
}

export function ChoiceFinalPolishLayer({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const apply = () => {
      const choiceHeading = Array.from(root.querySelectorAll<HTMLHeadingElement>("h1")).find((heading) => normalize(heading.textContent).includes("muốn mang gì theo hôm nay"));
      if (!choiceHeading) return;

      // Review-only chrome stays available but should disappear from the learner's visual hierarchy.
      const prototypeTag = Array.from(root.querySelectorAll<HTMLElement>("div")).find((element) => normalize(element.textContent).startsWith("tv prototype · core relay simulation"));
      if (prototypeTag) {
        prototypeTag.style.opacity = ".32";
        prototypeTag.style.fontSize = "7px";
        prototypeTag.style.padding = "3px 6px";
        prototypeTag.style.letterSpacing = ".09em";
      }

      const reviewButton = Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find((button) => {
        const text = normalize(button.textContent);
        return text === "duyệt" || text === "điều khiển duyệt";
      });
      if (reviewButton) {
        reviewButton.style.opacity = ".28";
        reviewButton.style.padding = "5px 8px";
        reviewButton.style.fontSize = "8px";
        reviewButton.style.right = "10px";
        reviewButton.style.bottom = "9px";
      }

      const bagTitle = findTextElement(root, "strong", "Túi đồ · đã sở hữu");
      const shopTitle = findTextElement(root, "strong", "Cửa hàng · gợi ý hôm nay");

      const bagMeta = bagTitle?.parentElement?.querySelector<HTMLElement>(":scope > span");
      if (bagMeta) bagMeta.style.display = "none";

      const shopMeta = shopTitle?.parentElement?.querySelector<HTMLElement>(":scope > span");
      if (shopMeta) {
        if (!shopMeta.dataset.balancePolished) {
          const balance = shopMeta.textContent?.trim() || "PLS";
          shopMeta.textContent = `Số dư · ${balance}`;
          shopMeta.dataset.balancePolished = "true";
        }
        shopMeta.style.display = "inline-flex";
        shopMeta.style.alignItems = "center";
        shopMeta.style.padding = "4px 8px";
        shopMeta.style.borderRadius = "999px";
        shopMeta.style.background = "#f0d18a12";
        shopMeta.style.border = "1px solid #f0d18a2c";
        shopMeta.style.color = "#e4d9b8";
        shopMeta.style.fontSize = "9px";
        shopMeta.style.letterSpacing = ".03em";
      }

      const codes = new Set(["A1", "A2", "A3", "B1", "B2", "B3"]);
      root.querySelectorAll<HTMLElement>("b").forEach((codeNode) => {
        const code = codeNode.textContent?.trim().toUpperCase() ?? "";
        if (!codes.has(code)) return;
        const card = codeNode.parentElement;
        if (!card) return;

        const title = card.querySelector<HTMLElement>("strong");
        if (title) {
          title.style.whiteSpace = "normal";
          title.style.overflow = "hidden";
          title.style.textOverflow = "clip";
          title.style.display = "-webkit-box";
          title.style.setProperty("-webkit-line-clamp", "2");
          title.style.setProperty("-webkit-box-orient", "vertical");
          title.style.fontSize = "15px";
          title.style.lineHeight = "1.08";
          title.style.maxWidth = "100%";
        }

        const isHero = code === "B2";
        if (isHero) {
          card.style.background = "radial-gradient(circle at 48% 42%,#e0c77a28,transparent 48%),linear-gradient(145deg,rgba(91,86,50,.78),rgba(42,52,36,.9))";
          card.style.borderColor = "#d8c77870";
          card.style.boxShadow = "0 0 24px #d8bd7212,inset 0 1px 0 #ffffff10";
          const heroBadge = Array.from(card.querySelectorAll<HTMLElement>("span")).find((span) => normalize(span.textContent) === "gợi ý");
          if (heroBadge) {
            heroBadge.style.right = "16px";
            heroBadge.style.top = "14px";
            heroBadge.style.padding = "4px 8px";
            heroBadge.style.background = "#d7c47f";
            heroBadge.style.opacity = ".9";
          }
        } else {
          // Opaque-enough cards stop the center spotlight from making A2 look accidentally featured.
          card.style.background = "linear-gradient(145deg,rgba(49,64,45,.86),rgba(28,39,27,.9))";
          card.style.borderColor = code.startsWith("B") ? "#c9b9753e" : "#ffffff1c";
          card.style.boxShadow = "inset 0 1px 0 #ffffff08";
        }
      });
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(root, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  return <div ref={rootRef} style={{ display: "contents" }}>{children}</div>;
}
