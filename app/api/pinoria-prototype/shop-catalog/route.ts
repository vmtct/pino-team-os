import { NextResponse } from "next/server";
import { categoryForAsset, type ShopCatalogItem } from "../../../pinoria-tv/shop-types";

const PUBLISHER_ORIGIN = "https://pino-asset-publisher.minhtri-van42.workers.dev";
const REGISTRY_URL = `${PUBLISHER_ORIGIN}/registry`;
const ASSET_BASE = `${PUBLISHER_ORIGIN}/assets/`;

type RegistryEntry = {
  assetId?: string;
  assetSlug?: string;
  assetFamily?: string;
  assetRole?: string;
  assetVersion?: string;
  audience?: string;
  slot?: string;
  gender?: string;
  registrationProfile?: string;
  path?: string;
};

type RegistryPayload = {
  schemaVersion?: number;
  updatedAt?: string;
  entries?: Record<string, RegistryEntry>;
};

type AssetGroup = {
  assetId: string;
  slug: string;
  version: string;
  family: string;
  slot: string;
  gender: string;
  registrationProfile: string;
  layer?: RegistryEntry;
  standalone?: RegistryEntry;
};

function titleCasePart(value: string) {
  return value ? value.charAt(0).toLocaleUpperCase("vi-VN") + value.slice(1) : value;
}

const DISPLAY_NAMES: Record<string, string> = {
  "hologram-wings": "Cánh Hologram",
  "birthday-hat": "Nón Sinh Nhật",
  "star-glasses": "Kính Sao",
  "party-glasses": "Kính Tiệc",
  "conical-hat": "Nón Lá",
  "piano-outfit-01": "Trang phục Piano I",
  "piano-outfit-02": "Trang phục Piano II",
  "painting-outfit-01": "Trang phục Hội Họa I",
  "painting-outfit-02": "Trang phục Hội Họa II",
  "base-body-01": "Trang phục Cơ Bản",
  "hair-01": "Tóc Cơ Bản",
  "face-01": "Gương mặt Mỉm Cười",
  "face-02": "Gương mặt Tinh Nghịch",
  "face-03": "Gương mặt Dịu Dàng",
  "face-04": "Gương mặt Rạng Rỡ",
};

const TOKEN_LABELS: Record<string, string> = {
  brown: "Nâu",
  nau: "Nâu",
  beige: "Be",
  cream: "Kem",
  white: "Trắng",
  black: "Đen",
  blue: "Xanh",
  green: "Xanh Rêu",
  olive: "Ô-liu",
  pink: "Hồng",
  purple: "Tím",
  yellow: "Vàng",
  red: "Đỏ",
  orange: "Cam",
  basic: "Cơ Bản",
  base: "Cơ Bản",
  painting: "Hội Họa",
  piano: "Piano",
  artist: "Họa Sĩ",
  explorer: "Thám Hiểm",
  classic: "Cổ Điển",
  long: "Dài",
  short: "Ngắn",
  medium: "Ngang Vai",
  bob: "Bob",
  wavy: "Gợn Sóng",
  spiky: "Dựng",
  headband: "Băng Đô",
  clip: "Kẹp",
  star: "Sao",
  middle: "Giữa",
  side: "Bên",
  part: "Rẽ",
};

function displayToken(value: string) {
  return TOKEN_LABELS[value] ?? titleCasePart(value);
}

function hairDisplayName(parts: string[]) {
  const source = [...parts];
  if (source[0] === "hair") source.shift();

  const hasBob = source.includes("bob");
  const length = source.includes("long") ? "Dài" : source.includes("short") ? "Ngắn" : hasBob ? "Bob" : source.includes("medium") ? "Ngang Vai" : null;
  const color = source.includes("brown") || source.includes("nau") ? "Nâu" : null;
  const texture = source.includes("wavy") ? "Gợn Sóng" : source.includes("spiky") ? "Dựng" : null;
  const accessory = source.includes("headband") ? "Băng Đô" : source.includes("star") && source.includes("clip") ? "Kẹp Sao" : null;
  const parting = source.includes("middle") && source.includes("part") ? "Rẽ Giữa" : source.includes("side") && source.includes("part") ? "Rẽ Bên" : null;

  const known = new Set(["long", "short", "medium", "bob", "brown", "nau", "wavy", "spiky", "headband", "star", "clip", "middle", "side", "part"]);
  const extras = source.filter((token) => !known.has(token)).map(displayToken);
  return ["Tóc", length, color, texture, parting, accessory, ...extras].filter(Boolean).join(" ");
}

