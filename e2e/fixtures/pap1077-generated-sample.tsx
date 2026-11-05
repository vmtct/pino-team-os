import { decideHostBoundary } from "../../lib/host-boundary";
declare global { interface Window { __pap1077HostMatrix?: Record<string, string> } }
import { createRoot } from "react-dom/client";
import { SurfaceWorkspace } from "../../app/components/workspace-adapters/SurfaceWorkspace";
import { createBoTddAdapter, createHoTddAdapter, type SurfaceDefinition, type SurfaceProvider } from "../../lib/workspace-adapters";
import { browserTddNavigation } from "../../lib/workspace-adapters/navigation";
import { TddRegistry, type FieldSchema, type ModuleRow, type TableQuery } from "../../lib/workspace-schema";

// Test-only consumer of the actual generated schema and fixture. Never imported
// by an application route; production generated providers remain deny-first.
export async function mountGeneratedSample<F extends readonly FieldSchema[]>(generated: SurfaceDefinition<F>, query: TableQuery<F>, rows: readonly ModuleRow<F>[]) {
  const scenario = new URL(location.href).searchParams.get("scenario");
  const surface = generated.surface;
  window.__pap1077HostMatrix = {
    own: decideHostBoundary(location.hostname, location.pathname).action,
    head: decideHostBoundary(location.hostname, location.pathname, "HEAD").action,
    post: decideHostBoundary(location.hostname, location.pathname, "POST").action,
    child: decideHostBoundary(location.hostname, location.pathname + "/extra").action,
    other: decideHostBoundary(surface === "BO" ? "ho.staging.pinohouse.art" : "bo.staging.pinohouse.art", location.pathname).action,
    production: decideHostBoundary(surface === "BO" ? "bo.pinohouse.art" : "ho.pinohouse.art", location.pathname).action,
  };
  const centerId = "019d2000-0001-7000-8000-000000000010";
  const foreignId = "019d2000-0001-7000-8000-000000000011";
  const permission = generated.capabilities.read;
  const definition: SurfaceDefinition<F> = { ...generated, detail: { ...generated.detail, businessTabs: [
    { id: "sample-business", label: "Thông tin bổ sung", kind: "field-group", source: { adapter: "synthetic.sample", permission }, sections: generated.detail.overview.sections },
  ] } };
  const fetcher: typeof fetch = async (input, init) => {
    if (init?.method && init.method !== "GET") throw Error("Synthetic transport denies writes");
    const path = new URL(String(input)).pathname;
    if (path === "/api/bo/context") return Response.json({ data: { surface: scenario === "forged-principal" ? "HO" : "BO", entitled: true, userId: "SYNTHETIC-DEMO-ONLY", permissionKeys: ["team.bo.access", ...(scenario === "denied" ? [] : [permission])] } });
    if (path === "/api/bo/centers" && surface === "BO") return Response.json({ data: [{ id: scenario === "unauthorized-center" ? foreignId : centerId }] });
    throw Error("Unexpected synthetic transport path");
  };
  const record = (row: ModuleRow<F>) => ({ row, ...(surface === "BO" ? { centerId: scenario === "record-scope" ? foreignId : centerId } : scenario === "record-scope" ? { centerId } : {}) });
  const provider: SurfaceProvider<F> = {
    pagination: "local-ui",
    list: async () => ({ records: rows.map(record), total: rows.length }),
    detail: async id => { const row = rows.find(row => row.id === id); return row ? record(row) : null; },
  };
  const options = { registry: new TddRegistry(), definition, provider, fetcher, origin: location.origin };
  const root = createRoot(document.getElementById("root")!);
  try {
    const adapter = scenario === "wrong-surface"
      ? surface === "BO" ? await createHoTddAdapter(options, new AbortController().signal) : await createBoTddAdapter({ ...options, centerId }, new AbortController().signal)
      : surface === "BO" ? await createBoTddAdapter({ ...options, centerId }, new AbortController().signal) : await createHoTddAdapter(options, new AbortController().signal);
    root.render(<SurfaceWorkspace adapter={adapter} navigation={browserTddNavigation(surface, generated.key, query)} initialQuery={query} />);
  } catch (error) {
    root.render(<p role="alert">Synthetic adapter denied: {typeof error === "object" && error !== null && "status" in error ? String(error.status) : error instanceof Error ? error.message : "error"}</p>);
  }
}
