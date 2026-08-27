import fontStyles from "../pinoria-vietnamese-font.module.css";
import { PinoriaVietnameseLocale } from "../pinoria-vietnamese-locale";
import { OperationalTvRemoteControl } from "./prototype-remote-controls";
import shopPolish from "./shop-polish.module.css";
import { ShopTvOverlay } from "./shop-tv-overlay";
import { PinoriaTVPrototype } from "./tv-prototype";

export default function PinoriaTVPage() {
  return (
    <PinoriaVietnameseLocale>
      <div className={`${fontStyles.vnFont} ${shopPolish.shopPolish}`} lang="vi">
        <PinoriaTVPrototype />
        <ShopTvOverlay />
        <OperationalTvRemoteControl />
      </div>
    </PinoriaVietnameseLocale>
  );
}
