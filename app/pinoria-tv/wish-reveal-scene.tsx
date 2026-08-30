"use client";

import type { CSSProperties } from "react";
import { LayeredCharacter, pinoriaAssetUrl } from "./layered-character";
import type { WishRevealItem, WishRevealProjection, WishRevealPull } from "./wish-reveal-types";
import styles from "./wish-reveal.module.css";

export function wishRevealSceneMs(reveal: WishRevealProjection) {
  if (reveal.pulls.some((pull) => pull.revealKind === "PERFECT_MEMORY")) return 14_000;
  return reveal.pulls.length > 1 ? 17_000 : 11_500;
}

function imageUrl(item?: WishRevealItem) {
  return pinoriaAssetUrl(item?.layerAssetKey);
}

function revealTitle(reveal: WishRevealProjection) {
  if (reveal.pulls.some((pull) => pull.revealKind === "PERFECT_MEMORY")) return "Ký ức hoàn chỉnh";
  if (reveal.pulls.some((pull) => pull.revealKind === "FEATURED_MEMORY")) return "Dư âm đã hồi đáp";
  return "Ký ức được ghi nhận";
}

function pullName(pull: WishRevealPull) {
  if (pull.revealKind === "PERFECT_MEMORY") return "Trọn bộ ký ức";
  if (pull.wearables.length > 1) return `${pull.wearables.length} mảnh ký ức`;
  if (pull.wearables[0]) return pull.wearables[0].displayName;
  if (pull.revealKind === "VARIANT") return "Biến thể mới";
  return "Dư âm chuyển hoá";
}
function pullKind(pull: WishRevealPull) {
  if (pull.revealKind === "PERFECT_MEMORY") return "Perfect Memory";
  if (pull.revealKind === "FEATURED_MEMORY") return "Ký ức đặc trưng";
  if (pull.revealKind === "VARIANT") return "Biến thể wearable";
  if (pull.revealKind === "DUPLICATE") return "Ký ức đã sở hữu";
  return pull.source === "OFF_BANNER" ? "Wearable huyền thoại" : "Wearable";
}

function PullVisual({ pull }: { pull: WishRevealPull }) {
  if (pull.wearables.length > 1) {
    return <div className={styles.itemFan}>{pull.wearables.map((item) => {
      const src = imageUrl(item);
      return src
        ? <img key={item.id} src={src} alt="" draggable={false} />
        : <span key={item.id} className={styles.itemGlyph}>✦</span>;
    })}</div>;
  }
  const src = imageUrl(pull.wearables[0]);
  if (src) return <img src={src} alt="" draggable={false} />;
  return <span className={styles.itemGlyph}>{pull.revealKind === "DUPLICATE" ? "◇" : "✦"}</span>;
}

function PullCard({ pull, index }: { pull: WishRevealPull; index: number }) {
  const featured = pull.revealKind === "FEATURED_MEMORY" || pull.revealKind === "PERFECT_MEMORY";
  const resonanceAdvanced = pull.resonanceAfter > pull.resonanceBefore;
  return <article
    className={styles.pullCard}
    data-wish-pull={pull.pullIndex}
    data-rarity={pull.rarity}    data-featured={featured ? "true" : "false"}
    data-perfect={pull.revealKind === "PERFECT_MEMORY" ? "true" : "false"}
    style={{ "--pull-index": index } as CSSProperties}
  >
    <div className={styles.pullTop}>
      <span className={styles.pullIndex}>KÝ ỨC {pull.pullIndex}</span>
      <span className={styles.rarity}>
        {pull.rarity === "MYTHIC" ? "HUYỀN THOẠI" : pull.rarity === "RARE" ? "HIẾM" : "THƯỜNG"}
      </span>
    </div>
    <div className={styles.itemStage}><PullVisual pull={pull} /></div>
    <strong className={styles.itemName}>{pullName(pull)}</strong>
    <small className={styles.itemKind}>{pullKind(pull)}</small>
    {resonanceAdvanced ? <span className={styles.resonance}>C{pull.resonanceAfter}</span> : null}
  </article>;
}

