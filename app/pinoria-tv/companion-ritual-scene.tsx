import { LayeredCharacter, pinoriaAssetUrl } from "./layered-character";
import type { CompanionRitualProjection } from "./presentation-types";
import styles from "./companion-ritual.module.css";

export const COMPANION_RITUAL_SCENE_MS = 12_000;

export function CompanionRitualScene({ ritual }: { ritual: CompanionRitualProjection }) {
  const companion = pinoriaAssetUrl(ritual.companion.assetKey);
  const sigil = pinoriaAssetUrl(ritual.companion.sigilAssetKey);
  const fromLabel = `Cấp ${ritual.companion.fromLevel}`;
  const toLabel = `Cấp ${ritual.companion.toLevel}`;

  return <section className={styles.stage} aria-label={`${ritual.companion.displayName} materialization ritual`}>
    <div className={styles.glow} />
    <div className={styles.mist} />
    <div className={styles.rings}><i /><i /><i /></div>
    <div className={styles.flash} />

    <div className={styles.characterZone}>
      <div className={styles.characterAura} />
      <LayeredCharacter className={styles.character} config={ritual.subject.character.config} />
      <div className={styles.ownerCopy}>
        <span>PINORIA · NGHI THỨC</span>
        <strong>{ritual.subject.displayName}</strong>
      </div>
    </div>

    <div className={styles.ritualZone}>
      {sigil ? <img className={styles.sigil} src={sigil} alt="" draggable={false} /> : null}
      <div className={styles.companionWrap}>
        {companion ? <img className={styles.companion} src={companion} alt="" draggable={false} /> : <div className={styles.fallback}>✦</div>}
      </div>
      <div className={styles.levelTrack}>
        <span>{fromLabel}</span><b>→</b><strong>{toLabel}</strong>
      </div>
    </div>

    <div className={styles.revealCopy}>
      <span>NGHI THỨC HOÀN TẤT ✦</span>
      <h1>{ritual.companion.displayName}</h1>
      <p>{ritual.companion.displayName} đã đạt {toLabel.toLowerCase()}.</p>
      <small>{ritual.experience.profileKey} · CORE COMMITTED · TV PRESENTATION ONLY</small>
    </div>
  </section>;
}
