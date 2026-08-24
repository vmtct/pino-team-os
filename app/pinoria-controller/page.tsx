import type { Metadata } from "next";
import { PinoriaStaffController } from "./pinoria-staff-controller";

export const metadata: Metadata = {
  title: "Pinoria Staff Controller | PINO Team OS",
  description: "Mobile-first staff remote for the shared Pinoria TV Shop and Túi Hành Trang.",
};

export default function PinoriaControllerPage() {
  return <PinoriaStaffController />;
}
