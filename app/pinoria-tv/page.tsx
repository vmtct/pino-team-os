import fontStyles from "../pinoria-vietnamese-font.module.css";
import { PinoriaVietnameseLocale } from "../pinoria-vietnamese-locale";
import { ShopTvOverlay } from "./shop-tv-overlay";
import { PinoriaTVPrototype } from "./tv-prototype";

export default function PinoriaTVPage() {
  return (
    <PinoriaVietnameseLocale>
      <div className={fontStyles.vnFont} lang="vi">
        <PinoriaTVPrototype />
        <ShopTvOverlay />
      </div>
    </PinoriaVietnameseLocale>
  );
}
