// PAP-1806 · Icon-first two-app launcher; shared PINO mobile shell, theme token only.
import Link from "next/link";
import {PinoIcon} from "./PinoIcon";
import {SPACES} from "./spaces";
import css from "./launcher.module.css";
export function SpaceLauncher(){
 return <div className={css.unifiedBackdrop}>
  <div className={css.unifiedShell} data-piner-shared="unified-shell" data-piner-launcher="two-apps">
   <header className={css.unifiedHeader} data-piner-shared="unified-header">
    <span className={css.launcherHeaderLabel}><PinoIcon name="grid"/> Ứng dụng</span>
    <Link href="/piner" className={css.unifiedLogo} aria-label="Logo PINO Space">
     <strong>PINO</strong><small>SPACE</small>
    </Link>
   </header>
   <main className={css.launcherMain}>
    <h1 className={css.visuallyHidden}>Piner Space · Chọn ứng dụng</h1>
    <nav className={css.launcherTiles} aria-label="Chọn ứng dụng Piner Space">
     <Link href={SPACES.house.href} className={css.launcherSpaceTile} data-launch-app="house" data-theme="house">
      <span className={css.launcherTileArtwork} aria-hidden="true">
       <PinoIcon name="house" className={css.launcherHeroIcon}/>
      </span>
      <span className={css.launcherTileText}>
       <strong>PINO House</strong><span>Gia đình</span>
      </span>
      <PinoIcon name="right" className={css.launcherTileArrow}/>
     </Link>
     <Link href={SPACES.mytime.href} className={css.launcherSpaceTile} data-launch-app="mytime" data-theme="mytime">
      <span className={css.launcherTileArtwork} aria-hidden="true">
       <PinoIcon name="mytime" className={css.launcherHeroIcon}/>
      </span>
      <span className={css.launcherTileText}>
       <strong>MyTime</strong><span>Của tôi</span>
      </span>
      <PinoIcon name="right" className={css.launcherTileArrow}/>
     </Link>
    </nav>
   </main>
  </div>
 </div>;
}
