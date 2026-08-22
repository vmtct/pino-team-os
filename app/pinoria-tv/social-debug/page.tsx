import fontStyles from "../../pinoria-vietnamese-font.module.css";
import { PinoriaVietnameseLocale } from "../../pinoria-vietnamese-locale";
import { AmbientSocialSimulation } from "../ambient-social-simulation";

export default function AmbientSocialDebugPage() {
  return (
    <PinoriaVietnameseLocale>
      <div className={fontStyles.vnFont} lang="vi" style={{ position: "fixed", inset: 0, background: "#101711" }}>
        <AmbientSocialSimulation />
      </div>
    </PinoriaVietnameseLocale>
  );
}
