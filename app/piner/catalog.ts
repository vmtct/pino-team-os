// PAP-1747 · PNR-APP-HUB · local prototype navigation, no Core or auth.
export type PinerAppKey = "little-art" | "little-piano" | "piano" | "artchitect" | "mytime";
export type PinerApp = {
  id: PinerAppKey;
  label: string;
  caption: string;
  descriptor: string;
  href: string;
  color: "rose" | "peach" | "violet" | "mint" | "amber";
  eyebrow: string;
  experience: string;
  ideas: readonly [string, string, string];
};
export const PINER_APPS: readonly PinerApp[] = [
  {
    id: "little-art", label: "Little Piner Art", caption: "Mỹ thuật mầm non",
    descriptor: "Sắc màu đầu đời", href: "/piner/little-art", color: "rose",
    eyebrow: "LITTLE PINER · ART", experience: "Từng nét vẽ nhỏ, cả thế giới lớn.",
    ideas: ["Khám phá màu sắc", "Những tác phẩm đầu tiên", "Hành trình sáng tạo"]
  },
  {
    id: "little-piano", label: "Little Piner Piano", caption: "Âm nhạc mầm non",
    descriptor: "Giai điệu đầu tiên", href: "/piner/little-piano", color: "peach",
    eyebrow: "LITTLE PINER · PIANO", experience: "Một nốt nhạc, một niềm vui mới.",
    ideas: ["Làm quen âm thanh", "Nhịp điệu vui", "Những bài đàn đầu tiên"]
  },
  {
    id: "piano", label: "Piano", caption: "PianoHouse",
    descriptor: "Chạm vào giai điệu", href: "/piner/piano", color: "violet",
    eyebrow: "PINOHOUSE", experience: "Bản nhạc hay nhất là bản nhạc của riêng mình.",
    ideas: ["Thư viện bài đàn", "Góc luyện tập", "Hành trình âm nhạc"]
  },
  {
    id: "artchitect", label: "Artchitect", caption: "Mỹ thuật sáng tạo",
    descriptor: "Vẽ nên thế giới", href: "/piner/artchitect", color: "mint",
    eyebrow: "ARTCHITECT", experience: "Ý tưởng của mình, thế giới của mình.",
    ideas: ["Dự án nghệ thuật", "Bộ sưu tập tác phẩm", "Hành trình sáng tạo"]
  },
  {
    id: "mytime", label: "MyTime", caption: "Creative Lifestyle",
    descriptor: "Có hẹn với điều mình thích", href: "/mytime", color: "amber",
    eyebrow: "MYTIME BY PINO", experience: "Có hẹn với điều mình thích.",
    ideas: ["Acrylic workshop", "Piano trải nghiệm", "Khoảnh khắc của riêng mình"]
  }
] as const;
export const PINER_LOCAL_APPS = PINER_APPS.filter(app => app.id !== "mytime");
