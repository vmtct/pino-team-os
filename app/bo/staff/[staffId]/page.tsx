import { StaffManagementView } from "../StaffManagementView";

export default async function StaffDetailPage({ params }: { params: Promise<{ staffId: string }> }) {
  const { staffId } = await params;
  return <StaffManagementView detailStaffId={staffId} />;
}
