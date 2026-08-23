export type ArrivalBackgroundVariant = "earth-brown" | "ambient-house-blur";

export const PINORIA_ARRIVAL_BACKGROUND_STORAGE_KEY = "pinoria:arrival-background-variant";
export const PINORIA_ARRIVAL_BACKGROUND_EVENT = "pinoria:arrival-background-change";
export const DEFAULT_ARRIVAL_BACKGROUND: ArrivalBackgroundVariant = "earth-brown";

export const ARRIVAL_BACKGROUND_OPTIONS = [
  {
    id: "earth-brown",
    label: "A · Earth Brown",
    shortLabel: "Earth Brown",
    description: "Nền nâu đất tối, muted/faded. Đây là phương án hiện tại và giữ visual sạch nhất quanh character.",
  },
  {
    id: "ambient-house-blur",
    label: "B · Ambient House Blur",
    shortLabel: "House Blur",
    description: "Dùng chính House Back + Mid + Front, blur mạnh, giảm saturation và phủ lớp tối để giữ context Pinoria nhưng không tranh visual với character.",
  },
] as const satisfies readonly {
  id: ArrivalBackgroundVariant;
  label: string;
  shortLabel: string;
  description: string;
}[];

export const AMBIENT_HOUSE_ARRIVAL_ASSET_VERSION = "ambient-house-1920-20260821-runtime-area-v1";
export const AMBIENT_HOUSE_ARRIVAL_ASSETS = {
  back: `/api/pinoria-prototype/ambient-house-asset?layer=back&v=${AMBIENT_HOUSE_ARRIVAL_ASSET_VERSION}`,
  mid: `/api/pinoria-prototype/ambient-house-asset?layer=mid&v=${AMBIENT_HOUSE_ARRIVAL_ASSET_VERSION}`,
  front: `/api/pinoria-prototype/ambient-house-asset?layer=front&v=${AMBIENT_HOUSE_ARRIVAL_ASSET_VERSION}`,
} as const;

export function normalizeArrivalBackgroundVariant(value: string | null | undefined): ArrivalBackgroundVariant {
  return value === "ambient-house-blur" ? "ambient-house-blur" : DEFAULT_ARRIVAL_BACKGROUND;
}
