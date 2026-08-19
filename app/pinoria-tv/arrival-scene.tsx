"use client";

type ArrivalSubject = {
  name: string;
  path: string;
  companion: string;
};

function splitCompanion(value: string) {
  if (!value || value.startsWith("Chưa có")) return { name: "", detail: "" };
  const parts = value.split(" · ");
  return { name: parts[0] ?? "", detail: parts.join(" · ") };
}

export function ArrivalScene({ subject }: { subject: ArrivalSubject }) {
  const companion = splitCompanion(subject.companion);
  const initial = subject.name.slice(0, 1).toUpperCase() || "P";
  const companionInitial = companion.name.slice(0, 1).toUpperCase() || "✦";

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "radial-gradient(circle at 61% 42%,#87956b 0,#3b4c35 35%,#1b241a 72%)", color: "#fff" }}>
      <style>{`
        @keyframes pinoriaArrivalCopy { 0%,18% { opacity:0; transform:translateY(16px) } 48%,100% { opacity:1; transform:translateY(0) } }
        @keyframes pinoriaArrivalCharacter { 0%,8% { opacity:0; transform:translateX(56px) scale(.94) } 43% { opacity:1; transform:translateX(0) scale(1.015) } 58%,100% { opacity:1; transform:translateX(0) scale(1) } }
        @keyframes pinoriaArrivalCompanion { 0%,36% { opacity:0; transform:translate(20px,14px) scale(.7) } 62% { opacity:1; transform:translate(-3px,-3px) scale(1.04) } 74%,100% { opacity:1; transform:translate(0,0) scale(1) } }
        @keyframes pinoriaArrivalArtifact { 0%,58% { opacity:0; transform:translateY(10px) scale(.94) } 82%,100% { opacity:1; transform:translateY(0) scale(1) } }
        @keyframes pinoriaArrivalGlow { 0%,100% { opacity:.45; transform:scale(.97) } 50% { opacity:.72; transform:scale(1.035) } }
      `}</style>

      <div style={{ position: "absolute", left: "32%", right: "6%", top: "7%", height: "78%", borderRadius: "50%", background: "radial-gradient(circle,#f0dda243 0,transparent 70%)", filter: "blur(22px)", animation: "pinoriaArrivalGlow 4s ease-in-out infinite" }} />

      <div style={{ position: "absolute", inset: 0, boxSizing: "border-box", padding: "76px clamp(70px,7vw,110px) 58px", display: "grid", gridTemplateColumns: "minmax(0,.82fr) minmax(500px,1.18fr)", alignItems: "center", gap: 34 }}>
        <section style={{ maxWidth: 560, animation: "pinoriaArrivalCopy 6.2s cubic-bezier(.2,.75,.2,1) both" }}>
          <span style={{ display: "block", marginBottom: 12, color: "#e7c77a", fontSize: 11, fontWeight: 900, letterSpacing: ".18em" }}>CHÀO ĐẾN · {subject.name.toUpperCase()}</span>
          <h1 style={{ margin: "0 0 16px", fontSize: "clamp(50px,5.2vw,72px)", lineHeight: .94, letterSpacing: "-.05em" }}>Chào {subject.name} ✦</h1>
          <p style={{ margin: 0, maxWidth: 520, color: "#eee6d7", fontSize: "clamp(19px,1.75vw,24px)", lineHeight: 1.42 }}>{companion.name ? `“Hôm nay ${companion.name} đi cùng mình!”` : "“Một buổi học mới bắt đầu rồi!”"}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 26 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, minHeight: 30, padding: "6px 10px", borderRadius: 999, background: "#ffffff0b", border: "1px solid #ffffff1b", color: "#dfe4da", fontSize: 10 }}><strong style={{ color: "#f0d58d", fontSize: 9, letterSpacing: ".06em" }}>HÀNH TRÌNH</strong>{subject.path}</span>
            {companion.detail ? <span style={{ display: "inline-flex", alignItems: "center", gap: 7, minHeight: 30, padding: "6px 10px", borderRadius: 999, background: "#ffffff0b", border: "1px solid #ffffff1b", color: "#dfe4da", fontSize: 10 }}><strong style={{ color: "#f0d58d", fontSize: 9, letterSpacing: ".06em" }}>HỘ LINH</strong>{companion.detail}</span> : null}
          </div>
        </section>

        <section aria-hidden="true" style={{ position: "relative", width: "min(590px,46vw)", height: "min(520px,68vh)", justifySelf: "end", display: "grid", placeItems: "center", animation: "pinoriaArrivalCharacter 6.2s cubic-bezier(.18,.8,.2,1) both" }}>
          <div style={{ position: "absolute", width: "72%", aspectRatio: "1", borderRadius: "50%", border: "1px solid #ead89322", boxShadow: "0 0 54px #dfcd7720" }} />
          <div style={{ position: "absolute", left: "28%", right: "14%", bottom: "7%", height: 34, borderRadius: "50%", background: "#050b0680", filter: "blur(15px)" }} />

          <div style={{ position: "relative", width: 292, height: 402, marginRight: 48 }}>
            <div style={{ position: "absolute", left: "50%", top: 10, width: 148, height: 148, transform: "translateX(-50%)", borderRadius: "46% 46% 43% 43%", background: "linear-gradient(180deg,#efd5bc,#d9b994)", border: "6px solid #293626", boxShadow: "0 16px 36px #0003" }}>
              <div style={{ position: "absolute", inset: "-4px 5px auto", height: 58, borderRadius: "55% 55% 34% 34%", background: "#31432d" }}><span style={{ position: "absolute", right: 20, top: 11, color: "#e0bd6f", fontSize: 35, fontWeight: 900, transform: "rotate(10deg)" }}>⌁</span></div>
              <div style={{ position: "absolute", left: 0, right: 0, top: 68, textAlign: "center", color: "#57473a", fontSize: 14, fontWeight: 900, letterSpacing: ".08em" }}>{subject.name.toUpperCase()}</div>
            </div>
            <div style={{ position: "absolute", left: "50%", top: 144, width: 230, height: 232, transform: "translateX(-50%)", borderRadius: "46px 46px 72px 72px", background: "linear-gradient(180deg,#7c916f,#5f7657)", border: "6px solid #293626", boxShadow: "0 26px 50px #0004", overflow: "hidden" }}>
              <div style={{ position: "absolute", left: 0, right: 0, top: 38, height: 43, display: "grid", placeItems: "center", background: "#d4b998", color: "#41392f", fontSize: 18, fontWeight: 900, letterSpacing: ".04em" }}>{subject.name.toUpperCase()}</div>
              <div style={{ position: "absolute", left: "50%", bottom: 40, transform: "translateX(-50%)", width: 58, height: 58, borderRadius: "50%", display: "grid", placeItems: "center", background: "#f1e1b7", color: "#567052", fontSize: 26, fontWeight: 900, boxShadow: "0 10px 22px #0002" }}>{initial}</div>
            </div>
          </div>

          {companion.name ? <div style={{ position: "absolute", zIndex: 3, right: 8, bottom: 42, width: 158, display: "grid", justifyItems: "center", gap: 6, animation: "pinoriaArrivalCompanion 6.2s cubic-bezier(.18,.82,.2,1) both" }}><div style={{ width: 112, height: 112, borderRadius: "52% 52% 44% 44%", background: "linear-gradient(145deg,#e3aa7d,#bd7e58)", border: "6px solid #925f45", color: "#fff", display: "grid", placeItems: "center", fontSize: 38, fontWeight: 900, boxShadow: "0 18px 36px #0004" }}>{companionInitial}</div><span style={{ maxWidth: 180, padding: "5px 9px", borderRadius: 999, background: "#142016d9", border: "1px solid #ffffff18", color: "#efe6d8", fontSize: 9, whiteSpace: "nowrap" }}>{companion.detail}</span></div> : null}

          <div style={{ position: "absolute", left: "3%", top: "25%", display: "grid", gap: 9, animation: "pinoriaArrivalArtifact 6.2s ease both" }}>
            {["Giọt Nước II", "Ấn Hành Trình II"].map((artifact) => <div key={artifact} style={{ minWidth: 132, padding: "9px 11px", borderRadius: 14, background: "#182219b8", border: "1px solid #ead78b2d", boxShadow: "0 12px 30px #0002", display: "grid", gridTemplateColumns: "28px 1fr", gap: 8, alignItems: "center" }}><i style={{ width: 27, height: 27, borderRadius: "50%", display: "grid", placeItems: "center", background: "#ecd68a18", color: "#e9ca74", fontStyle: "normal" }}>✦</i><span style={{ color: "#d8ddd3", fontSize: 9, lineHeight: 1.25 }}>{artifact}</span></div>)}
          </div>
        </section>
      </div>
    </div>
  );
}
