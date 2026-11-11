// PAP-1824 · PNR-APP-HUB · Founder mobile mockup / existing R2 assets only.
import Link from "next/link";
import {PinoIcon} from "./PinoIcon";
import {SPACES} from "./spaces";
import css from "./launcher.module.css";
const R2="https://app.pinohouse.art/";
const PINO_LOGO="https://assets.pinohouse.art/site/core/Pino%20Sigil.png";
export function SpaceLauncher(){
 return <div className={css.unifiedBackdrop}>
  <div className={[css.unifiedShell,css.launcherMockShell].join(" ")} data-piner-shared="unified-shell" data-piner-launcher="two-apps">
   <main className={css.launcherMockMain}>
    <h1 className={css.visuallyHidden}>Piner APP · Chọn chương trình</h1>
    <div className={css.launcherMockBrand} data-pino-canonical-logo="true">
     <img src={PINO_LOGO} className={css.launcherCanonicalSigil}
       alt="Biểu tượng PINO chính thức" width="48" height="48" loading="eager" decoding="async"/>
     <img src={R2+"piner_app_logo_no_yellow_transparent.png"} className={css.launcherPinerWordmark}
       alt="Piner APP" width="220" height="106" loading="eager" decoding="async"/>
    </div>
    <nav className={css.launcherMockCards} aria-label="Chọn chương trình Piner APP">
     <Link href={SPACES.house.href} className={[css.launcherMockCard,css.launcherMockJourney].join(" ")}
      data-launch-app="house" data-theme="house" aria-label="Mở PINO Afterschool">
      <span className={css.launcherMockCardContent}>
       <strong className={css.launcherMockTitle}><span className={css.launcherMockPinoName}>PINO</span><br/>Afterschool</strong>
       <span className={css.launcherMockDescription}>Hết giờ học,<br/>Đến giờ con khám phá.</span>
       <span className={css.launcherMockArrow} aria-hidden="true"><PinoIcon name="right"/></span>
      </span>
     </Link>
     <Link href={SPACES.mytime.href} className={[css.launcherMockCard,css.launcherMockMytime].join(" ")}
      data-launch-app="mytime" data-theme="mytime" aria-label="Mở MyTime by PINO">
      <span className={css.launcherMockCardContent}>
       <strong className={css.launcherMockTitle}>MyTime<span className={css.launcherMockBy}>by PINO</span></strong>
       <span className={css.launcherMockDescription}>Hết những bận rộn, đến giờ mình tận hưởng.</span>
       <span className={css.launcherMockArrow} aria-hidden="true"><PinoIcon name="right"/></span>
      </span>
     </Link>
    </nav>
   </main>
  </div>
 </div>;
}
