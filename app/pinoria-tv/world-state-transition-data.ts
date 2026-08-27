import type { WorldStateTransitionPayload } from "./shop-types";

export const DEFAULT_WORLD_STATE_TRANSITION: WorldStateTransitionPayload = {
  id: "prototype-terravia-chapter-ii",
  title: "Terravia đang chuyển mình",
  detail: "Ánh sáng, nhịp thở và dấu hiệu trong House đang đổi theo chương mới của thế giới Pinoria.",
  from: {
    id: "terravia-chapter-i",
    revision: 1,
    regionLabel: "Terravia",
    chapterLabel: "Chương I",
    seasonLabel: "Mùa Thu",
    ambientTheme: "terravia",
    updatedAt: 0,
  },
  to: {
    id: "terravia-chapter-ii",
    revision: 2,
    regionLabel: "Terravia",
    chapterLabel: "Chương II",
    seasonLabel: "Giao mùa",
    ambientTheme: "ember",
    updatedAt: 0,
  },
  footer: "Trạng thái mới tiếp tục tồn tại trong House sau khi chuyển cảnh kết thúc.",
};
