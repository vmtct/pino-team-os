export type LostArtifactPower = {
  name: string;
  detail: string;
};

export type LostArtifactRecord = {
  id: "01" | "02" | "03" | "04";
  code: string;
  title: string;
  heroUrl: string;
  origin: string;
  classification: string;
  lastSeen: string;
  history: [string, string];
  clue: string;
  signal: string;
  powers: [LostArtifactPower, LostArtifactPower, LostArtifactPower];
  bounty: number;
};

export const LOST_ARTIFACTS: LostArtifactRecord[] = [
  {
    id: "01",
    code: "PNR-01-A",
    title: "Nguyệt Thư Lưu Quang",
    heroUrl: "https://assets.pinohouse.art/draft/Pinoria_accessories1.png",
    origin: "Thư khố Terravia",
    classification: "Thần khí",
    lastSeen: "Tháp Ký Ức",
    history: [
      "Tương truyền cuốn thư chỉ hiện chữ dưới thứ ánh sáng không thuộc về ban ngày.",
      "Những trang còn lại được cho là ghi giữ ký ức mà chính người đọc đã quên.",
    ],
    clue: "Một vệt mực ngọc trai vừa xuất hiện ở hành lang phía Bắc.",
    signal: "Mỏng · liên tục",
    powers: [
      { name: "Lưu ảnh ký ức", detail: "Giữ lại một lát cắt ký ức trước khi nó phai đi." },
      { name: "Khai trang ẩn", detail: "Làm lộ những dấu vết vốn không thể đọc bằng mắt thường." },
      { name: "Phong ấn hồi âm", detail: "Khóa một dư âm để lần theo nó ở thời điểm khác." },
    ],
    bounty: 48_000,
  },
  {
    id: "02",
    code: "PNR-07-A",
    title: "Nguyệt Cầm Hồng Khuyết",
    heroUrl: "https://assets.pinohouse.art/draft/Pinoria_accessories2.png",
    origin: "Terravia cổ đại",
    classification: "Thần khí",
    lastSeen: "Đại Phân Tầng",
    history: [
      "Tương truyền Nguyệt Cầm Hồng Khuyết từng ngân lên trong những đêm trăng đỏ, lưu giữ ký ức của người chạm vào nó.",
      "Dư âm của cây đàn được cho là có thể cộng hưởng với những thần khí cùng nguồn gốc.",
    ],
    clue: "Dấu vết gần nhất dẫn về rìa Đông Terravia.",
    signal: "Yếu · ổn định",
    powers: [
      { name: "Cộng hưởng ký ức", detail: "Khơi dậy ký ức ngủ quên, kết nối tâm hồn đồng điệu." },
      { name: "Vọng âm dẫn lối", detail: "Âm thanh ngân vang dẫn lối, soi đường qua màn sương." },
      { name: "Nguyệt quang hộ mệnh", detail: "Ánh trăng bảo hộ người vững tâm trước hiểm nguy." },
    ],
    bounty: 48_000,
  },
  {
    id: "03",
    code: "PNR-12-C",
    title: "Lam Giác Vọng Âm",
    heroUrl: "https://assets.pinohouse.art/draft/Pinoria_accessories3.png",
    origin: "Vực Gió Lam",
    classification: "Thần khí",
    lastSeen: "Cầu Mây Phía Tây",
    history: [
      "Lam Giác từng được dùng để gửi một âm hiệu xuyên qua những vùng đất không còn nối liền nhau.",
      "Mỗi lần nó cất tiếng, một đường chân trời khác được cho là đáp lại.",
    ],
    clue: "Ba tiếng vọng ngắn đã được ghi nhận trên tuyến gió phía Tây.",
    signal: "Rõ · ngắt quãng",
    powers: [
      { name: "Vọng giới", detail: "Gửi một tín hiệu vượt qua khoảng cách mà âm thanh thường không thể tới." },
      { name: "Dẫn phong", detail: "Bẻ hướng luồng gió để mở một lối đi tạm thời." },
      { name: "Hồi âm định vị", detail: "Đọc khoảng cách và phương hướng từ tiếng vọng trở về." },
    ],
    bounty: 48_000,
  },
  {
    id: "04",
    code: "PNR-19-D",
    title: "Tử Tinh Dẫn Lộ",
    heroUrl: "https://assets.pinohouse.art/draft/Pinoria_accessories4.png",
    origin: "Biên giới Tử Vụ",
    classification: "Thần khí",
    lastSeen: "Đường Đèn Cũ",
    history: [
      "Cây trượng từng soi đường qua vùng sương tím nơi mọi dấu mốc đều biến mất sau hoàng hôn.",
      "Tinh thể treo bên thân chỉ phát sáng khi người mang đang đi đúng hướng.",
    ],
    clue: "Một quầng tím vừa được nhìn thấy gần cột mốc không còn tên.",
    signal: "Yếu · dao động",
    powers: [
      { name: "Tinh quang dẫn lộ", detail: "Phát sáng khi hướng đi đang tiến gần tới dấu vết cần tìm." },
      { name: "Tử vụ tĩnh giới", detail: "Làm lắng sương nhiễu để lộ cấu trúc thật của không gian." },
      { name: "Mốc sáng hồi quy", detail: "Để lại một điểm sáng có thể tìm lại sau khi đường đi thay đổi." },
    ],
    bounty: 48_000,
  },
];

export function getLostArtifact(id: string) {
  return LOST_ARTIFACTS.find((artifact) => artifact.id === id);
}