function displayNameFor(slug: string) {
  if (DISPLAY_NAMES[slug]) return DISPLAY_NAMES[slug];

  // Publisher draft slugs can carry technical source/hash suffixes. Keep those
  // identifiers in metadata, but never leak them into the learner-facing TV UI.
  const cleaned = slug
    .replace(/-src-[a-z0-9]+$/i, "")
    .replace(/-source-[a-z0-9]+$/i, "")
    .replace(/-draft-[a-z0-9]+$/i, "");
  const parts = cleaned.split("-").filter(Boolean);

  if (parts[0] === "hair") return hairDisplayName(parts);
  if (parts[0] === "body") parts.shift();

  const noun = parts[0];
  if (noun === "shorts") {
    parts.shift();
    return ["Bộ Shorts", ...parts.map(displayToken)].join(" ").trim();
  }
  if (noun === "dress") {
    parts.shift();
    return ["Váy", ...parts.map(displayToken)].join(" ").trim();
  }
  if (noun === "overalls" || noun === "overall") {
    parts.shift();
    return ["Yếm", ...parts.map(displayToken)].join(" ").trim();
  }
  if (noun === "outfit") {
    parts.shift();
    return ["Trang phục", ...parts.map(displayToken)].join(" ").trim();
  }

  return parts.map(displayToken).join(" ") || "Vật phẩm Pinoria";
}

function stableHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  return Math.abs(hash);
}

function prototypePrice(slug: string) {
  return 80 + (stableHash(slug) % 8) * 20;
}

function toAssetUrl(entry: RegistryEntry | undefined) {
  return entry?.path ? `${ASSET_BASE}${entry.path}` : undefined;
}

function catalogFromRegistry(registry: RegistryPayload): ShopCatalogItem[] {
  const groups = new Map<string, AssetGroup>();

  for (const entry of Object.values(registry.entries ?? {})) {
    if (!entry.assetId || !entry.assetSlug || !entry.assetVersion || !entry.path) continue;
    if (entry.audience !== "learner" && entry.audience !== "universal") continue;
    if (entry.registrationProfile !== "learner-v1" && entry.registrationProfile !== "universal-v1") continue;
    if (entry.assetRole !== "layer" && entry.assetRole !== "standalone") continue;

    const category = categoryForAsset(entry.slot, entry.assetFamily);
    if (!category) continue;

    const key = entry.assetId;
    const existing = groups.get(key);
    const shouldReplace = !existing || entry.assetVersion.localeCompare(existing.version, undefined, { numeric: true }) > 0;

    if (shouldReplace) {
      groups.set(key, {
        assetId: entry.assetId,
        slug: entry.assetSlug,
        version: entry.assetVersion,
        family: entry.assetFamily ?? "cosmetic",
        slot: entry.slot ?? "none",
        gender: entry.gender ?? "neutral",
        registrationProfile: entry.registrationProfile ?? "learner-v1",
        layer: entry.assetRole === "layer" ? entry : undefined,
        standalone: entry.assetRole === "standalone" ? entry : undefined,
      });
      continue;
    }

    if (existing && entry.assetVersion === existing.version) {
      if (entry.assetRole === "layer") existing.layer = entry;
      if (entry.assetRole === "standalone") existing.standalone = entry;
    }
  }

  const order = ["hair", "face", "headwear", "eyewear", "back", "body", "prop"];
  const mapped = [...groups.values()]
    .map((group) => {
      const category = categoryForAsset(group.slot, group.family);
      const layerUrl = toAssetUrl(group.layer);
      const imageUrl = toAssetUrl(group.standalone) ?? layerUrl;
      if (!category || !imageUrl) return null;
      return {
        assetId: group.assetId,
        slug: group.slug,
        version: group.version,
        displayName: displayNameFor(group.slug),
        family: group.family,
        slot: group.slot,
        category,
        gender: group.gender,
        registrationProfile: group.registrationProfile,
        imageUrl,
        layerUrl,
        pricePls: prototypePrice(group.slug),
        previewable: !!layerUrl && ["hair", "face", "headwear", "eyewear", "back", "body"].includes(group.slot),
      } satisfies ShopCatalogItem;
    })
    .filter((item): item is ShopCatalogItem => item !== null);

  // Once richer hair assets exist, the old generic hair-01 is only a base
  // character layer and adds visual noise to the learner-facing shop catalog.
  const hasRichHairCatalog = mapped.some((item) => item.category === "hair" && item.slug !== "hair-01");

  return mapped
    .filter((item) => !(hasRichHairCatalog && item.slug === "hair-01"))
    .sort((a, b) => {
      const categoryDelta = order.indexOf(a.category) - order.indexOf(b.category);
      if (categoryDelta) return categoryDelta;
      return a.displayName.localeCompare(b.displayName, "vi");
    });
}

