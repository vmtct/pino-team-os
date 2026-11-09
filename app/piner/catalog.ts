// PAP-1764 · PNR-APP-HUB · exactly two member portfolios, not five program apps.
export type PinerAppKey = "hoi-hoa" | "piano";
export type PinerApp = {
  id: PinerAppKey; label: string; caption: string; descriptor: string;
  href: string; color: "rose" | "violet"; eyebrow: string; experience: string;
};
export const PINER_APPS: readonly PinerApp[] = [
  { id:"hoi-hoa",label:"Hội Họa",caption:"Mỹ thuật & sáng tạo",descriptor:"Thế giới sắc màu",
    href:"/piner/hoi-hoa",color:"rose",eyebrow:"PINO · ART",experience:"Mỗi nét vẽ là một câu chuyện." },
  { id:"piano",label:"Piano",caption:"Âm nhạc & biểu diễn",descriptor:"Giai điệu trưởng thành",
    href:"/piner/piano",color:"violet",eyebrow:"PINO · PIANO",experience:"Lưu giữ từng giai điệu con chơi." }
] as const;
export const PINER_LOCAL_APPS=PINER_APPS;
