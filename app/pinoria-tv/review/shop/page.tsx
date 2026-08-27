import fontStyles from "../../../pinoria-vietnamese-font.module.css";
import { PinoriaVietnameseLocale } from "../../../pinoria-vietnamese-locale";
import { ShopScene } from "../../shop-scene";
import { PINORIA_SHOP_SURFACE_ID } from "../../shop-types";

export default function PinoriaShopReviewPage() {
  return (
    <PinoriaVietnameseLocale>
      <main className={fontStyles.vnFont} lang="vi" style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#1b1411" }}>
        <ShopScene surfaceId={PINORIA_SHOP_SURFACE_ID} />
      </main>
    </PinoriaVietnameseLocale>
  );
}
