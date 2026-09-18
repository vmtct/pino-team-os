import ClassroomView from "./ClassroomView";

type Props = { searchParams: Promise<{ sessionId?: string }> };

export default async function Page({ searchParams }: Props) {
  const params = await searchParams;
  return <ClassroomView initialSessionId={params.sessionId ?? ""} />;
}
