export type ArrivalBackgroundVariant = "earth-brown" | "ambient-house-blur";

export const PINORIA_ARRIVAL_BACKGROUND_STORAGE_KEY = "pinoria:arrival-background-variant";
export const PINORIA_ARRIVAL_BACKGROUND_EVENT = "pinoria:arrival-background-change";
export const DEFAULT_ARRIVAL_BACKGROUND: ArrivalBackgroundVariant = "ambient-house-blur";

export const ARRIVAL_BACKGROUND_OPTIONS = [
  {
    id: "earth-brown",
    label: "A · Earth Brown",
    shortLabel: "Earth Brown",
    description: "Nền nâu đất tối, muted/faded. Đây là phương án sạch và tối giản quanh character.",
  },
  {
    id: "ambient-house-blur",
    label: "B · Ambient House Blur",
    shortLabel: "House Blur",
    description: "Blur/dim trực tiếp persistent House Ambient đang chạy phía sau để giữ đúng một world liên tục, không render bản House thứ hai.",
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
  if (value === "earth-brown" || value === "ambient-house-blur") return value;
  return DEFAULT_ARRIVAL_BACKGROUND;
}
