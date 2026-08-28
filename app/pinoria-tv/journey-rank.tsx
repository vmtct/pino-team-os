import type { CSSProperties } from "react";

export type JourneyRankId = "departure" | "vanguard" | "wayfinder" | "odyssey" | "expedition";

type JourneyRank = {
  id: JourneyRankId;
  name: string;
  imageUrl: string;
};

export const PINORIA_JOURNEY_RANKS: readonly JourneyRank[] = [
  { id: "departure", name: "Khởi Hành", imageUrl: "https://assets.pinohouse.art/pinoria/Ranks/R1.png" },
  { id: "vanguard", name: "Tiên Phong", imageUrl: "https://assets.pinohouse.art/pinoria/Ranks/R2.png" },
  { id: "wayfinder", name: "Dẫn Lộ", imageUrl: "https://assets.pinohouse.art/pinoria/Ranks/R3.png" },
  { id: "odyssey", name: "Kỳ Hành", imageUrl: "https://assets.pinohouse.art/pinoria/Ranks/R4.png" },
  { id: "expedition", name: "Viễn Chinh", imageUrl: "https://assets.pinohouse.art/pinoria/Ranks/R5.png" },
] as const;

const MOCK_RANK_BY_SUBJECT: Record<string, { index: number; longevity: string }> = {
  bo: { index: 2, longevity: "2 năm đồng hành" },
};

function RankArtwork({ src, size, dimmed = false }: { src: string; size: number; dimmed?: boolean }) {
  return (
    <span style={{ position: "relative", width: size, height: size, overflow: "hidden", borderRadius: "50%", flex: "0 0 auto" }}>
      <img src={src} alt="" draggable={false} style={{ position: "absolute", width: "178%", height: "178%", left: "-39%", top: "-39%", objectFit: "contain", mixBlendMode: "screen", opacity: dimmed ? .3 : 1, filter: dimmed ? "grayscale(.6) brightness(.72)" : "brightness(1.06) saturate(.96)", pointerEvents: "none" }} />
    </span>
  );
}
export function JourneyRankPanel({ subjectId, style }: { subjectId: string; style?: CSSProperties }) {
  const state = MOCK_RANK_BY_SUBJECT[subjectId] ?? { index: 0, longevity: "Khởi đầu hành trình" };
  const current = PINORIA_JOURNEY_RANKS[state.index] ?? PINORIA_JOURNEY_RANKS[0];

  return (
    <div data-journey-rank-panel style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr)", alignItems: "center", gap: 14, minWidth: 0, ...style }}>
      <div style={{ position: "relative", width: 76, height: 76, display: "grid", placeItems: "center" }}>
        <div style={{ position: "absolute", inset: 4, borderRadius: "50%", background: "radial-gradient(circle,rgba(53,91,142,.26),rgba(20,25,42,.05) 64%,transparent 72%)", filter: "blur(5px)" }} />
        <RankArtwork src={current.imageUrl} size={76} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
          <strong data-current-rank-name style={{ color: "#f3d18e", fontSize: 19, fontWeight: 950, letterSpacing: ".05em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{current.name}</strong>
          <span style={{ color: "rgba(246,232,208,.44)", fontSize: 10.5, fontWeight: 850, whiteSpace: "nowrap" }}>{state.longevity}</span>
        </div>
        <div data-journey-rank-progress style={{ marginTop: 9, display: "grid", gridTemplateColumns: "repeat(5,minmax(0,1fr))", alignItems: "start", gap: 3 }}>
          {PINORIA_JOURNEY_RANKS.map((rank, index) => {
            const active = index === state.index;
            const reached = index <= state.index;
            return (
              <div key={rank.id} data-active={active ? "true" : "false"} style={{ position: "relative", minWidth: 0, display: "grid", justifyItems: "center", gap: 2 }}>
                {index > 0 ? <span style={{ position: "absolute", left: "calc(-50% + 12px)", right: "calc(50% + 12px)", top: 12, height: 1, background: reached ? "rgba(225,180,93,.54)" : "rgba(239,219,183,.12)" }} /> : null}
                <RankArtwork src={rank.imageUrl} size={25} dimmed={!reached} />
                <span style={{ maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", color: active ? "#eac36f" : reached ? "rgba(244,224,190,.54)" : "rgba(244,224,190,.27)", fontSize: 7.5, fontWeight: active ? 950 : 750, whiteSpace: "nowrap" }}>{rank.name}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
