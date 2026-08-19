"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type ArrivalData = {
  name: string;
  greeting: string;
  path: string;
  companion: string;
  companionName: string;
  artifacts: string[];
};

function normalize(value: string | null | undefined) {
  return (value ?? "").trim();
}

function parseArrival(root: HTMLElement): { data: ArrivalData; layout: HTMLElement } | null {
  const heading = Array.from(root.querySelectorAll<HTMLHeadingElement>("h1")).find((node) => normalize(node.textContent).startsWith("Chào "));
  if (!heading) return null;

  const copyColumn = heading.parentElement;
  const layout = copyColumn?.parentElement;
  if (!(copyColumn instanceof HTMLElement) || !(layout instanceof HTMLElement)) return null;

  const rawName = normalize(heading.textContent).replace(/^Chào\s+/u, "").replace(/\s*✦\s*$/u, "");
  const greeting = normalize(copyColumn.querySelector("p")?.textContent) || `“Một buổi học mới bắt đầu rồi!”`;
  const path = Array.from(copyColumn.querySelectorAll<HTMLElement>("span")).map((node) => normalize(node.textContent)).find((text) => /ArtChitect|PianoHouse|Little Piner|Open Studio/u.test(text)) ?? "";
  const companion = Array.from(layout.querySelectorAll<HTMLElement>("small")).map((node) => normalize(node.textContent)).find((text) => text.includes(" · ")) ?? "";
  const companionName = companion ? companion.split(" · ")[0] : "";
  const artifacts = Array.from(layout.querySelectorAll<HTMLElement>("strong"))
    .map((node) => normalize(node.textContent))
    .filter((text) => text && text !== rawName && !text.startsWith("Chào "))
    .slice(0, 2);

  return {
    layout,
    data: { name: rawName, greeting, path, companion, companionName, artifacts },
  };
}

