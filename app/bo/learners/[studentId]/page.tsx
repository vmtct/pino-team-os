import { StudentFullDetail } from "./StudentFullDetail";
export default function StudentDetailPage({ params }: { params: Promise<{ studentId: string }> }) {
  return <StudentFullDetail params={params} />;
}
