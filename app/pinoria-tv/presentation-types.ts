import type { PinoriaCharacterConfig } from "./layered-character";
import type { WishRevealProjection } from "./wish-reveal-types";

export type EggHatchProjection = {
  schemaVersion: 1;
  presentationId: string;
  centerId: string;
  visitId: string;
  subject: {
    studentProfileId: string;
    displayName: string;
    character: { id: string; config: PinoriaCharacterConfig };
  };
  egg: { id: string; assetKey: string };
  companion: {
    id: string;
    speciesId: string;
    key: string;
    displayName: string;
    assetKey: string;
    sigilAssetKey: string | null;
  };
  experience: { profileKey: string };
};

export type CompanionRitualProjection = {
  schemaVersion: 1;
  presentationId: string;
  centerId: string;
  visitId: string;
  subject: {
    studentProfileId: string;
    displayName: string;
    character: { id: string; config: PinoriaCharacterConfig };
  };
  companion: {
    id: string;
    speciesId: string;
    key: string;
    displayName: string;
    assetKey: string;
    sigilAssetKey: string | null;
    fromLevel: number;
    toLevel: number;
  };
  experience: { profileKey: string };
};

export type PinoriaPresentation =
  | {
      id: string;
      kind: "WISH_REVEAL";
      projection: WishRevealProjection;
      claimedAt: string;
    }
  | {
      id: string;
      kind: "EGG_HATCH";
      projection: EggHatchProjection;
      claimedAt: string;
    }
  | {
      id: string;
      kind: "COMPANION_RITUAL";
      projection: CompanionRitualProjection;
      claimedAt: string;
    };
