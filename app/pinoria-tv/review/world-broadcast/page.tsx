import fontStyles from "../../../pinoria-vietnamese-font.module.css";
import { PinoriaVietnameseLocale } from "../../../pinoria-vietnamese-locale";
import { DEFAULT_WORLD_BROADCAST, WorldBroadcastScene } from "../../world-broadcast-scene";

export default function WorldBroadcastReviewPage() {
  return (
    <PinoriaVietnameseLocale>
      <main
        className={fontStyles.vnFont}
        lang="vi"
        style={{
          position: "fixed",
          inset: 0,
          overflow: "hidden",
          background: "#0b0d11",
        }}
      >
        <WorldBroadcastScene broadcast={DEFAULT_WORLD_BROADCAST} />
      </main>
    </PinoriaVietnameseLocale>
  );
}
