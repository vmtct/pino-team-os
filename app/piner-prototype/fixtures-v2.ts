export type MembershipMode =
  | "FREE_EXPLORE"
  | "TRIAL_PREMIUM"
  | "ACTIVE_PREMIUM"
  | "EXPIRED_PREMIUM";

export type PathKey = "PIANOHOUSE" | "ARTCHITECT" | "LPA" | "LPP";
export type HomeCondition = "normal" | "imminent" | "fresh";
export type CollectionKind = "Artwork" | "Music" | "Milestone" | "Moment";
export type CollectionTier = "FREE" | "PREMIUM";
export type ExploreStatus = "eligible" | "confirmed" | "premium" | "none";
export type AttendanceState = "attended" | "missed_excused" | "missed" | "current" | "upcoming";

export interface PackagePeriod {
  start: string;
  end: string;
  status: "ACTIVE" | "TRIAL" | "EXPIRED";
  note: string;
}

export interface CollectionItem {
  id: string;
  kind: CollectionKind;
  tier: CollectionTier;
  title: string;
  subtitle: string;
  meta: string;
  emoji: string;
  owned: boolean;
  trial?: boolean;
  featured?: boolean;
}

export interface JourneyPath {
  key: PathKey;
  label: string;
  eyebrow: string;
  summary: string;
  package: PackagePeriod;
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

export interface ScheduledTopic {
  slot: number;
  syllabusWeek: number;
  title: string;
  attendance: AttendanceState;
}

export const lpaPackageTopics: ScheduledTopic[] = [
  { slot: 1, syllabusWeek: 8, title: "Những hình khối biết nhảy", attendance: "attended" },
  { slot: 2, syllabusWeek: 9, title: "Màu sắc quanh con", attendance: "attended" },
  { slot: 3, syllabusWeek: 10, title: "Những đường nét chuyển động", attendance: "attended" },
  { slot: 4, syllabusWeek: 11, title: "Bạn thú từ hình khối", attendance: "attended" },
  { slot: 5, syllabusWeek: 12, title: "Khu vườn tí hon", attendance: "missed_excused" },
  { slot: 6, syllabusWeek: 13, title: "Ngôi nhà biết kể chuyện", attendance: "attended" },
  { slot: 7, syllabusWeek: 14, title: "Cơn mưa chấm tròn", attendance: "current" },
  { slot: 8, syllabusWeek: 15, title: "Những chiếc lá kỳ lạ", attendance: "upcoming" },
  { slot: 9, syllabusWeek: 16, title: "Bạn nhỏ dưới biển", attendance: "upcoming" },
  { slot: 10, syllabusWeek: 17, title: "Một ngày trên mây", attendance: "upcoming" },
  { slot: 11, syllabusWeek: 18, title: "Thành phố của con", attendance: "upcoming" },
  { slot: 12, syllabusWeek: 19, title: "Triển lãm mini", attendance: "upcoming" },
];

export const lpaFutureTopics = [
  "Kỳ tới · Chủ đề mới 01",
  "Kỳ tới · Chủ đề mới 02",
  "Kỳ tới · Chủ đề mới 03",
  "Kỳ tới · Chủ đề mới 04",
];

export const acPackageTopics: ScheduledTopic[] = [
  { slot: 1, syllabusWeek: 8, title: "Silhouette & Shape", attendance: "attended" },
  { slot: 2, syllabusWeek: 9, title: "Line & Rhythm", attendance: "attended" },
  { slot: 3, syllabusWeek: 10, title: "Form & Volume", attendance: "attended" },
  { slot: 4, syllabusWeek: 11, title: "Light & Value", attendance: "missed_excused" },
  { slot: 5, syllabusWeek: 12, title: "Color Relationships", attendance: "attended" },
  { slot: 6, syllabusWeek: 13, title: "Composition Focus", attendance: "current" },
  { slot: 7, syllabusWeek: 14, title: "Texture Study", attendance: "upcoming" },
  { slot: 8, syllabusWeek: 15, title: "Space & Depth", attendance: "upcoming" },
  { slot: 9, syllabusWeek: 16, title: "Character Gesture", attendance: "upcoming" },
  { slot: 10, syllabusWeek: 17, title: "Visual Story", attendance: "upcoming" },
  { slot: 11, syllabusWeek: 18, title: "Style Experiment", attendance: "upcoming" },
  { slot: 12, syllabusWeek: 19, title: "Foundation Synthesis", attendance: "upcoming" },
];

export const characterChildren = [
  { label: "Chibi", state: "completed" as const },
  { label: "Truyện tranh", state: "completed" as const },
  { label: "Hoạt hình", state: "active" as const },
  { label: "Anime", state: "available" as const },
  { label: "Bán hiện thực", state: "locked" as const },
];

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
        package: { start: "15/08/2026", end: "07/11/2026", status: "ACTIVE", note: "Gói 12 tuần · fixed slot" },
      },
      {
        key: "ARTCHITECT",
        label: "ArtChitect",
        eyebrow: "Specialization",
        summary: "Character cluster · L1",
        package: { start: "15/08/2026", end: "07/11/2026", status: "ACTIVE", note: "Gói 12 tuần · flexible studio window" },
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
      { id: "minh-free-1", kind: "Artwork", tier: "FREE", title: "Chú cá màu cam", subtitle: "Open Studio souvenir", meta: "Free Collection", emoji: "🐠", owned: true },
      { id: "minh-art-1", kind: "Artwork", tier: "PREMIUM", title: "Ngôi nhà trên mây", subtitle: "ArtChitect · Character", meta: "Mới thêm hôm qua", emoji: "☁️", owned: true, featured: true },
      { id: "minh-music-1", kind: "Music", tier: "PREMIUM", title: "Always With Me · L4", subtitle: "PianoHouse recording", meta: "Được ghi nhận tuần này", emoji: "🎹", owned: true },
      { id: "minh-mark-1", kind: "Milestone", tier: "PREMIUM", title: "Character · Roadmap Mark", subtitle: "ArtChitect", meta: "L1 cluster", emoji: "✦", owned: true },
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
        eyebrow: "Syllabus Journey",
        summary: "6 / 12 chủ đề đã đi qua",
        package: { start: "11/08/2026", end: "02/11/2026", status: "ACTIVE", note: "12 scheduled topics · rolling enrollment" },
      },
    ],
    defaultPath: "LPA",
    home: {
      eyebrow: "Tuần này của Mía",
      title: "Cơn mưa chấm tròn",
      description: "Chủ đề tiếp theo trong Syllabus của gói hiện tại.",
      cta: "Xem hành trình",
      meta: "6 chủ đề đã đi qua · 5 tham dự · 1 vắng có phép",
      freshTitle: "Một khoảnh khắc mới",
      freshDescription: "Mía chủ động kể về nhân vật của mình với cô.",
      freshEmoji: "🌼",
    },
    nextTouchpoint: {
      title: "Little Piner Art",
      subtitle: "Buổi tiếp theo",
      time: "Thứ Năm · 18:00",
      detail: "Cơn mưa chấm tròn · Syllabus W14",
    },
    exploreStatus: "premium",
    exploreNote: "Open Studio là một nhánh khám phá ngoài Journey chính.",
    collection: [
      { id: "mia-free-1", kind: "Moment", tier: "FREE", title: "Lần đầu ghé PINO", subtitle: "Open Studio moment", meta: "Free Collection", emoji: "🎨", owned: true },
      { id: "mia-moment-1", kind: "Moment", tier: "PREMIUM", title: "Con kể về nhân vật của mình", subtitle: "Little Piner moment", meta: "Hôm qua", emoji: "🌼", owned: true, featured: true },
      { id: "mia-art-1", kind: "Artwork", tier: "PREMIUM", title: "Bạn thỏ từ hình tròn", subtitle: "Selected artwork", meta: "Syllabus W11", emoji: "🐇", owned: true },
      { id: "mia-mark-1", kind: "Milestone", tier: "PREMIUM", title: "Little Checkpoint 1", subtitle: "Đủ 4 buổi tham dự", meta: "Flower pin", emoji: "🌸", owned: true },
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
      { id: "an-free-1", kind: "Artwork", tier: "FREE", title: "Chú cá màu cam", subtitle: "Open Studio souvenir", meta: "Free Collection", emoji: "🐠", owned: true },
      { id: "an-premium-preview-1", kind: "Artwork", tier: "PREMIUM", title: "ArtChitect Portfolio", subtitle: "Premium preview", meta: "Mở với Premium", emoji: "🖼️", owned: false },
      { id: "an-premium-preview-2", kind: "Milestone", tier: "PREMIUM", title: "Journey Milestones", subtitle: "Premium preview", meta: "Mở với Premium", emoji: "✦", owned: false },
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
    nextTouchpoint: { title: "Open Studio · ArtChitect", subtitle: "Đã xác nhận", time: "Thứ Bảy · 15:30", detail: "Màu nước & những sinh vật nhỏ" },
    exploreStatus: "confirmed",
    exploreNote: "Tuần này đã có một Open Studio Free được xác nhận.",
    collection: [
      { id: "an-free-1b", kind: "Artwork", tier: "FREE", title: "Chú cá màu cam", subtitle: "Open Studio souvenir", meta: "Free Collection", emoji: "🐠", owned: true },
      { id: "an-premium-preview-3", kind: "Artwork", tier: "PREMIUM", title: "Premium Portfolio", subtitle: "Premium preview", meta: "Mở với Premium", emoji: "🖼️", owned: false },
    ],
  },
  {
    key: "han-trial-ac",
    name: "Gia Hân",
    shortName: "Hân",
    ageLabel: "11 tuổi",
    avatar: "H",
    mode: "TRIAL_PREMIUM",
    membershipLabel: "Trải nghiệm",
    membershipNote: "ArtChitect",
    paths: [
      {
        key: "ARTCHITECT",
        label: "ArtChitect",
        eyebrow: "Hành trình Trải nghiệm",
        summary: "Foundation · package slot 6",
        package: { start: "12/08/2026", end: "25/08/2026", status: "TRIAL", note: "Trải nghiệm 14 ngày · Hành trình thật" },
      },
    ],
    defaultPath: "ARTCHITECT",
    home: {
      eyebrow: "Dự án đang làm",
      title: "Khu rừng trong mơ",
      description: "Đang khám phá Silhouette & Shape trước khi đi vào chi tiết.",
      cta: "Trở lại dự án",
      meta: "Trải nghiệm · Hành trình thật",
      freshTitle: "Một node vừa mở",
      freshDescription: "Foundation exposure đã mở thêm một lựa chọn ở Illustration.",
      freshEmoji: "🌿",
    },
    nextTouchpoint: { title: "ArtChitect Studio", subtitle: "Buổi tiếp theo", time: "Thứ Tư · 18:00–20:30", detail: "Flexible Studio Window" },
    exploreStatus: "premium",
    exploreNote: "Trải nghiệm dùng Hành trình thật, không phải bản demo.",
    collection: [
      { id: "han-free-1", kind: "Artwork", tier: "FREE", title: "Open Studio sketch", subtitle: "Free Collection", meta: "Trước Trải nghiệm", emoji: "✏️", owned: true },
      { id: "han-art-1", kind: "Artwork", tier: "PREMIUM", title: "Khu rừng trong mơ · sketch", subtitle: "Work in progress", meta: "Trải nghiệm", emoji: "🌿", owned: true, trial: true, featured: true },
    ],
  },
  {
    key: "leo-expired",
    name: "Leo",
    shortName: "Leo",
    ageLabel: "12 tuổi",
    avatar: "L",
    mode: "EXPIRED_PREMIUM",
    membershipLabel: "Trải nghiệm đã kết thúc",
    membershipNote: "Progression locked · history retained",
    paths: [
      {
        key: "PIANOHOUSE",
        label: "PianoHouse",
        eyebrow: "Retained Journey",
        summary: "Always With Me · L4",
        package: { start: "01/08/2026", end: "14/08/2026", status: "EXPIRED", note: "Trải nghiệm đã kết thúc · progression mới đang khóa" },
      },
    ],
    defaultPath: "PIANOHOUSE",
    home: {
      eyebrow: "Trải nghiệm đã kết thúc · Progression locked",
      title: "Always With Me · L4 vẫn được giữ lại",
      description: "Các cột mốc và recording đã đạt vẫn thuộc về Leo; bước tiến mới cần Premium active.",
      cta: "Xem lịch sử đã giữ",
      meta: "Quyền truy cập có thể kết thúc. Thành quả vẫn còn.",
      freshTitle: "Tiếp tục khi sẵn sàng",
      freshDescription: "Premium mở lại progression mới mà không làm mất lịch sử Trải nghiệm.",
      freshEmoji: "🔒",
    },
    nextTouchpoint: null,
    exploreStatus: "eligible",
    exploreNote: "Leo vẫn có thể quay lại bằng Open Studio nếu hiện đủ điều kiện Free.",
    collection: [
      { id: "leo-free-1", kind: "Artwork", tier: "FREE", title: "Open Studio postcard", subtitle: "Free Collection", meta: "Retained", emoji: "🎨", owned: true },
      { id: "leo-music-1", kind: "Music", tier: "PREMIUM", title: "Always With Me · L4", subtitle: "Bản ghi âm từ Trải nghiệm", meta: "Student-owned history", emoji: "🎹", owned: true, trial: true, featured: true },
      { id: "leo-mark-1", kind: "Milestone", tier: "PREMIUM", title: "Fundamental · L4", subtitle: "Achievement retained", meta: "Được giữ sau khi quyền truy cập kết thúc", emoji: "◆", owned: true, trial: true },
      { id: "leo-next-preview", kind: "Milestone", tier: "PREMIUM", title: "Next Premium milestone", subtitle: "Future progression", meta: "Locked until Premium resumes", emoji: "🔒", owned: false },
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
        package: { start: "16/08/2026", end: "08/11/2026", status: "ACTIVE", note: "Gói 12 tuần · fixed slot" },
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
    nextTouchpoint: { title: "Little Piner Piano", subtitle: "Buổi tiếp theo", time: "Thứ Sáu · 19:00", detail: "Fixed slot · Early Years TE" },
    exploreStatus: "premium",
    exploreNote: "Journey chính và quyền lợi Explore là hai lớp khác nhau.",
    collection: [
      { id: "bo-free-1", kind: "Moment", tier: "FREE", title: "Piano Open Studio", subtitle: "Free Collection", meta: "Souvenir", emoji: "🎹", owned: true },
      { id: "bo-music-1", kind: "Music", tier: "PREMIUM", title: "ABC Song · first phrase", subtitle: "Little Piner Piano", meta: "Recording moment", emoji: "🎵", owned: true, featured: true },
    ],
  },
];

export const householdKeys = ["minh-premium", "mia-lpa", "an-free"];

export const openStudioSessions = [
  { id: "os-1", path: "ArtChitect", title: "Màu nước & những sinh vật nhỏ", time: "Thứ Bảy · 15:30", age: "7+", emoji: "🎨" },
  { id: "os-2", path: "Piano", title: "Giai điệu quen thuộc", time: "Chủ Nhật · 18:00", age: "7+", emoji: "🎹" },
  { id: "os-3", path: "Little Piner", title: "Hình khối biết kể chuyện", time: "Chủ Nhật · 15:00", age: "4–6", emoji: "🌱" },
];