import fontStyles from "../../../pinoria-vietnamese-font.module.css";
import { PinoriaVietnameseLocale } from "../../../pinoria-vietnamese-locale";
import { DEFAULT_ENERGY_SEED_REWARD, EnergySeedScene } from "../../energy-seed-scene";

const subject = {
  id: "bo",
  name: "Bơ",
  companion: "Bùm · Ploo · Cấp 2",
};

export default function EnergySeedReviewPage() {
  return (
    <PinoriaVietnameseLocale>
      <main
        className={fontStyles.vnFont}
        lang="vi"
        style={{
          position: "fixed",
          inset: 0,
          overflow: "hidden",
          background: "radial-gradient(circle at 50% 42%,#243044 0,#151a24 34%,#090a0e 78%)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: .48,
            background: "linear-gradient(115deg,rgba(64,91,81,.34),transparent 38%,rgba(65,53,96,.28))",
          }}
        />
        <EnergySeedScene subject={subject} reward={DEFAULT_ENERGY_SEED_REWARD} />
      </main>
    </PinoriaVietnameseLocale>
  );
}
