import { TosShell } from "@/app/components/tos-shell";
import { TOS_TV_FOOTER } from "@/app/components/tos-shell/navigation";
import { TvOperatorQueue } from "./TvOperatorQueue";

export default function TvOperatorPage() {
  return (
    <TosShell title="PINO Team" subtitle="TV operator" theme="home" footerItems={TOS_TV_FOOTER} activeFooterId="tv">
      <TvOperatorQueue />
    </TosShell>
  );
}
