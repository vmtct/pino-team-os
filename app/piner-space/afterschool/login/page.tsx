import type { Metadata } from "next";
import StagingAfterschoolLogin from "./StagingAfterschoolLogin";

export const metadata: Metadata = {
  title: "Đăng nhập PIN · PINO Afterschool",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <StagingAfterschoolLogin />;
}
