import { expect, test } from "@playwright/test";

const CENTER_ID = "019d1000-0001-7000-8000-000000000001";
const variants = [
  ["019d3000-0040-7000-8000-000000000001", "draft/Char_hair_girl_short.png"],
  ["019d3000-0041-7000-8000-000000000001", "draft/Char_face_smiley.png"],
  ["019d3000-0042-7000-8000-000000000001", "draft/AuraLv3.png"],
  ["019d3000-0043-7000-8000-000000000001", "draft/Char_body_painting_girl.png"],
  ["019d3000-0044-7000-8000-000000000001", "draft/AuraLv3.png"],
  ["019d3000-0045-7000-8000-000000000001", "draft/AuraLv3.png"],
  ["019d3000-0046-7000-8000-000000000001", "draft/AuraLv3.png"],
  ["019d3000-0047-7000-8000-000000000001", "draft/AuraLv3.png"],
] as const;

test("GJ-PNR-WARD-01 projects equipped fixture v2 media through Core and renders it in Team Pinoria TV", async ({ page, request }) => {
  const snapshotResponse = await request.get(`/api/pinoria-tv/snapshot?centerId=${CENTER_ID}`);
  expect(snapshotResponse.ok()).toBe(true);
  const snapshot = await snapshotResponse.json() as { data?: { actors?: Array<Record<string, unknown>> } };
  const actor = snapshot.data?.actors?.find((candidate) => {
    const wardRender = candidate.wardRender as { variants?: Array<{ variantId?: string }> } | null | undefined;
    return wardRender?.variants?.some((variant) => variant.variantId === variants[0][0]);
  });
  expect(actor).toBeTruthy();
  const wardRender = actor!.wardRender as { mode?: string; variants?: Array<{ variantId?: string; assetKey?: string }> };
  expect(wardRender.mode).toBe("LAYERED");
  expect(wardRender.variants).toHaveLength(8);
  for (const [variantId, assetKey] of variants) {
    expect(wardRender.variants).toContainEqual(expect.objectContaining({ variantId, assetKey }));
  }

  await page.route("**/api/pinoria-tv/presentation**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ presentation: null }),
  }));
  await page.goto(`/pinoria-tv?centerId=${CENTER_ID}`);

  const character = page.locator(`[data-ambient-runtime-character]:has([data-ward-layer="${variants[0][0]}"])`);
  await expect(character).toHaveCount(1, { timeout: 10_000 });
  await expect(character.locator('[data-ward-render-mode="LAYERED"]')).toHaveCount(1);
  for (const [variantId, assetKey] of variants) {
    const layer = character.locator(`[data-ward-layer="${variantId}"]`);
    await expect(layer).toHaveCount(1);
    await expect(layer).toHaveAttribute("src", new RegExp(`https://assets\\.pinohouse\\.art/${assetKey.replace(/[.*+?^$()|[\\]{}]/g, "\\$&")}$`));
  }
});
