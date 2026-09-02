import { notFound } from "next/navigation";
import { BoFramePrototype } from "./BoFramePrototype";

export default function BoFrameReviewPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return <BoFramePrototype />;
}
