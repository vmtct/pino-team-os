import { BoRuntimeEntry } from "./components/registration/BoRuntimeBoundary";

export default async function BoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const options = Object.fromEntries(["centerId", "from", "to"].flatMap(key => typeof query[key] === "string" ? [[key, query[key]]] : []));
  return <BoRuntimeEntry moduleKey={typeof query.module === "string" ? query.module : "students"} options={options} />;
}
