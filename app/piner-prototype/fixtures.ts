export type MembershipMode =
  | "FREE_EXPLORE"
  | "TRIAL_PREMIUM"
  | "ACTIVE_PREMIUM"
  | "EXPIRED_PREMIUM";

export type PathKey = "PIANOHOUSE" | "ARTCHITECT" | "LPA" | "LPP";
export type HomeCondition = "normal" | "imminent" | "fresh";
export type CollectionKind = "Artwork" | "Music" | "Milestone" | "Moment";

export type ExploreStatus = "eligible" | "confirmed" | "premium" | "none";

export interface CollectionItem {
  id: string;
  kind: CollectionKind;
  title: string;
  subtitle: string;
  meta: string;
  emoji: string;
  featured?: boolean;
}

export interface JourneyPath {
  key: PathKey;
  label: string;
  eyebrow: string;
  summary: string;
  accent: string;
}

export interface StudentScenario {
  key: string;
  name: string;
  shortName: string;
  ageLabel: string;
  avatar: string;
  mode: MembershipMode;
  membershipLabel: string;
  membershipNote: string;
  paths: JourneyPath[];
  defaultPath: PathKey | null;
  home: {
    eyebrow: string;
    title: string;
    description: string;
    cta: string;
    meta: string;
    freshTitle: string;
    freshDescription: string;
    freshEmoji: string;
  };
  nextTouchpoint: {
    title: string;
    subtitle: string;
    time: string;
    detail: string;
  } | null;
  exploreStatus: ExploreStatus;
  exploreNote: string;
  collection: CollectionItem[];
}

