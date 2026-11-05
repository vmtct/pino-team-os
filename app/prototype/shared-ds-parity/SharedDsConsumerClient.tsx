"use client";

import { useState } from "react";
import {
  TableFrame, DrawerFrame, DetailFrame, TosCard, TosButton, TosBottomNav,
} from "@pino/design-system/react";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/tos-tokens.css";
import "@pino/design-system/components.css";

const columns = [
  { key: "name", label: "Nhân sự" },
  { key: "role", label: "Role" },
] as const;
const rows = [
  { id: "fixture-1", name: "Nhân viên mẫu", role: "Staff" },
  { id: "fixture-2", name: "Quản lý mẫu", role: "Manager" },
];
const tabs = [
  { id: "overview", label: "Tổng quan" },
  { id: "schedule", label: "Lịch ca" },
  { id: "history", label: "Lịch sử" },
] as const;

export default function SharedDsConsumerClient() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tab, setTab] = useState("overview");
  const [tosTab, setTosTab] = useState("today");
  return <div data-pap1117-shared-ds-fixture style={{padding: 18, maxWidth: 1200, margin: "auto"}}>
    <p>Local-only PAP-1117 shared DS consumer probe — no real data or Core writes.</p>
    <section data-pino-ds="bo" aria-label="BO TDD">
      <h2>BO Table / Drawer / Detail — package v0.3.0-rc.1</h2>
      <TableFrame caption="Nhân sự giả lập" columns={columns} rows={rows} rowKey={row => row.id}
        onRowSelect={() => setDrawerOpen(true)} />
      <button type="button" onClick={() => setDrawerOpen(true)}>Mở Drawer</button>
      <DetailFrame title="Nhân viên mẫu" subtitle="Demo" tabs={tabs} selected={tab} onSelect={setTab}
        onBack={() => setTab("overview")}>
        <p>Tab {tab} — demo only.</p>
      </DetailFrame>
      {drawerOpen && <DrawerFrame title="Nhân viên mẫu" path="BO / Staff"
        onClose={() => setDrawerOpen(false)} footer={<button type="button" onClick={() => setDrawerOpen(false)}>Đóng</button>}>
        <p>Thông tin demo không có dữ liệu thật.</p>
      </DrawerFrame>}
    </section>
    <section data-pino-ds="tos" aria-label="TOS mobile" style={{maxWidth: 430, paddingTop: 22}}>
      <h2>TOS primitives — package v0.2.0</h2>
      <TosCard><strong>Ca Làm</strong><p>Phiên mẫu, không chấm công.</p>
        <TosButton type="button" variant="secondary" onClick={() => setTosTab("today")}>Hôm nay</TosButton>
      </TosCard>
      <TosBottomNav items={[{id:"today",label:"Hôm nay"},{id:"history",label:"Lịch sử"}]}
        active={tosTab} onChange={setTosTab} label="TOS demo tabs" />
    </section>
  </div>;
}
