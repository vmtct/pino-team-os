"use client";
// PAP-2353 · HO Manual Staff Creation: native TDD shell, injected authenticated adapter.
// Admission and mock/live command transport belong to the caller, never this UI.
import { useRef, useState } from "react";
import type { AuthenticatedSurfaceAdapter } from "@/lib/workspace-adapters";
import type { AdapterNavigation } from "@/lib/workspace-adapters/navigation";
import { SurfaceWorkspace, type SurfaceWorkspaceProps } from "@/app/components/workspace-adapters/SurfaceWorkspace";
import type {createStaffPersonReader} from "./staff-person-reader";
import { StaffManualCreateDrawer,type StaffCreateRecovery } from "./StaffManualCreateDrawer";
import { manualStaffQuery, type ManualStaffFields, type StaffCenterOption, type StaffCreateCommand } from "./manual-create-contract";

type Props = {
  adapter: AuthenticatedSurfaceAdapter<ManualStaffFields>;
  navigation: AdapterNavigation<ManualStaffFields>;
  centers: readonly StaffCenterOption[];
  // Present only when the server-admitted capability and applicable transport permit creation.
  onCreate?: (command: StaffCreateCommand) => Promise<void>;
  personReader?:ReturnType<typeof createStaffPersonReader>;
  recovery?:StaffCreateRecovery;
  allowLogin?:boolean;
  detailSlots?: Pick<SurfaceWorkspaceProps<ManualStaffFields>, "businessForms" | "detailProperties" | "detailOverview">;
};
export function StaffManualWorkspace({ adapter, navigation, centers, onCreate, detailSlots, personReader,recovery,allowLogin }: Props) {
  const [open, setOpen] = useState(false), [revision, setRevision] = useState(0);
  const launch = useRef<HTMLButtonElement>(null);
  const close = () => { setOpen(false); requestAnimationFrame(() => launch.current?.focus()); };
  if (adapter.scope.surface !== "HO" || adapter.context.surface !== "HO" || !adapter.context.authorize("team.bo.access")) return <p role="alert">Không có quyền xem Staff.</p>;
  return <>
    <SurfaceWorkspace {...detailSlots} key={revision} adapter={adapter} navigation={navigation} initialQuery={manualStaffQuery} drawerReadOnly tableHeaderActions={onCreate ? <button ref={launch} type="button" className="primary-btn" onClick={() => setOpen(true)}>{recovery?.restored?.()?"Khôi phục yêu cầu tạo Staff":"＋ Tạo nhân sự"}</button> : undefined} />
    {open && onCreate && <StaffManualCreateDrawer schema={adapter.schema} context={adapter.context} centers={centers} personReader={personReader} allowLogin={allowLogin} recovery={recovery?{pending:recovery.pending,restored:recovery.restored,readback:async()=>{const committed=await recovery.readback();if(committed)setRevision(r=>r+1);return committed;}}:undefined} onClose={close} onCreate={async command => { await onCreate(command); setRevision(r => r + 1); }} />}
  </>;
}
