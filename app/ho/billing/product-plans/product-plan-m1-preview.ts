// PAP-2183 / PAP-2182 · PLT-PRODUCT-PLAN. Synthetic-only M1 state.
import type { PreviewFeature, PreviewRecord } from "@/lib/m1-preview/contract";

export const productPlanBadges = ["ENTRY", "HERO", "STANDARD"] as const;
export type ProductPlanBadge = typeof productPlanBadges[number];
export type ProductPlanPreview = PreviewRecord & {
  cadence: number; termWeeks: number; price: number; currency: "VND";
  badge: ProductPlanBadge; enabled: boolean; version: number;
};
export const productPlanM1: PreviewFeature<ProductPlanPreview> = {
  feature: "HO-PRODUCT-PLANS", jiraTask: "PAP-2183", surface: "HO",
  idPrefix: "PRODUCT-PLAN-MOCK-", operations: ["replace"],
  seed: { id: "PRODUCT-PLAN-MOCK-001", fixture: true, createdAt: null,
    createdBy: null, updatedAt: null, updatedBy: null,
    cadence: 1, termWeeks: 12, price: 1990000, currency: "VND",
    badge: "ENTRY", enabled: true, version: 1 },
};
export function previewProductPlanUpdate(
  current: ProductPlanPreview, patch: unknown, expectedVersion: number,
): ProductPlanPreview | null {
  if (current.fixture !== true || current.id !== productPlanM1.seed.id ||
      current.version !== expectedVersion || !patch || typeof patch !== "object" || Array.isArray(patch)) return null;
  const values = patch as Record<string, unknown>;
  const keys = Object.keys(values);
  if (!keys.length || keys.some(k => !["price", "badge", "enabled"].includes(k))) return null;
  if ("price" in values && (typeof values.price !== "number" || !Number.isSafeInteger(values.price) || values.price < 0)) return null;
  if ("badge" in values && !productPlanBadges.includes(values.badge as ProductPlanBadge)) return null;
  if ("enabled" in values && typeof values.enabled !== "boolean") return null;
  return { ...current, ...values, version: current.version + 1 };
}

/** Canonical pathname review: legacy selector is normalization-only, never admission. */
export const PRODUCT_PLAN_REVIEW_PATH = "/ho/billing/product-plans";
export function parseProductPlanReviewQuery(query: URLSearchParams, allowLegacy = false) {
  const keys = [...query.keys()];
  if (keys.some(key => key !== "record" && key !== "m1Preview") ||
      query.getAll("record").length > 1 || query.getAll("m1Preview").length > 1) return null;
  const legacy = query.has("m1Preview");
  if (legacy && (!allowLegacy || query.get("m1Preview") !== "1")) return null;
  const record = query.get("record");
  if (record !== null && record !== productPlanM1.seed.id) return null;
  return { record: record ?? undefined, legacy };
}
export function isProductPlanLocalOrigin(origin: string) {
  return origin === "http://desktop-isrdren:8800" ||
    origin === "http://desktop-isrdren.tail3ee007.ts.net:8800";
}