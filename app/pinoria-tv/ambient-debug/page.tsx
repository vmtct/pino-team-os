import fontStyles from "../../pinoria-vietnamese-font.module.css";
import { PinoriaVietnameseLocale } from "../../pinoria-vietnamese-locale";
import { AmbientHouseEditorBootstrap } from "../ambient-house-editor-bootstrap";
import { AmbientMidDebugToggle } from "../ambient-mid-debug-toggle";

export default function AmbientHouseDebugPage() {
  return (
    <PinoriaVietnameseLocale>
      <div className={fontStyles.vnFont} lang="vi">
        <AmbientHouseEditorBootstrap />
        <AmbientMidDebugToggle />
      </div>
    </PinoriaVietnameseLocale>
  );
}