export function WishRevealScene({ reveal }: { reveal: WishRevealProjection }) {
  const perfect = reveal.pulls.some((pull) => pull.revealKind === "PERFECT_MEMORY");
  const featured = reveal.pulls.some((pull) => pull.revealKind === "FEATURED_MEMORY" || pull.revealKind === "PERFECT_MEMORY");
  const lastPull = reveal.pulls.at(-1);
  const heroUrl = pinoriaAssetUrl(reveal.banner.heroAssetKey);
  const experience = reveal.banner.experience;
  const backgroundUrl = pinoriaAssetUrl(experience?.backgroundAssetKey);
  const musicUrl = pinoriaAssetUrl(experience?.musicAssetKey);
  const initial = reveal.banner.bearer.displayName.trim().charAt(0).toUpperCase() || "✦";
  const gridStyle = { "--pull-count": Math.max(1, reveal.pulls.length) } as CSSProperties;

  return <section
    className={styles.scene}
    data-pinoria-wish-reveal
    data-wish-reveal-id={reveal.revealId}    data-wish-pull-count={reveal.pulls.length}
    data-perfect={perfect ? "true" : "false"}
    data-profile={experience?.profileKey ?? "wish-reveal-v1"}
    data-theme={experience?.themeKey ?? "default"}
    data-vfx={experience?.vfxProfileKey ?? "default"}
  >
    {backgroundUrl ? <div className={styles.configuredBackground} style={{ backgroundImage: `url("${backgroundUrl}")` }} /> : null}
    {musicUrl ? <audio className={styles.music} src={musicUrl} autoPlay loop /> : null}
    <div className={styles.mist} /><div className={styles.vignette} />
    <header className={styles.header}>
      <div>
        <span className={styles.eyebrow}>PINORIA · GIEO ƯỚC</span>
        <strong className={styles.bannerName}>{reveal.banner.displayName}</strong>
      </div>
      <span className={styles.region}>{reveal.banner.regionKey.replaceAll("-", " ")}</span>
    </header>
    <div className={styles.layout}>
      <section className={styles.memory}>
        <div className={styles.halo} />
        {heroUrl
          ? <img className={styles.heroImage} src={heroUrl} alt="" draggable={false} />
          : <div className={styles.bearerMark}>{initial}</div>}
        <div className={styles.bearerCaption}>
          <span>ORIGINAL BEARER</span>
          <strong>{reveal.banner.bearer.displayName}</strong>
          <small>{reveal.banner.bearer.title}</small>
        </div>
      </section>
      <section className={styles.results}>
        <div className={styles.learnerBadge}>
          <div className={styles.learnerMini}>
            <LayeredCharacter config={reveal.subject.character.config} className={styles.learnerCharacter} />
          </div>          <div><span>ƯỚC CỦA</span><strong>{reveal.subject.displayName}</strong></div>
        </div>
        <p className={styles.story}>{reveal.banner.storyHook}</p>
        <h1 className={styles.resultTitle}>{revealTitle(reveal)}</h1>
        <div className={styles.resultMeta}>
          <span className={`${styles.chip} ${featured ? styles.chipGold : ""}`}>
            {featured ? `Cộng Hưởng · C${Math.max(0, lastPull?.resonanceAfter ?? 0)}` : "Wearable Memory"}
          </span>
          <span className={styles.chip}>
            {reveal.banner.signatureSet.displayName} · {lastPull?.setProgressAfter.owned ?? 0}/3
          </span>
          <span className={styles.chip}>{reveal.pulls.length === 1 ? "Gieo ×1" : `Gieo ×${reveal.pulls.length}`}</span>
        </div>
        <div
          className={styles.pullGrid}
          data-single={reveal.pulls.length === 1 ? "true" : "false"}
          data-perfect={perfect ? "true" : "false"}
          style={gridStyle}
        >
          {reveal.pulls.map((pull, index) => <PullCard key={pull.pullIndex} pull={pull} index={index} />)}
        </div>
      </section>
    </div>
    <footer className={styles.footer}>
      <strong>{perfect ? "TRỌN BỘ KÝ ỨC ĐÃ ĐƯỢC GHI NHẬN" : "KẾT QUẢ ĐÃ ĐƯỢC GHI NHẬN"}</strong>
      <span className={styles.commit}>CORE COMMITTED · TV PRESENTATION ONLY</span>
    </footer>
  </section>;
}
