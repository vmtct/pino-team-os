import fontStyles from "../pinoria-vietnamese-font.module.css";
import { PinoriaVietnameseLocale } from "../pinoria-vietnamese-locale";
import { ChoiceFinalPolishLayer } from "./choice-final-polish-layer";
import { PinoriaTVPrototype } from "./tv-prototype";

export default function PinoriaTVPage() {
  return (
    <PinoriaVietnameseLocale>
      <div className={fontStyles.vnFont} lang="vi">
        <ChoiceFinalPolishLayer>
          <PinoriaTVPrototype />
        </ChoiceFinalPolishLayer>
      </div>
    </PinoriaVietnameseLocale>
  );
}
