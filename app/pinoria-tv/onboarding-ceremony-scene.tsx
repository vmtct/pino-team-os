import {LayeredCharacter,type PinoriaCharacterConfig,type PinoriaWardRender,type PinoriaWardRenderVariant,type PinoriaWardSlot} from "./layered-character";
import type {OnboardingCeremonyProjection,OnboardingPreview,OnboardingStarterSet} from "./onboarding-ceremony-types";
import styles from "./onboarding-ceremony-scene.module.css";

const WARD_SLOTS=new Set<PinoriaWardSlot>(["HEAD/HAIR","FACE","HEADWEAR","OUTFIT","BACK","AURA_BACK","AURA_GROUND","PATH_MARK"]);

export function OnboardingPreviewScene({preview}:{preview:OnboardingPreview}){
  if(!preview.selectedSet||preview.selectionStale)return <section className={styles.preview} data-onboarding-preview="stale"><div className={styles.copy}><span>PINORIA · ONBOARDING</span><h1>Starter Set đã thay đổi</h1><p>Chọn lại Set trên TOS để TV nhận exact version mới.</p></div></section>;
  return <section className={styles.preview} data-onboarding-preview="active" data-onboarding-session={preview.sessionId}>
    <div className={styles.glow}/>
    <StarterSetAvatar set={preview.selectedSet}/>
    <div className={styles.copy}><span>CHỌN NHÂN VẬT · {preview.displayName.toUpperCase()}</span><h1>{preview.selectedSet.displayName}</h1><p>Preview · chưa phát Character · v{preview.selectedSetVersion}</p></div>
  </section>;
}

export function OnboardingCeremonyScene({ceremony}:{ceremony:OnboardingCeremonyProjection}){
  const set:OnboardingStarterSet={id:ceremony.setId,displayName:ceremony.setDisplayName,version:ceremony.setVersion,webmAssetKey:ceremony.webmAssetKey,members:ceremony.members,slots:ceremony.slots};
  return <section className={styles.reveal} data-onboarding-reveal={ceremony.characterId}>
    <div className={styles.glow}/><div className={styles.ring}/><StarterSetAvatar set={set}/>
    <div className={styles.copy}><span>CHARACTER GRANTED</span><h1>Chào {ceremony.displayName} ✦</h1><p>{ceremony.setDisplayName} đã trở thành nhân vật Pinoria của bạn.</p></div>
  </section>;
}

function StarterSetAvatar({set}:{set:OnboardingStarterSet}){
  const config:PinoriaCharacterConfig={};
  for(const member of set.members){
    if(member.slot==="HEAD/HAIR")config.hair=member.assetKey;
    if(member.slot==="FACE")config.face=member.assetKey;
    if(member.slot==="OUTFIT")config.outfit=member.assetKey;
    if(member.slot==="BACK")config.back=member.assetKey;
    if(member.slot==="HEADWEAR")config.headwear=member.assetKey;
  }
  const variants:PinoriaWardRenderVariant[]=set.members.flatMap(member=>{
    if(!member.slot||!WARD_SLOTS.has(member.slot))return[];
    return[{slot:member.slot,variantId:member.variantId,renderMode:member.renderMode,assetKey:member.assetKey,posterAssetKey:null,renderMetadata:member.renderMetadata}];
  });
  const wardRender:PinoriaWardRender={mode:set.webmAssetKey?"SET_WEBM":"LAYERED",webmAssetKey:set.webmAssetKey,variants};
  return <LayeredCharacter className={styles.character} config={config} wardRender={wardRender}/>;
}

export const ONBOARDING_CEREMONY_SCENE_MS=7200;
