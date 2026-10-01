import { TosShell } from "@/app/components/tos-shell";
import { TOS_TV_FOOTER } from "@/app/components/tos-shell/navigation";
import { TvLauncher } from "./TvLauncher";
export default function TvPage(){return <TosShell title="PINO Team" subtitle="TV" theme="home" footerItems={TOS_TV_FOOTER} activeFooterId="tv"><TvLauncher/></TosShell>;}
