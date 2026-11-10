// PAP-1805 · homepage with two app entries, NO extra text blocks and no cloned app shell.
import Link from "next/link";
import {SPACES} from "./spaces";
import css from "./launcher.module.css";
export function SpaceLauncher(){
 return <div className={css.unifiedBackdrop}>
  <div className={css.unifiedShell} data-piner-shared="unified-shell" data-piner-launcher="two-apps">
   <header className={css.unifiedHeader} data-piner-shared="unified-header">
    <span className={css.launcherHeaderLabel}>Ứng dụng của bạn</span>
    <Link href="/piner" className={css.unifiedLogo} aria-label="Logo PINO Space">
     <strong>PINO</strong><small>SPACE</small>
    </Link>
   </header>
   <main className={css.launcherMain}>
    <div className={css.launcherWelcome}><h1>Piner Space</h1><p>Chọn không gian sáng tạo</p></div>
    <nav className={css.launcherTiles} aria-label="Chọn ứng dụng Piner Space">
      <Link href={SPACES.house.href} className={css.launcherSpaceTile} data-launch-app="house" data-theme="house">
       <span className={css.launcherTileArtwork} aria-hidden="true"><span className={css.launcherHouseGlyph}>✿</span><span className={css.launcherHouseRipple}>✎</span></span>
       <span className={css.launcherTileText}><small>PINO · FAMILY</small><strong>PINO House</strong><span>Hành trình sáng tạo của con</span></span>
       <span className={css.launcherTileArrow} aria-hidden="true">›</span>
      </Link>
      <Link href={SPACES.mytime.href} className={css.launcherSpaceTile} data-launch-app="mytime" data-theme="mytime">
       <span className={css.launcherTileArtwork} aria-hidden="true"><span className={css.launcherMytimeGlyph}>♫</span><span className={css.launcherMytimeRipple}>✷</span></span>
       <span className={css.launcherTileText}><small>PINO · PERSONAL</small><strong>MyTime</strong><span>Có hẹn với điều mình thích</span></span>
       <span className={css.launcherTileArrow} aria-hidden="true">›</span>
      </Link>
    </nav>
   </main>
   <footer className={css.launcherFoot}>PINO HOUSE <span>·</span> CREATIVE LIFE</footer>
  </div>
 </div>;
}