export function ArrivalPolishLayer({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [arrival, setArrival] = useState<ArrivalData | null>(null);
  const signatureRef = useRef("");

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let overlayHost = root.querySelector<HTMLElement>("[data-pinoria-arrival-polish-host]");
    if (!overlayHost) {
      overlayHost = document.createElement("div");
      overlayHost.dataset.pinoriaArrivalPolishHost = "true";
      root.appendChild(overlayHost);
    }
    setHost(overlayHost);

    const apply = () => {
      const parsed = parseArrival(root);
      if (!parsed) {
        if (signatureRef.current) {
          signatureRef.current = "";
          setArrival(null);
        }
        return;
      }

      parsed.layout.style.display = "none";

      const technicalFooter = Array.from(root.querySelectorAll<HTMLElement>("div")).find((node) => normalize(node.textContent).startsWith("Full character + active"));
      if (technicalFooter) technicalFooter.style.display = "none";

      const prototypeTag = Array.from(root.querySelectorAll<HTMLElement>("div")).find((node) => {
        const text = normalize(node.textContent).toLocaleLowerCase("vi-VN");
        return text.startsWith("tv prototype · core relay simulation") || text.startsWith("phát lại · chào đến");
      });
      if (prototypeTag) {
        prototypeTag.style.opacity = ".32";
        prototypeTag.style.fontSize = "7px";
        prototypeTag.style.padding = "3px 6px";
        prototypeTag.style.letterSpacing = ".09em";
      }

      const reviewButton = Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find((button) => {
        const text = normalize(button.textContent).toLocaleLowerCase("vi-VN");
        return text.includes("review controls") || text.includes("điều khiển duyệt") || text === "duyệt";
      });
      if (reviewButton) {
        reviewButton.textContent = "Duyệt";
        reviewButton.style.opacity = ".28";
        reviewButton.style.padding = "5px 8px";
        reviewButton.style.fontSize = "8px";
        reviewButton.style.right = "10px";
        reviewButton.style.bottom = "9px";
        reviewButton.style.background = "#172019cc";
        reviewButton.style.color = "#d9d3c8";
        reviewButton.style.border = "1px solid #ffffff18";
      }

      const signature = JSON.stringify(parsed.data);
      if (signature !== signatureRef.current) {
        signatureRef.current = signature;
        setArrival(parsed.data);
      }
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(root, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={rootRef} style={{ display: "contents" }}>
      {children}
      {host && arrival ? createPortal(<ArrivalScene data={arrival} />, host) : null}
    </div>
  );
}

function ArrivalScene({ data }: { data: ArrivalData }) {
  const initial = data.name.slice(0, 1).toUpperCase() || "P";
  const companionInitial = data.companionName.slice(0, 1).toUpperCase() || "✦";

  return (
    <div className="pinoriaArrivalPolish" aria-label={`Chào đến ${data.name}`}>
      <style>{`
        @keyframes pinoriaArrivalCopy { 0% { opacity:0; transform:translateY(18px) } 24% { opacity:0; transform:translateY(18px) } 48%,100% { opacity:1; transform:translateY(0) } }
        @keyframes pinoriaArrivalCharacter { 0% { opacity:0; transform:translateX(64px) scale(.92) } 12% { opacity:0 } 43% { opacity:1; transform:translateX(0) scale(1.015) } 58%,100% { opacity:1; transform:translateX(0) scale(1) } }
        @keyframes pinoriaArrivalCompanion { 0%,34% { opacity:0; transform:translate(24px,18px) scale(.62) } 58% { opacity:1; transform:translate(-4px,-4px) scale(1.05) } 70%,100% { opacity:1; transform:translate(0,0) scale(1) } }
        @keyframes pinoriaArrivalArtifact { 0%,55% { opacity:0; transform:translateY(12px) scale(.92) } 78%,100% { opacity:1; transform:translateY(0) scale(1) } }
        @keyframes pinoriaArrivalGlow { 0%,100% { opacity:.48; transform:scale(.96) } 50% { opacity:.78; transform:scale(1.04) } }
        .pinoriaArrivalPolish { position:absolute; inset:0; z-index:12; box-sizing:border-box; overflow:hidden; pointer-events:none; display:grid; grid-template-columns:minmax(0,.8fr) minmax(480px,1.2fr); align-items:center; gap:38px; padding:78px clamp(70px,7.2vw,112px) 58px; color:#fff; }
        .pinoriaArrivalCopy { max-width:560px; animation:pinoriaArrivalCopy 6.2s cubic-bezier(.2,.75,.2,1) both; }
        .pinoriaArrivalKicker { display:block; margin-bottom:12px; color:#e7c77a; font-size:11px; font-weight:900; letter-spacing:.18em; text-transform:uppercase; }
        .pinoriaArrivalTitle { margin:0 0 16px; font-size:clamp(50px,5.2vw,72px); line-height:.94; letter-spacing:-.05em; }
        .pinoriaArrivalQuote { margin:0; max-width:520px; color:#eee6d7; font-size:clamp(19px,1.75vw,24px); line-height:1.42; }
        .pinoriaArrivalIdentity { display:flex; flex-wrap:wrap; gap:8px; margin-top:26px; }
        .pinoriaArrivalChip { display:inline-flex; align-items:center; gap:7px; min-height:30px; padding:6px 10px; border-radius:999px; background:#ffffff0b; border:1px solid #ffffff1b; color:#dfe4da; font-size:10px; }
        .pinoriaArrivalChip strong { color:#f0d58d; font-size:9px; letter-spacing:.06em; text-transform:uppercase; }
        .pinoriaArrivalStage { position:relative; width:min(590px,46vw); height:min(520px,68vh); justify-self:end; display:grid; place-items:center; animation:pinoriaArrivalCharacter 6.2s cubic-bezier(.18,.8,.2,1) both; }
        .pinoriaArrivalHalo { position:absolute; width:78%; aspect-ratio:1; border-radius:50%; background:radial-gradient(circle,#e5d58c30 0,#c7bf7d12 38%,transparent 72%); filter:blur(3px); animation:pinoriaArrivalGlow 3.8s ease-in-out infinite; }
        .pinoriaArrivalRing { position:absolute; width:69%; aspect-ratio:1; border-radius:50%; border:1px solid #ead89322; box-shadow:0 0 50px #dfcd7720; }
        .pinoriaArrivalShadow { position:absolute; left:30%; right:16%; bottom:7%; height:34px; border-radius:50%; background:#050b0680; filter:blur(15px); }
        .pinoriaArrivalFigure { position:relative; width:280px; height:390px; margin-right:45px; }
        .pinoriaArrivalHead { position:absolute; left:50%; top:14px; width:144px; height:144px; transform:translateX(-50%); border-radius:46% 46% 43% 43%; background:linear-gradient(180deg,#efd5bc,#d9b994); border:6px solid #293626; box-shadow:0 16px 36px #0003; }
        .pinoriaArrivalHair { position:absolute; inset:-4px 5px auto; height:56px; border-radius:55% 55% 34% 34%; background:#31432d; }
        .pinoriaArrivalHair:after { content:'⌁'; position:absolute; right:20px; top:13px; color:#e0bd6f; font-size:35px; font-weight:900; transform:rotate(10deg); }
        .pinoriaArrivalFace { position:absolute; inset:66px 0 auto; text-align:center; color:#57473a; font-size:14px; font-weight:900; letter-spacing:.08em; }
        .pinoriaArrivalBody { position:absolute; left:50%; top:142px; width:224px; height:228px; transform:translateX(-50%); border-radius:46px 46px 72px 72px; background:linear-gradient(180deg,#7c916f,#5f7657); border:6px solid #293626; box-shadow:0 26px 50px #0004; overflow:hidden; }
        .pinoriaArrivalSash { position:absolute; left:0; right:0; top:38px; height:43px; display:grid; place-items:center; background:#d4b998; color:#41392f; font-size:19px; font-weight:900; letter-spacing:.04em; }
        .pinoriaArrivalMark { position:absolute; left:50%; bottom:41px; transform:translateX(-50%); width:58px; height:58px; border-radius:50%; display:grid; place-items:center; background:#f1e1b7; color:#567052; font-size:26px; font-weight:900; box-shadow:0 10px 22px #0002; }
        .pinoriaArrivalCompanion { position:absolute; z-index:3; right:12px; bottom:44px; width:150px; display:grid; justify-items:center; gap:6px; animation:pinoriaArrivalCompanion 6.2s cubic-bezier(.18,.82,.2,1) both; }
        .pinoriaArrivalCompanionBody { width:112px; height:112px; border-radius:52% 52% 44% 44%; background:linear-gradient(145deg,#e3aa7d,#bd7e58); border:6px solid #925f45; color:#fff; display:grid; place-items:center; font-size:38px; font-weight:900; box-shadow:0 18px 36px #0004; }
        .pinoriaArrivalCompanionLabel { max-width:180px; padding:5px 9px; border-radius:999px; background:#142016d9; border:1px solid #ffffff18; color:#efe6d8; font-size:9px; white-space:nowrap; }
        .pinoriaArrivalArtifacts { position:absolute; left:5%; top:22%; display:grid; gap:9px; animation:pinoriaArrivalArtifact 6.2s ease both; }
        .pinoriaArrivalArtifact { min-width:132px; padding:9px 11px; border-radius:14px; background:#182219b8; border:1px solid #ead78b2d; box-shadow:0 12px 30px #0002; display:grid; grid-template-columns:28px 1fr; gap:8px; align-items:center; }
        .pinoriaArrivalArtifact i { width:27px; height:27px; border-radius:50%; display:grid; place-items:center; background:#ecd68a18; color:#e9ca74; font-style:normal; }
        .pinoriaArrivalArtifact span { color:#d8ddd3; font-size:9px; line-height:1.25; }
        @media (max-width:1000px) { .pinoriaArrivalPolish { grid-template-columns:1fr 1fr; padding-left:52px; padding-right:52px; gap:18px } .pinoriaArrivalStage { width:48vw; } .pinoriaArrivalArtifacts { display:none } }
      `}</style>

      <section className="pinoriaArrivalCopy">
        <span className="pinoriaArrivalKicker">CHÀO ĐẾN · {data.name.toUpperCase()}</span>
        <h1 className="pinoriaArrivalTitle">Chào {data.name} ✦</h1>
        <p className="pinoriaArrivalQuote">{data.greeting}</p>
        <div className="pinoriaArrivalIdentity">
          {data.path ? <span className="pinoriaArrivalChip"><strong>Hành trình</strong>{data.path}</span> : null}
          {data.companion ? <span className="pinoriaArrivalChip"><strong>Hộ Linh</strong>{data.companion}</span> : null}
        </div>
      </section>

      <section className="pinoriaArrivalStage" aria-hidden="true">
        <div className="pinoriaArrivalHalo" />
        <div className="pinoriaArrivalRing" />
        <div className="pinoriaArrivalShadow" />
        {data.artifacts.length ? (
          <div className="pinoriaArrivalArtifacts">
            {data.artifacts.map((artifact) => <div className="pinoriaArrivalArtifact" key={artifact}><i>✦</i><span>{artifact}</span></div>)}
          </div>
        ) : null}
        <div className="pinoriaArrivalFigure">
          <div className="pinoriaArrivalHead"><div className="pinoriaArrivalHair" /><div className="pinoriaArrivalFace">{data.name.toUpperCase()}</div></div>
          <div className="pinoriaArrivalBody"><div className="pinoriaArrivalSash">{data.name.toUpperCase()}</div><div className="pinoriaArrivalMark">P</div></div>
        </div>
        {data.companionName ? <div className="pinoriaArrivalCompanion"><div className="pinoriaArrivalCompanionBody">{companionInitial}</div><span className="pinoriaArrivalCompanionLabel">{data.companion}</span></div> : null}
      </section>
    </div>
  );
}
