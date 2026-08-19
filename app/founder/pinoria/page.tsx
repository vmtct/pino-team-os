import fontStyles from "../../pinoria-vietnamese-font.module.css";
import { PinoriaVietnameseLocale } from "../../pinoria-vietnamese-locale";
import { PinoriaPrototype } from "./pinoria-prototype";
import { PresencePrototypeLayer } from "./presence-prototype-layer";

export default function PinoriaPrototypePage() {
  return (
    <PinoriaVietnameseLocale>
      <div className={fontStyles.vnFont} lang="vi">
        <PresencePrototypeLayer>
          <PinoriaPrototype />
        </PresencePrototypeLayer>
      </div>
    </PinoriaVietnameseLocale>
  );
}
