import fontStyles from "../../pinoria-vietnamese-font.module.css";
import { PinoriaVietnameseLocale } from "../../pinoria-vietnamese-locale";
import { AmbientHouseScene } from "../ambient-house-scene";

export default function AmbientHouseDebugPage() {
  return (
    <PinoriaVietnameseLocale>
      <div className={fontStyles.vnFont} lang="vi">
        <AmbientHouseScene debug />
      </div>
    </PinoriaVietnameseLocale>
  );
}
