import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { TddDetail } from "../../app/components/workspace-renderer/Record";
import { StaffRoleAccess } from "../../app/ho/staff/StaffRoleAccess";
import { staffDefinition } from "../../app/ho/staff/schema";
import { TddRegistry } from "../../lib/workspace-schema";
const registry = new TddRegistry();
const schema = registry.register({ ...staffDefinition, data: { id: "pap1117-mock", list: async () => ({ rows: [], total: 0 }), detail: async () => null } });
const scenario = new URL(location.href).searchParams.get("scenario");
function Fixture() {
  const [id, setId] = useState("staff-a");
  const record = { id, name: "An - Reception", status: "Đang làm", role: "Reception" };
  return <><button onClick={() => setId("staff-b")}>Đổi hồ sơ thử nghiệm</button><TddDetail registry={registry} schema={schema} context={{ surface: "HO", authorize: () => true }} record={record} subject={{ type: "staff", id }} onBack={() => {}}
    renderOverviewProperties={properties => <StaffRoleAccess key={properties.record.id} staffId={properties.record.id} properties={properties} active={scenario !== "inactive"} principalId={scenario === "self" ? "user-a" : "actor"} />} /></>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
