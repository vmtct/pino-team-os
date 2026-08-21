import fontStyles from "../../pinoria-vietnamese-font.module.css";
import { PinoriaVietnameseLocale } from "../../pinoria-vietnamese-locale";
import { AmbientHouseEditor } from "../ambient-house-editor";

export default function AmbientHouseDebugPage() {
  return (
    <PinoriaVietnameseLocale>
      <div className={fontStyles.vnFont} lang="vi">
        <AmbientHouseEditor />
      </div>
    </PinoriaVietnameseLocale>
  );
}
