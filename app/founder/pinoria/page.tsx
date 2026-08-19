import fontStyles from "../../pinoria-vietnamese-font.module.css";
import { PinoriaVietnameseLocale } from "../../pinoria-vietnamese-locale";
import { PinoriaPrototype } from "./pinoria-prototype";

export default function PinoriaPrototypePage() {
  return (
    <PinoriaVietnameseLocale>
      <div className={fontStyles.vnFont} lang="vi">
        <PinoriaPrototype />
      </div>
    </PinoriaVietnameseLocale>
  );
}