export const scenarios: StudentScenario[] = [
  {
    key: "minh-premium",
    name: "Minh",
    shortName: "Minh",
    ageLabel: "10 tuổi",
    avatar: "M",
    mode: "ACTIVE_PREMIUM",
    membershipLabel: "Premium",
    membershipNote: "PianoHouse + ArtChitect",
    paths: [
      {
        key: "PIANOHOUSE",
        label: "PianoHouse",
        eyebrow: "Journey",
        summary: "Always With Me · L4 Fundamental",
        accent: "Piano",
      },
      {
        key: "ARTCHITECT",
        label: "ArtChitect",
        eyebrow: "Specialization",
        summary: "Character · L1 Explore",
        accent: "Art",
      },
    ],
    defaultPath: "PIANOHOUSE",
    home: {
      eyebrow: "Tiếp tục chơi",
      title: "Always With Me",
      description: "Verse 1 · Hai tay · Single Bass",
      cta: "Tiếp tục đàn",
      meta: "L4 · Fundamental · lần gần nhất hôm qua",
      freshTitle: "Ngôi nhà trên mây",
      freshDescription: "Một tác phẩm ArtChitect vừa được thêm vào Collection.",
      freshEmoji: "☁️",
    },
    nextTouchpoint: {
      title: "PianoHouse",
      subtitle: "Buổi tiếp theo",
      time: "Thứ Ba · 18:00",
      detail: "Always With Me · cohort 18:00–19:30",
    },
    exploreStatus: "premium",
    exploreNote: "Premium đang có thêm quyền lợi khám phá ngoài Journey chính.",
    collection: [
      {
        id: "minh-art-1",
        kind: "Artwork",
        title: "Ngôi nhà trên mây",
        subtitle: "ArtChitect · Character",
        meta: "Mới thêm hôm qua",
        emoji: "☁️",
        featured: true,
      },
      {
        id: "minh-music-1",
        kind: "Music",
        title: "Always With Me · L4",
        subtitle: "Level evidence",
        meta: "Được ghi nhận tuần này",
        emoji: "🎹",
      },
      {
        id: "minh-mark-1",
        kind: "Milestone",
        title: "Character · Roadmap Mark",
        subtitle: "ArtChitect",
        meta: "L1 Explore",
        emoji: "✦",
      },
    ],
  },
  {
    key: "mia-lpa",
    name: "Mía",
    shortName: "Mía",
    ageLabel: "5 tuổi",
    avatar: "M",
    mode: "ACTIVE_PREMIUM",
    membershipLabel: "Premium",
    membershipNote: "Little Piner Art",
    paths: [
      {
        key: "LPA",
        label: "Little Piner Art",
        eyebrow: "Discovery Journey",
        summary: "6 / 12 buổi khám phá",
        accent: "Little",
      },
    ],
    defaultPath: "LPA",
    home: {
      eyebrow: "Tuần này của Mía",
      title: "Những hình khối biết nhảy",
      description: "Hôm qua Mía đã thử ghép các hình thành một nhân vật của riêng mình.",
      cta: "Xem khoảnh khắc",
      meta: "Discovery · 6/12 buổi",
      freshTitle: "Một khoảnh khắc mới",
      freshDescription: "Mía chủ động kể về nhân vật của mình với cô.",
      freshEmoji: "🌼",
    },
    nextTouchpoint: {
      title: "Little Piner Art",
      subtitle: "Buổi tiếp theo",
      time: "Thứ Năm · 18:00",
      detail: "Discovery session · Little Piner room",
    },
    exploreStatus: "premium",
    exploreNote: "Open Studio là một nhánh khám phá ngoài Journey chính.",
    collection: [
      {
        id: "mia-moment-1",
        kind: "Moment",
        title: "Con kể về nhân vật của mình",
        subtitle: "Little Piner moment",
        meta: "Hôm qua",
        emoji: "🌼",
        featured: true,
      },
      {
        id: "mia-art-1",
        kind: "Artwork",
        title: "Bạn thỏ từ hình tròn",
        subtitle: "Selected artwork",
        meta: "Tuần 5",
        emoji: "🐇",
      },
      {
        id: "mia-mark-1",
        kind: "Milestone",
        title: "Little Checkpoint 1",
        subtitle: "4 buổi đã hoàn thành",
        meta: "Flower pin",
        emoji: "🌸",
      },
    ],
  },
  {
    key: "an-free",
    name: "An",
    shortName: "An",
    ageLabel: "8 tuổi",
    avatar: "A",
    mode: "FREE_EXPLORE",
    membershipLabel: "Free",
    membershipNote: "Open Studio",
    paths: [],
    defaultPath: null,
    home: {
      eyebrow: "Khám phá PINO",
      title: "Một buổi chiều để thử điều mới",
      description: "Chọn một Open Studio phù hợp để vẽ, chơi đàn hoặc khám phá một Path mới.",
      cta: "Khám phá Open Studio",
      meta: "Free · eligibility được Core kiểm tra khi đặt chỗ",
      freshTitle: "Lần ghé PINO gần nhất",
      freshDescription: "Một souvenir nhỏ từ Open Studio trước vẫn được giữ lại.",
      freshEmoji: "🎨",
    },
    nextTouchpoint: null,
    exploreStatus: "eligible",
    exploreNote: "Tuần này chưa có Open Studio Free nào được xác nhận.",
    collection: [
      {
        id: "an-free-1",
        kind: "Artwork",
        title: "Chú cá màu cam",
        subtitle: "Open Studio souvenir",
        meta: "Free artifact",
        emoji: "🐠",
      },
    ],
  },
  {
    key: "an-free-confirmed",
    name: "An",
    shortName: "An",
    ageLabel: "8 tuổi",
    avatar: "A",
    mode: "FREE_EXPLORE",
    membershipLabel: "Free",
    membershipNote: "Open Studio",
    paths: [],
    defaultPath: null,
    home: {
      eyebrow: "Sắp đến PINO",
      title: "Open Studio đã được xác nhận",
      description: "Tuần này An đã có một buổi Open Studio Free được xác nhận.",
      cta: "Xem buổi đã đặt",
      meta: "Free · weekly Explore allowance đang được sử dụng",
      freshTitle: "Muốn khám phá thêm?",
      freshDescription: "Premium mở ra Journey dài hạn và nhiều quyền lợi tham gia hơn.",
      freshEmoji: "✨",
    },
    nextTouchpoint: {
      title: "Open Studio · ArtChitect",
      subtitle: "Đã xác nhận",
      time: "Thứ Bảy · 15:30",
      detail: "Màu nước & những sinh vật nhỏ",
    },
    exploreStatus: "confirmed",
    exploreNote: "Tuần này đã có một Open Studio Free được xác nhận.",
    collection: [
      {
        id: "an-free-1b",
        kind: "Artwork",
        title: "Chú cá màu cam",
        subtitle: "Open Studio souvenir",
        meta: "Free artifact",
        emoji: "🐠",
      },
    ],
  },
  {
    key: "han-trial-ac",
    name: "Gia Hân",
    shortName: "Hân",
    ageLabel: "11 tuổi",
    avatar: "H",
    mode: "TRIAL_PREMIUM",
    membershipLabel: "Trial Premium",
    membershipNote: "ArtChitect",
    paths: [
      {
        key: "ARTCHITECT",
        label: "ArtChitect",
        eyebrow: "Current project",
        summary: "Illustration · L1 Explore",
        accent: "Art",
      },
    ],
    defaultPath: "ARTCHITECT",
    home: {
      eyebrow: "Dự án đang làm",
      title: "Khu rừng trong mơ",
      description: "Đang khám phá Silhouette & Shape trước khi đi vào chi tiết.",
      cta: "Trở lại dự án",
      meta: "Trial Premium · real Journey state",
      freshTitle: "Một node vừa mở",
      freshDescription: "Foundation exposure đã mở thêm một lựa chọn ở Illustration.",
      freshEmoji: "🌿",
    },
    nextTouchpoint: {
      title: "ArtChitect Studio",
      subtitle: "Buổi tiếp theo",
      time: "Thứ Tư · 18:00–20:30",
      detail: "Flexible Studio Window",
    },
    exploreStatus: "premium",
    exploreNote: "Trial trải nghiệm Journey thật, không phải demo shell.",
    collection: [
      {
        id: "han-art-1",
        kind: "Artwork",
        title: "Khu rừng trong mơ · sketch",
        subtitle: "Work in progress",
        meta: "Trial Premium",
        emoji: "🌿",
      },
    ],
  },
  {
    key: "leo-expired",
    name: "Leo",
    shortName: "Leo",
    ageLabel: "12 tuổi",
    avatar: "L",
    mode: "EXPIRED_PREMIUM",
    membershipLabel: "Premium đã hết hạn",
    membershipNote: "Journey được giữ lại",
    paths: [
      {
        key: "PIANOHOUSE",
        label: "PianoHouse",
        eyebrow: "Retained Journey",
        summary: "Always With Me · L4",
        accent: "Piano",
      },
    ],
    defaultPath: "PIANOHOUSE",
    home: {
      eyebrow: "Hành trình của Leo vẫn ở đây",
      title: "Always With Me · L4",
      description: "Các cột mốc, tác phẩm và recording đã đạt vẫn thuộc về Leo.",
      cta: "Xem lại Collection",
      meta: "Access expires. Achievement does not.",
      freshTitle: "Tiếp tục khi sẵn sàng",
      freshDescription: "Khám phá Premium để mở lại tiến trình mới mà không mất lịch sử cũ.",
      freshEmoji: "↗",
    },
    nextTouchpoint: null,
    exploreStatus: "eligible",
    exploreNote: "Leo vẫn có thể quay lại bằng Open Studio nếu hiện đủ điều kiện Free.",
    collection: [
      {
        id: "leo-music-1",
        kind: "Music",
        title: "Always With Me · L4",
        subtitle: "Retained recording",
        meta: "PianoHouse",
        emoji: "🎹",
        featured: true,
      },
      {
        id: "leo-mark-1",
        kind: "Milestone",
        title: "Fundamental · L4",
        subtitle: "Achievement retained",
        meta: "Không hết hạn cùng Subscription",
        emoji: "◆",
      },
    ],
  },
  {
    key: "bo-lpp",
    name: "Bơ",
    shortName: "Bơ",
    ageLabel: "6 tuổi",
    avatar: "B",
    mode: "ACTIVE_PREMIUM",
    membershipLabel: "Premium",
    membershipNote: "Little Piner Piano",
    paths: [
      {
        key: "LPP",
        label: "Little Piner Piano",
        eyebrow: "Starter collection",
        summary: "ABC Song · đang học",
        accent: "Little",
      },
    ],
    defaultPath: "LPP",
    home: {
      eyebrow: "Bài hát đang chơi",
      title: "ABC Song",
      description: "Ghép giai điệu quen thuộc với thế tay và hai tay đơn giản.",
      cta: "Chơi tiếp",
      meta: "Little Piner Piano · self-paced song",
      freshTitle: "Một milestone mới",
      freshDescription: "Bơ vừa mở được worksheet tiếp theo của ABC Song.",
      freshEmoji: "🎵",
    },
    nextTouchpoint: {
      title: "Little Piner Piano",
      subtitle: "Buổi tiếp theo",
      time: "Thứ Sáu · 19:00",
      detail: "Fixed slot · Early Years TE",
    },
    exploreStatus: "premium",
    exploreNote: "Journey chính và quyền lợi Explore là hai lớp khác nhau.",
    collection: [
      {
        id: "bo-music-1",
        kind: "Music",
        title: "ABC Song · first phrase",
        subtitle: "Little Piner Piano",
        meta: "Recording moment",
        emoji: "🎵",
      },
      {
        id: "bo-mark-1",
        kind: "Milestone",
        title: "Starter milestone",
        subtitle: "ABC Song",
        meta: "Configured milestone",
        emoji: "⭐",
      },
    ],
  },
];

export const householdKeys = ["minh-premium", "mia-lpa", "an-free"];

export const openStudioSessions = [
  {
    id: "os-art-1",
    path: "ArtChitect",
    title: "Màu nước & những sinh vật nhỏ",
    time: "Thứ Bảy · 15:30",
    age: "7–12 tuổi",
    emoji: "🎨",
  },
  {
    id: "os-piano-1",
    path: "PianoHouse",
    title: "Starter Piano · Giai điệu quen thuộc",
    time: "Chủ Nhật · 18:00",
    age: "7+",
    emoji: "🎹",
  },
  {
    id: "os-little-1",
    path: "Little Piner",
    title: "Shape & Sound Play",
    time: "Chủ Nhật · 15:00",
    age: "4–6 tuổi",
    emoji: "🪁",
  },
];
