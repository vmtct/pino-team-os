import { createRoot } from "react-dom/client";
import { SurfaceWorkspace } from "../../app/components/workspace-adapters/SurfaceWorkspace";
import { parentDefinition, parentQuery } from "../../app/bo/parents/schema";
import { TddRegistry } from "../../lib/workspace-schema";
import { browserTddNavigation } from "../../lib/workspace-adapters/navigation";
import type { AuthenticatedSurfaceAdapter } from "../../lib/workspace-adapters";
import type { ParentFields } from "../../app/bo/parents/schema";

// Isolated synthetic controller fixture; no live auth, API, or browser profile.
const registry = new TddRegistry();
const row = { id: "019d2000-0002-7000-8000-000000000001", name: "Parent fixture", maskedContact: null, studentCount: 0, centers: "Fixture Center", updatedAt: "2026-10-30T00:00:00Z", attention: null };
const schema = registry.register({ ...parentDefinition, data: { id: "pap1184-fixture", list: async () => ({ rows: [row], total: 1 }), detail: async () => row } });
const adapter: AuthenticatedSurfaceAdapter<ParentFields> = {
  registry, schema, context: { surface: "BO", centerId: "0199f001-0000-7000-8000-000000000001", authorize: permission => permission === "identity.parent_directory.view" },
  scope: { surface: "BO", centerId: "0199f001-0000-7000-8000-000000000001" }, userId: "fixture-actor",
  capabilities: { read: true, edit: false, create: false, delete: false, reveal: false, audit: false },
  list: async () => { await new Promise(resolve => setTimeout(resolve, 250)); return { rows: [row], total: 1, versions: {} }; },
  detail: async () => ({ row }), views: async () => ({ unavailable: [] }),
  subject: id => ({ type: "parent_user", id }), history: async () => ({ status: "denied" }), dispose() {},
};
createRoot(document.getElementById("root")!).render(<SurfaceWorkspace adapter={adapter} navigation={browserTddNavigation("BO", "parents", parentQuery)} initialQuery={parentQuery} />);
