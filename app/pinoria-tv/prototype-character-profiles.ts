export type PrototypeCharacterProfileSlot = "back" | "body" | "hair" | "face" | "headwear" | "eyewear";
export type PrototypeCharacterLayerOverrides = Partial<Record<PrototypeCharacterProfileSlot, string | null>>;

export type PrototypeCharacterProfile = {
  id: string;
  subjectId: string;
  registrationProfile: "learner-v1";
  audience: "learner";
  layers: PrototypeCharacterLayerOverrides;
};

const PUBLISHER_ASSET_BASE = "https://pino-asset-publisher.minhtri-van42.workers.dev/assets/";

function asset(path: string) {
  return `${PUBLISHER_ASSET_BASE}${path}`;
}

// These profiles use only published learner-v1 layer-role assets from the
// pino-asset-publisher R2 registry. Until learner gender/profile truth is wired
// from Core, the mock runtime deliberately sticks to assets classified neutral.
export const prototypeCharacterProfiles: Record<string, PrototypeCharacterProfile> = {
  bo: {
    id: "mock-bo-v1",
    subjectId: "bo",
    registrationProfile: "learner-v1",
    audience: "learner",
    layers: {
      back: asset("pinoria/assets/hologram-wings/v001/layer.png"),
      body: asset("pinoria/assets/painting-outfit-01/v001/layer.png"),
      hair: asset("pinoria/assets/hair-long-brown-wavy-headband/v001/layer.png"),
      face: asset("pinoria/assets/face-01/v001/layer.png"),
      headwear: asset("pinoria/assets/birthday-hat/v001/layer.png"),
      eyewear: asset("pinoria/assets/star-glasses/v001/layer.png"),
    },
  },
  tri: {
    id: "mock-tri-v1",
    subjectId: "tri",
    registrationProfile: "learner-v1",
    audience: "learner",
    layers: {
      back: null,
      body: asset("pinoria/assets/piano-outfit-01/v001/layer.png"),
      hair: asset("pinoria/assets/hair-01/v001/layer.png"),
      face: asset("pinoria/assets/face-02/v001/layer.png"),
      headwear: asset("pinoria/assets/conical-hat/v001/layer.png"),
      eyewear: asset("pinoria/assets/party-glasses/v001/layer.png"),
    },
  },
  an: {
    id: "mock-an-v1",
    subjectId: "an",
    registrationProfile: "learner-v1",
    audience: "learner",
    layers: {
      back: asset("pinoria/assets/hologram-wings/v001/layer.png"),
      body: asset("pinoria/assets/painting-outfit-02/v001/layer.png"),
      hair: asset("pinoria/assets/hair-01/v001/layer.png"),
      face: asset("pinoria/assets/face-03/v001/layer.png"),
      headwear: asset("pinoria/assets/conical-hat/v001/layer.png"),
      eyewear: null,
    },
  },
  mai: {
    id: "mock-mai-v1",
    subjectId: "mai",
    registrationProfile: "learner-v1",
    audience: "learner",
    layers: {
      back: null,
      body: asset("pinoria/assets/base-body-01/v001/layer.png"),
      hair: asset("pinoria/assets/hair-01/v001/layer.png"),
      face: asset("pinoria/assets/face-04/v001/layer.png"),
      headwear: asset("pinoria/assets/birthday-hat/v001/layer.png"),
      eyewear: asset("pinoria/assets/party-glasses/v001/layer.png"),
    },
  },
};

export function prototypeCharacterProfileForSubject(subjectId?: string | null) {
  if (!subjectId) return undefined;
  return prototypeCharacterProfiles[subjectId];
}

export const prototypeCharacterProfileAssetUrls = Array.from(new Set(
  Object.values(prototypeCharacterProfiles)
    .flatMap((profile) => Object.values(profile.layers))
    .filter((value): value is string => typeof value === "string"),
));
