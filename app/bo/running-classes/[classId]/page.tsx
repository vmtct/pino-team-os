import { RunningClassFullDetail } from "../RunningClassFullDetail";

export default async function RunningClassDetailPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  return <RunningClassFullDetail classId={classId} />;
}
