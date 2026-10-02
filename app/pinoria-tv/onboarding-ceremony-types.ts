export type OnboardingStarterMember={
  variantId:string;
  displayName:string;
  slot:"HEAD/HAIR"|"FACE"|"HEADWEAR"|"OUTFIT"|"BACK"|"AURA_BACK"|"AURA_GROUND"|"PATH_MARK"|null;
  assetKey:string;
  renderMode:"LAYER"|"STANDALONE"|"WEBM";
  renderMetadata:Record<string,unknown>;
  sortOrder:number;
};
export type OnboardingStarterSet={
  id:string;
  displayName:string;
  version:number;
  webmAssetKey:string|null;
  members:OnboardingStarterMember[];
  slots:Record<string,string|null>;
};
export type OnboardingPreview={
  sessionId:string;
  pinoriaSelfId:string;
  displayName:string;
  selectedSet:OnboardingStarterSet|null;
  selectedSetVersion:number|null;
  selectionStale:boolean;
  expiresAt:string;
};
export type OnboardingCeremonyProjection={
  pinoriaSelfId:string;
  characterId:string;
  setId:string;
  setVersion:number;
  setDisplayName:string;
  displayName:string;
  webmAssetKey:string|null;
  members:OnboardingStarterMember[];
  slots:Record<string,string|null>;
};
