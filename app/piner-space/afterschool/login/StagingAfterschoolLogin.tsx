"use client";

import { useRouter } from "next/navigation";
import AfterschoolPinForm from "../../../piner/public/login/afterschool/AfterschoolPinForm";

export default function StagingAfterschoolLogin() {
  const router = useRouter();
  return <AfterschoolPinForm onAuthenticated={() => router.replace("/piner-space")} />;
}
