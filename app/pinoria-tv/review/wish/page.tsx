import fontStyles from "../../../pinoria-vietnamese-font.module.css";
import { PinoriaVietnameseLocale } from "../../../pinoria-vietnamese-locale";
import { OperationalTvRemoteControl } from "../../prototype-remote-controls";
import { PinoriaTVPrototype } from "../../tv-prototype";

export default function WishRevealReviewPage() {
  return (
    <PinoriaVietnameseLocale>
      <div className={fontStyles.vnFont} lang="vi">
        <PinoriaTVPrototype reviewEnabled />
        <OperationalTvRemoteControl />
      </div>
    </PinoriaVietnameseLocale>
  );
}
