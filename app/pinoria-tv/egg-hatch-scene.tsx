import { LayeredCharacter, pinoriaAssetUrl } from "./layered-character";
import type { EggHatchProjection } from "./presentation-types";
import styles from "./egg-hatch.module.css";

export const EGG_HATCH_SCENE_MS = 12_500;

export function EggHatchScene({ hatch }: { hatch: EggHatchProjection }) {
  const egg = pinoriaAssetUrl(hatch.egg.assetKey);
  const companion = pinoriaAssetUrl(hatch.companion.assetKey);
  const sigil = pinoriaAssetUrl(hatch.companion.sigilAssetKey);

  return <section className={styles.stage} aria-label={`${hatch.companion.displayName} hatched`}>
    <div className={styles.waterGlow} />
    <div className={styles.mist} />
    <div className={styles.ringOne} />
    <div className={styles.ringTwo} />
    <div className={styles.flash} />

    <div className={styles.characterZone}>
      <div className={styles.characterAura} />
      <LayeredCharacter className={styles.character} config={hatch.subject.character.config} />
      <div className={styles.ownerCopy}>
        <span>PINORIA · HỘ LINH</span>
        <strong>{hatch.subject.displayName}</strong>
      </div>
    </div>
    <div className={styles.hatchZone}>
      <div className={styles.eggWrap}>
        {egg ? <img className={styles.egg} src={egg} alt="" draggable={false} /> : null}
      </div>
      <div className={styles.companionWrap}>
        {sigil ? <img className={styles.sigil} src={sigil} alt="" draggable={false} /> : null}
        {companion ? <img className={styles.companion} src={companion} alt="" draggable={false} /> : null}
      </div>
    </div>

    <div className={styles.revealCopy}>
      <span>TRỨNG ĐÃ NỞ ✦</span>
      <h1>{hatch.companion.displayName}</h1>
      <p>Một Hộ Linh mới đã thức giấc trong Pinoria.</p>
      <small>{hatch.experience.profileKey} · CORE COMMITTED · TV PRESENTATION ONLY</small>
    </div>
  </section>;
}
