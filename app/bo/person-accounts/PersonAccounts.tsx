"use client";

// PAP-2211 · Person-linked Piner User — BO synthetic M1 shell.
// Fixture state only. No Core/BFF reads, account mutations, or credential operations.
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import { useState, type FormEvent } from "react";
import { BoDataTable } from "@/app/bo/components/registration/BoDataTable";
import { BoQuickView } from "@/app/bo/components/registration/BoQuickView";
import { DetailFrame } from "@/app/components/workspace-renderer/DetailFrame";
import { DrawerFrame } from "@/app/components/workspace-renderer/DrawerFrame";
import { PropertySections, type CreateDrawerField } from "@/app/components/workspace-renderer/Properties";
import { useBoCenterSelection } from "@/app/bo/components/registration/BoCenterSelection";
import { defaultTable, type BoModule, type BoRecord, type BoTableState } from "@/lib/bo-registration";

type PersonCandidate = {
  id: string;
  name: string;
  ageLabel: string;
  phone: string;
  actors: string;
  profiles: string;
};

const fields = [
  { key: "person", label: "Person", type: "text", icon: "Aa", w: 220, readonly: true },
  { key: "phone", label: "Số điện thoại", type: "text", icon: "Aa", w: 160, readonly: true },
  { key: "actors", label: "Vai trò", type: "text", icon: "Aa", w: 180, readonly: true },
  { key: "profiles", label: "Hồ sơ được liên kết", type: "text", icon: "Aa", w: 240, readonly: true },
  { key: "access", label: "Quyền truy cập", type: "text", icon: "Aa", w: 180, readonly: true },
  { key: "createdAt", label: "Created Time", type: "datetime", icon: "◷", w: 165, readonly: true },
  { key: "createdBy", label: "Created By", type: "text", icon: "Aa", w: 155, readonly: true },
  { key: "updatedAt", label: "Last Modified Time", type: "datetime", icon: "◷", w: 165, readonly: true },
  { key: "updatedBy", label: "Last Modified By", type: "text", icon: "Aa", w: 155, readonly: true },
] as const;

const module: BoModule = { label: "Tài khoản Piner", group: "People", fields: [...fields] };
const rows: BoRecord[] = [
  { id: "demo-person-01", person: "Nguyễn An (DEMO)", phone: "0900•••821", actors: "Parent · Student", profiles: "An (Student) · 1 Guardian Student", access: "Đã kích hoạt", createdAt: "—", createdBy: "—", updatedAt: "—", updatedBy: "—" },
  { id: "demo-person-02", person: "Trần Bình (DEMO)", phone: "0900•••642", actors: "Student", profiles: "Bình (Student)", access: "Chưa kích hoạt", createdAt: "—", createdBy: "—", updatedAt: "—", updatedBy: "—" },
  { id: "demo-person-03", person: "Lê Chi (DEMO)", phone: "0900•••357", actors: "Guest", profiles: "Guest", access: "Chưa kích hoạt", createdAt: "—", createdBy: "—", updatedAt: "—", updatedBy: "—" },
];
const candidates: PersonCandidate[] = [
  { id: "demo-person-04", name: "Phạm Duy (DEMO)", ageLabel: "10t", phone: "0900•••114", actors: "Student · Guest · Staff", profiles: "Duy (Student) · Guest" },
  { id: "demo-person-05", name: "Hoàng Vy (DEMO)", ageLabel: "28t", phone: "0900•••298", actors: "Parent", profiles: "2 Guardian Students" },
];
const initialTable = (): BoTableState => ({ ...defaultTable([...fields]), pageSize: 15 });
const overview = [{ id: "person", label: "Thông tin tài khoản", fields: fields.map(field => field.key) }];

function personPickerLabel(person: PersonCandidate) {
  const mobileTail = person.phone.replace(/\D/g, "").slice(-4);
  return [person.name, person.ageLabel || "—", mobileTail ? "•••• " + mobileTail : "—"].join(" · ");
}

function accountRecord(person: PersonCandidate | null, access = "Chưa kích hoạt"): BoRecord {
  return {
    id: person?.id ?? "",
    person: person?.name ?? "",
    phone: person?.phone ?? "—",
    actors: person?.actors ?? "—",
    profiles: person?.profiles ?? "—",
    access,
    createdAt: "—",
    createdBy: "—",
    updatedAt: "—",
    updatedBy: "—",
  };
}

