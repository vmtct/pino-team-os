import fontStyles from "../pinoria-vietnamese-font.module.css";
import { PinoriaVietnameseLocale } from "../pinoria-vietnamese-locale";
import { OperationalTvRemoteControl } from "./prototype-remote-controls";
import shopPolish from "./shop-polish.module.css";
import { ShopTvOverlay } from "./shop-tv-overlay";
import { PinoriaTVPrototype } from "./tv-prototype";

export default async function PinoriaTVPage({ searchParams }: { searchParams: Promise<{ review?: string }> }) {
  const params = await searchParams;
  const reviewEnabled = params.review === "1";
  return (
    <PinoriaVietnameseLocale>
      <div className={`${fontStyles.vnFont} ${shopPolish.shopPolish}`} lang="vi">
        <PinoriaTVPrototype reviewEnabled={reviewEnabled} />
        <ShopTvOverlay />
        {reviewEnabled ? <OperationalTvRemoteControl /> : null}
      </div>
    </PinoriaVietnameseLocale>
  );
}
