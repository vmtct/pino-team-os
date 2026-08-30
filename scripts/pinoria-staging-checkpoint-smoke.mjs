const baseUrl = (process.env.PINORIA_STAGING_URL || "https://pino-team-os-staging.minhtri-van42.workers.dev").replace(/\/$/, "");
const centerId = process.env.PINORIA_CENTER_ID || "019d1000-0001-7000-8000-000000000001";
const studentProfileId = process.env.PINORIA_STUDENT_PROFILE_ID || "019d1000-0002-7000-8000-000000000002";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

async function read(path) {
  const response = await fetch(`${baseUrl}${path}`, { headers: { accept: "application/json" } });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path} -> ${response.status}: ${JSON.stringify(json)}`);
  invariant(json && typeof json === "object" && "data" in json, `${path} missing data envelope`);
  return json.data;
}

const params = new URLSearchParams({ centerId, studentProfileId });
const readiness = await read(`/api/tos-learning/pinoria/companion/readiness?${params}`);
invariant(Number.isInteger(readiness.fruitBalance) && readiness.fruitBalance >= 0, "Fruit balance invalid");
invariant(Array.isArray(readiness.companions) && readiness.companions.length > 0, "No active Companion projection");
const companion = readiness.companions[0];
invariant(Number.isInteger(companion.materializationLevel) && companion.materializationLevel >= 2, "Companion checkpoint has not reached Lv2");
invariant(["GROWING", "READY_FOR_RITUAL"].includes(companion.state), "Companion state invalid");

const activities = await read(`/api/tos-learning/pinoria/activities/available?${params}`);
invariant(Array.isArray(activities), "Activities projection invalid");
invariant(activities.some((item) => item.handlerKey === "WISH_DRAW"), "Wish activity is not projected");
invariant(activities.some((item) => item.handlerKey === "COMPANION_RITUAL"), "Companion ritual activity is not projected");

const bannerParams = new URLSearchParams({ centerId, familyKey: "LIMITED_WARDROBE" });
const banners = await read(`/api/tos-learning/pinoria/wish/banners/active?${bannerParams}`);
invariant(Array.isArray(banners) && banners.length > 0, "No active LIMITED_WARDROBE banner");
const banner = banners[0];
invariant(banner.id && banner.rulesVersion && banner.definitionHash, "Active banner snapshot is incomplete");

const wishParams = new URLSearchParams({ centerId, studentProfileId, bannerId: banner.id });
const wishState = await read(`/api/tos-learning/pinoria/wish/state?${wishParams}`);
invariant(wishState.pity.nextMythicPityPosition <= wishState.pity.mythicGuaranteedWithin, "Mythic pity exceeds guarantee");
invariant(wishState.pity.nextRarePityPosition <= wishState.pity.rareGuaranteedWithin, "Rare pity exceeds guarantee");
invariant(wishState.signatureSet.progress.owned <= wishState.signatureSet.progress.total, "Signature set progress invalid");
if (wishState.energySeedBalance >= 1) invariant(wishState.canDrawOne === true, "Draw-one availability disagrees with Seed balance");
if (wishState.energySeedBalance < 5) invariant(wishState.canDrawFive === false, "Draw-five availability disagrees with Seed balance");

const historyParams = new URLSearchParams({ centerId, studentProfileId, limit: "10" });
const history = await read(`/api/tos-learning/pinoria/wish/history?${historyParams}`);
invariant(Array.isArray(history), "Wish history projection invalid");

console.log(JSON.stringify({
  status: "PASS",
  mode: "READ_ONLY",
  companion: {
    id: companion.companionId,
    level: companion.materializationLevel,
    state: companion.state,
    stageFeedCount: companion.stageFeedCount,
    fruitBalance: readiness.fruitBalance,
  },
  wish: {
    bannerId: banner.id,
    rulesVersion: banner.rulesVersion,
    energySeedBalance: wishState.energySeedBalance,
    mythic: `${wishState.pity.nextMythicPityPosition}/${wishState.pity.mythicGuaranteedWithin}`,
    rare: `${wishState.pity.nextRarePityPosition}/${wishState.pity.rareGuaranteedWithin}`,
    resonanceLevel: wishState.bearer.resonanceLevel,
    signatureSet: `${wishState.signatureSet.progress.owned}/${wishState.signatureSet.progress.total}`,
    historyCount: history.length,
  },
}, null, 2));
