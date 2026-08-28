import type { CSSProperties } from "react";

export type JourneyRankId = "departure" | "vanguard" | "wayfinder" | "odyssey" | "expedition";

type JourneyRank = { id: JourneyRankId; name: string; imageUrl: string };

export const PINORIA_JOURNEY_RANKS: readonly JourneyRank[] = [
  { id: "departure", name: "Khởi Hành", imageUrl: "https://assets.pinohouse.art/pinoria/Ranks/R1.png" },
  { id: "vanguard", name: "Tiên Phong", imageUrl: "https://assets.pinohouse.art/pinoria/Ranks/R2.png" },
  { id: "wayfinder", name: "Dẫn Lộ", imageUrl: "https://assets.pinohouse.art/pinoria/Ranks/R3.png" },
  { id: "odyssey", name: "Kỳ Hành", imageUrl: "https://assets.pinohouse.art/pinoria/Ranks/R4.png" },
  { id: "expedition", name: "Viễn Chinh", imageUrl: "https://assets.pinohouse.art/pinoria/Ranks/R5.png" },
] as const;

const MOCK_RANK_BY_SUBJECT: Record<string, number> = { bo: 2 };

function RankArtwork({ src, size }: { src: string; size: number }) {
  return (
    <span style={{ position: "relative", width: size, height: size, overflow: "hidden", borderRadius: "50%", flex: "0 0 auto" }}>
      <img src={src} alt="" draggable={false} style={{ position: "absolute", width: "178%", height: "178%", left: "-39%", top: "-39%", objectFit: "contain", mixBlendMode: "screen", filter: "brightness(1.06) saturate(.96)", pointerEvents: "none" }} />
    </span>
  );
}

export function JourneyRankPanel({ subjectId, subjectName, style }: { subjectId: string; subjectName: string; style?: CSSProperties }) {
  const rankIndex = MOCK_RANK_BY_SUBJECT[subjectId] ?? 0;
  const current = PINORIA_JOURNEY_RANKS[rankIndex] ?? PINORIA_JOURNEY_RANKS[0];
  return (
    <div data-journey-rank-panel style={{ display: "flex", alignItems: "center", minWidth: 0, ...style }}>
      <strong data-character-name style={{ color: "#f8e6c3", fontSize: 30, lineHeight: 1, fontWeight: 950, letterSpacing: ".01em", whiteSpace: "nowrap", textShadow: "0 5px 20px rgba(0,0,0,.28)" }}>
        {subjectName}
      </strong>
      <span style={{ width: 1, height: 34, margin: "0 16px", background: "linear-gradient(180deg,transparent,rgba(238,199,124,.34),transparent)", flex: "0 0 auto" }} />
      <div data-current-rank style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <div style={{ position: "relative", width: 50, height: 50, display: "grid", placeItems: "center", flex: "0 0 auto" }}>
          <div style={{ position: "absolute", inset: 4, borderRadius: "50%", background: "radial-gradient(circle,rgba(53,91,142,.25),rgba(20,25,42,.04) 65%,transparent 73%)", filter: "blur(5px)" }} />
          <RankArtwork src={current.imageUrl} size={50} />
        </div>
        <strong data-current-rank-name style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", color: "#f3d18e", fontSize: 17, fontWeight: 950, letterSpacing: ".07em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
          {current.name}
        </strong>
      </div>
    </div>
  );
}