function fallbackCatalog(): ShopCatalogItem[] {
  const rows: Array<[string, string, string, string, boolean]> = [
    ["asset_hair_01", "hair-01", "hair", "cosmetic", true],
    ["asset_face_01", "face-01", "face", "cosmetic", true],
    ["asset_face_02", "face-02", "face", "cosmetic", true],
    ["asset_face_03", "face-03", "face", "cosmetic", true],
    ["asset_face_04", "face-04", "face", "cosmetic", true],
    ["asset_birthday_hat", "birthday-hat", "headwear", "cosmetic", true],
    ["asset_conical_hat", "conical-hat", "headwear", "cosmetic", true],
    ["asset_star_glasses", "star-glasses", "eyewear", "cosmetic", true],
    ["asset_party_glasses", "party-glasses", "eyewear", "cosmetic", true],
    ["asset_hologram_wings", "hologram-wings", "back", "cosmetic", true],
    ["asset_piano_outfit_01", "piano-outfit-01", "body", "cosmetic", true],
    ["asset_piano_outfit_02", "piano-outfit-02", "body", "cosmetic", true],
    ["asset_painting_outfit_01", "painting-outfit-01", "body", "cosmetic", true],
    ["asset_painting_outfit_02", "painting-outfit-02", "body", "cosmetic", true],
  ];

  return rows.map(([assetId, slug, slot, family, previewable]) => {
    const category = categoryForAsset(slot, family) ?? "all";
    const layerUrl = `${ASSET_BASE}pinoria/assets/${slug}/v001/layer.png`;
    return {
      assetId,
      slug,
      version: "v001",
      displayName: displayNameFor(slug),
      family,
      slot,
      category,
      gender: "neutral",
      registrationProfile: "learner-v1",
      imageUrl: `${ASSET_BASE}pinoria/assets/${slug}/v001/standalone.png`,
      layerUrl,
      pricePls: prototypePrice(slug),
      previewable,
    };
  });
}

export async function GET() {
  try {
    const response = await fetch(REGISTRY_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`REGISTRY_${response.status}`);
    const registry = await response.json() as RegistryPayload;
    const items = catalogFromRegistry(registry);
    if (!items.length) throw new Error("EMPTY_REGISTRY_CATALOG");
    return NextResponse.json({
      ok: true,
      source: "publisher-registry",
      registryUpdatedAt: registry.updatedAt ?? null,
      priceMode: "prototype",
      items,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({
      ok: true,
      source: "prototype-fallback",
      registryUpdatedAt: null,
      priceMode: "prototype",
      warning: error instanceof Error ? error.message : "REGISTRY_UNAVAILABLE",
      items: fallbackCatalog(),
    }, { headers: { "Cache-Control": "no-store" } });
  }
}
