/* PAP-1606 / PAP-1601. Existing HO layout enforces authenticated Founder access. */
import { HoWorkspace } from "@/app/ho/HoWorkspace";
import { HoLanguageMappingPending } from "./HoLanguageMappingPending";

export default function HoLanguageMappingsPage() {
  return <HoWorkspace module="languageMappings" content={<HoLanguageMappingPending />} />;
}
