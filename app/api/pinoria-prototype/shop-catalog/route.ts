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
  "hair-01": "Tóc 01",
  "face-01": "Gương mặt 01",
  "face-02": "Gương mặt 02",
  "face-03": "Gương mặt 03",
  "face-04": "Gương mặt 04",
};

function displayNameFor(slug: string) {
  if (DISPLAY_NAMES[slug]) return DISPLAY_NAMES[slug];
  return slug.split("-").map(titleCasePart).join(" ");
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
  return [...groups.values()]
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
    .filter((item): item is ShopCatalogItem => item !== null)
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
