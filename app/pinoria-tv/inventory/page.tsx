import { InventoryScene } from "../inventory-scene";
import { PINORIA_SHOP_SURFACE_ID } from "../shop-types";

export default function PinoriaInventoryReviewPage() {
  return (
    <main style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#1b1411" }}>
      <InventoryScene surfaceId={PINORIA_SHOP_SURFACE_ID} />
    </main>
  );
}