export function PersonAccounts() {
  const center = useBoCenterSelection();
  const [table, setTable] = useState<BoTableState>(initialTable);
  const [accounts, setAccounts] = useState<BoRecord[]>(rows);
  const [drawer, setDrawer] = useState<BoRecord | null>(null);
  const [detail, setDetail] = useState<BoRecord | null>(null);
  const [tab, setTab] = useState("overview");
  const [page, setPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [personId, setPersonId] = useState("");

  if (center?.error) return <p role="alert">{center.error}</p>;
  if (center?.loading) return <p role="status">Đang xác định cơ sở…</p>;
  if (!center?.selected) return <p role="status">Chọn cơ sở để xem tài khoản.</p>;

  const availablePeople = candidates.filter(person => !accounts.some(account => account.id === person.id));
  const selectedPerson = availablePeople.find(person => person.id === personId) ?? null;

  if (detail) return <DetailFrame title={String(detail.person)} onBack={() => { setDetail(null); setTab("overview"); }}
    tabs={[{ id: "overview", label: "Tổng quan" }, { id: "history", label: "Lịch sử" }]} selected={tab} onSelect={setTab}>
    {tab === "overview" ? <>
      <PropertySections variant="detail" fields={[...fields]} record={detail} sections={overview} />
      <section className="property-section" aria-label="Thông tin credential">
        <h3>Credential</h3>
        <p>Tạo tài khoản không tự cấp PIN. Cấp lại PIN theo luồng hiện có cho nhóm đủ điều kiện.</p>
      </section>
    </> : <p role="status">Chưa có dữ liệu lịch sử trong bản xem thử.</p>}
  </DetailFrame>;

  const createFields: Record<string, CreateDrawerField> = {
    person: {
      id: "person-account-person",
      label: "Person",
      value: personId,
      required: true,
      onChange: setPersonId,
      control: <select id="person-account-person" className="edit-input" value={personId} required
        disabled={availablePeople.length === 0} onChange={event => setPersonId(event.target.value)}>
        <option value="">Chọn Person có sẵn</option>
        {availablePeople.map(person => <option key={person.id} value={person.id}>{personPickerLabel(person)}</option>)}
      </select>,
    },
  };

  function closeCreate() {
    setCreateOpen(false);
    setPersonId("");
  }

  function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPerson) return;
    const newAccount = accountRecord(selectedPerson);
    setAccounts(current => current.some(account => account.id === newAccount.id)
      ? current : [...current, newAccount]);
    closeCreate();
  }

  return <section aria-label="Tài khoản Piner" data-pap-task="PAP-2211" data-preview="synthetic-only">
    <div className="page-heading"><div className="page-heading-left"><h1>Tài khoản Piner</h1></div>
      <div className="heading-actions"><button type="button" className="primary-btn" onClick={() => { setPersonId(""); setCreateOpen(true); }}>Tạo tài khoản</button></div>
    </div>
    <p className="settings-hint" role="note">BẢN XEM THỬ · DỮ LIỆU DEMO</p>
    <p>Chọn Person hiện hữu; kích hoạt quyền truy cập là thao tác riêng. Phạm vi xem đến từ liên kết Student và Guardian hiện hành.</p>
    <BoDataTable module={module} rows={accounts} loadState="ready" value={table}
      update={change => setTable(old => ({ ...old, ...change }))} page={page} setPage={setPage}
      onOpen={setDrawer} selected={drawer?.id} onSettings={() => {}}
      filterOpen={filterOpen} setFilterOpen={setFilterOpen} views={[]} changeViews={() => {}}
      activeView={null} applyView={() => {}} reset={() => setTable(initialTable())}
      undo={() => {}} canUndo={false} />
    {drawer && <BoQuickView module={module} record={drawer} onClose={() => setDrawer(null)}
      onDetail={() => { setDetail(drawer); setDrawer(null); setTab("overview"); }} />}
    {createOpen && <DrawerFrame title="Tạo tài khoản từ Person" path="People · Tài khoản Piner"
      onClose={closeCreate} footer={<>
        <button type="button" className="secondary-btn" onClick={closeCreate}>Hủy</button>
        <button type="submit" className="primary-btn" form="person-account-create-form"
          disabled={!selectedPerson}>Tạo tài khoản</button>
      </>}>
      <form id="person-account-create-form" onSubmit={createAccount}>
        <PropertySections variant="drawer" fields={[...fields]} sections={overview}
          record={accountRecord(selectedPerson)} createFields={createFields} />
        <p className="settings-hint">Tạo tài khoản từ Person đã có. Việc kích hoạt quyền truy cập và cấp credential là thao tác riêng.</p>
        {availablePeople.length === 0 && <p role="status">Không còn Person chưa có tài khoản trong dữ liệu xem thử.</p>}
      </form>
    </DrawerFrame>}
  </section>;
}
