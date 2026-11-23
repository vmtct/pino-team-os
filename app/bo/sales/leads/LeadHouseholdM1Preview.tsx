"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BoFullDetail } from "@/app/bo/components/BoFullDetail";
import { BoProperties } from "@/app/bo/components/BoProperties";
import { BoDataGrid, BoDataGridBadge, BoDataGridStatus, BoDrawer, type BoDataGridColumn } from "@/app/bo/components/data-grid";
import {
  LEAD_M1_AUDIT_COLUMNS,
  LEAD_M1_FIXTURE,
  LEAD_M1_INTEREST_LABELS,
  leadM1MemberSummary,
  leadM1RoleLabel,
  leadM1SearchText,
  type LeadM1Intent,
  type LeadM1IntentKind,
  type LeadM1Member,
  type LeadM1Record,
  type LeadM1Relationship,
  type LeadM1Role,
} from "./lead-household-m1-fixtures";
import styles from "./lead-household-m1.module.css";

type DrawerState = { mode: "create" } | { mode: "edit"; leadId: string };
type LeadDraft = {
  contactName: string;
  phone: string;
  members: LeadM1Member[];
  relationships: LeadM1Relationship[];
  interests: LeadM1IntentKind[];
};
type FieldMode = "VIEW" | "CREATE" | "EDIT";

const PROGRAM_OPTIONS: Array<{ kind: LeadM1IntentKind; program: "AFTERSCHOOL" | "MYTIME"; label: string }> = [
  { kind: "AFTERSCHOOL_ART", program: "AFTERSCHOOL", label: "Hội họa" },
  { kind: "AFTERSCHOOL_PIANO", program: "AFTERSCHOOL", label: "Piano" },
  { kind: "MYTIME_ACRYLIC", program: "MYTIME", label: "Hội họa" },
  { kind: "MYTIME_PIANO", program: "MYTIME", label: "Piano" },
];
const ROLE_OPTIONS: LeadM1Role[] = ["PARENT", "STUDENT", "GUEST"];
const CONTACT_FIELD_SCHEMA = [
  { key: "contactName", label: "Người liên hệ", required: true },
  { key: "phone", label: "Số điện thoại", required: true },
] as const;

function makeDraft(lead?: LeadM1Record): LeadDraft {
  return { contactName: lead?.contactName ?? "", phone: lead?.phone ?? "", members: lead ? lead.members.map(member => ({ ...member, roles: [...member.roles] })) : [], relationships: lead ? lead.relationships.map(item => ({ ...item })) : [], interests: lead ? lead.intents.map(intent => intent.kind) : [] };
}
function createFixtureFromDraft(draft: LeadDraft, id: string): LeadM1Record {
  const members = draft.members.map((member, index) => ({ ...member, id: id + "-MEM-" + String(index + 1).padStart(2, "0") }));
  const oldIds = new Map<string, string>(draft.members.map((member, index) => [member.id, members[index].id] as const));
  const relationships = draft.relationships.map((relation, index) => ({ ...relation, id: id + "-REL-" + String(index + 1).padStart(2, "0"), fromMemberId: oldIds.get(relation.fromMemberId) ?? relation.fromMemberId, toMemberId: oldIds.get(relation.toMemberId) ?? relation.toMemberId }));
  const relatedPeople = members.filter(member => member.roles.some(role => role !== "PARENT")).map(member => member.id);
  const intents: LeadM1Intent[] = draft.interests.map((kind, index) => ({ id: id + "-INT-" + String(index + 1).padStart(2, "0"), kind, source: kind.startsWith("AFTERSCHOOL") ? "PINO Afterschool" : kind.startsWith("MYTIME") ? "MyTime by PINO" : kind === "OPEN_STUDIO" ? "Open Studio" : "Nhập thủ công", memberIds: relatedPeople, status: "SUBMITTED", createdAt: null }));
  return { id, fixture: true, contactName: draft.contactName.trim(), phone: draft.phone.replace(/\D/g, ""), lifecycle: "ACTIVE", members, relationships, intents, createdAt: null, createdBy: null, updatedAt: null, updatedBy: null };
}

function PropertySection<T extends Record<string, unknown>>({
  title, schema, values, mode, onChange,
}: {
  title: string;
  schema: readonly { key: keyof T & string; label: string; required?: boolean }[];
  values: T;
  mode: FieldMode;
  onChange?: (key: keyof T & string, value: unknown) => void;
}) {
  return <section className={styles.propertySection} aria-label={title}>
    <h3>{title}</h3>
    <div className={styles.propertyRows} role="list">
      {schema.map(field => <div className="property-row" role="listitem" key={field.key}>
        <div className="property-label">{field.label}{field.required ? " *" : ""}</div>
        <div className="property-control">
          {mode === "VIEW" ? String(values[field.key] ?? "—") : (
            <input
              aria-label={field.label}
              value={String(values[field.key] ?? "")}
              required={Boolean(field.required)}
              disabled={!onChange}
              onChange={event => onChange?.(field.key, event.target.value)}
            />
          )}
        </div>
      </div>)}
    </div>
  </section>;
}

export function LeadHouseholdM1Preview() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [records, setRecords] = useState<LeadM1Record[]>([LEAD_M1_FIXTURE]);
  const [query, setQuery] = useState("");
  const [lifecycle, setLifecycle] = useState<"ALL" | "ACTIVE" | "ARCHIVED">("ALL");
  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  const [draft, setDraft] = useState<LeadDraft>(() => makeDraft());
  const [step, setStep] = useState<1 | 2>(1);
  const [formError, setFormError] = useState("");
  const [fixtureNotice, setFixtureNotice] = useState("");
  const [nextFixtureNumber, setNextFixtureNumber] = useState(2);
  const [convertLeadId, setConvertLeadId] = useState<string | null>(null);
  const [convertSelected, setConvertSelected] = useState<string[]>([]);
  const [convertMessage, setConvertMessage] = useState("");
  const [contactPersonMode, setContactPersonMode] = useState<"NEW" | "EXISTING">("NEW");
  const [contactPersonId, setContactPersonId] = useState("");
  const [contactCanonicalName, setContactCanonicalName] = useState("");
  const [contactActorRoles, setContactActorRoles] = useState<LeadM1Role[]>(["PARENT"]);
  const [memberPersonModes, setMemberPersonModes] = useState<Record<string, "NEW" | "EXISTING">>({});
  const [memberPersonIds, setMemberPersonIds] = useState<Record<string, string>>({});
  const [memberCanonicalNames, setMemberCanonicalNames] = useState<Record<string, string>>({});
  const [memberActorRoles, setMemberActorRoles] = useState<Record<string, LeadM1Role[]>>({});
  const [guardianConfirmedIds, setGuardianConfirmedIds] = useState<string[]>([]);

  const selectedLeadId = searchParams.get("lead");
  const activeTab = searchParams.get("tab") ?? "detail";
  const selectedLead = records.find(record => record.id === selectedLeadId) ?? null;
  const quickViewId = searchParams.get("quickView");
  const quickViewLead = records.find(record => record.id === quickViewId) ?? null;
  const convertLead = records.find(record => record.id === convertLeadId) ?? null;

  function openConvert(record: LeadM1Record) {
    setConvertLeadId(record.id);
    setConvertSelected(record.members.filter(member => member.roles.includes("STUDENT") || member.roles.includes("GUEST")).map(member => member.id));
    setConvertMessage("");
    setContactPersonMode("NEW");
    setContactPersonId("");
    setContactCanonicalName(record.contactName);
    setContactActorRoles(record.members.find(member => member.primaryContact)?.roles ?? ["PARENT"]);
    setMemberPersonModes({});
    setMemberPersonIds({});
    setMemberCanonicalNames(Object.fromEntries(record.members.map(member => [member.id, member.name])));
    setMemberActorRoles(Object.fromEntries(record.members.map(member => [member.id, [...member.roles]])));
    setGuardianConfirmedIds([]);
  }

  function previewConversion() {
    if (!convertLead) return;
    if (!contactCanonicalName.trim() || (contactPersonMode === "EXISTING" && !contactPersonId.trim()) || !contactActorRoles.length) {
      setConvertMessage("Liên hệ chính cần tên canonical, Person ID nếu liên kết, và ít nhất một Actor."); return;
    }
    const chosen = convertLead.members.filter(member => !member.primaryContact && convertSelected.includes(member.id));
    if (chosen.some(member => (memberActorRoles[member.id] ?? []).includes("PARENT"))) {
      setConvertMessage("Thành viên không phải liên hệ chính chỉ được chọn Student hoặc Guest."); return;
    }
    if (chosen.some(member => !memberCanonicalNames[member.id]?.trim()
      || (memberPersonModes[member.id] === "EXISTING" && !memberPersonIds[member.id]?.trim())
      || !memberActorRoles[member.id]?.length)) {
      setConvertMessage("Mỗi thành viên được chọn cần tên canonical, Person ID nếu liên kết, và ít nhất một Actor."); return;
    }
    const confirmed = convertLead.relationships.filter(relation => guardianConfirmedIds.includes(relation.id));
    if (confirmed.some(relation => !convertSelected.includes(relation.toMemberId)
      || !(convertLead.members.find(member => member.id === relation.fromMemberId)?.primaryContact
        ? contactActorRoles.includes("PARENT")
        : convertSelected.includes(relation.fromMemberId) && memberActorRoles[relation.fromMemberId]?.includes("PARENT")))) {
      setConvertMessage("Quan hệ Guardian cần người được giám hộ nằm trong danh sách chuyển đổi và người giám hộ có vai trò Parent."); return;
    }
    setConvertMessage("Mô phỏng hợp lệ: liên hệ chính + " + chosen.length + " thành viên; " + confirmed.length + " quan hệ Guardian được chọn xác nhận (chưa ghi Core).");
  }

  const filteredRecords = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("vi");
    return records.filter(record =>
      (lifecycle === "ALL" || record.lifecycle === lifecycle)
      && (!term || leadM1SearchText(record).includes(term))
    );
  }, [lifecycle, query, records]);

  const columns = useMemo<BoDataGridColumn<LeadM1Record>[]>(() => [
    { key: "contact", header: "Người liên hệ", minWidth: 210, sticky: true, sortable: true, render: record => <div className={styles.identityCell}><strong>{record.contactName}</strong><small>{record.id}</small><BoDataGridBadge>DỮ LIỆU MẪU</BoDataGridBadge></div> },
    { key: "phone", header: "Số điện thoại", minWidth: 140, render: record => <span className={styles.mono}>{record.phone}</span> },
    { key: "household", header: "Thành viên", minWidth: 170, render: record => <div className={styles.stackCell}><strong>{record.members.length} thành viên</strong><small>{leadM1MemberSummary(record)}</small></div> },
    { key: "interest", header: "Chương trình quan tâm", minWidth: 230, render: record => <div className={styles.badgeWrap}>{record.intents.map(intent => <BoDataGridBadge key={intent.id}>{LEAD_M1_INTEREST_LABELS[intent.kind]}</BoDataGridBadge>)}</div> },
    { key: "source", header: "Nguồn", minWidth: 150, render: record => <div className={styles.stackCell}>{Array.from(new Set(record.intents.map(intent => intent.source))).map(source => <small key={source}>{source}</small>)}</div> },
    { key: "lifecycle", header: "Trạng thái", minWidth: 120, render: record => <BoDataGridStatus value={record.lifecycle === "ACTIVE" ? "Đang hoạt động" : "Đã lưu trữ"} tone={record.lifecycle === "ACTIVE" ? "success" : "neutral"} /> },
    ...LEAD_M1_AUDIT_COLUMNS.map(field => ({ key: field.key, header: field.label, minWidth: field.type === "datetime" ? 150 : 130, render: (record: LeadM1Record) => record[field.key] ?? field.fallback })),
  ], []);

  function setPreviewParam(key: string, value: string | null, history: "push" | "replace" = "push") {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value); else params.delete(key);
    const next = params.toString();
    const href = next ? pathname + "?" + next : pathname;
    if (history === "push") router.push(href, { scroll: false });
    else router.replace(href, { scroll: false });
  }

  function openFullDetail(id: string) { const params = new URLSearchParams(searchParams.toString()); params.delete("quickView"); params.set("lead", id); router.push(pathname + "?" + params.toString(), { scroll: false }); }

  function openCreate() {
    setDraft(makeDraft());
    setStep(1);
    setFormError("");
    setDrawer({ mode: "create" });
  }

  function saveInlineContact(id: string, name: string, phone: string) {
    const normalizedPhone = phone.replace(/\D/g, "");
    if (!name.trim() || !/^0\d{9}$/.test(normalizedPhone) || records.some(record => record.id !== id && record.phone === normalizedPhone)) return false;
    setRecords(current => current.map(record => record.id === id ? { ...record, contactName: name.trim(), phone: normalizedPhone } : record));
    setFixtureNotice("Đã cập nhật liên hệ trong fixture. Không ghi Core.");
    return true;
  }

  function saveMemberInterests(leadId: string, memberId: string, kinds: LeadM1IntentKind[]) {
    setRecords(current => current.map(record => {
      if (record.id !== leadId) return record;
      const kept = record.intents.map(intent => ({ ...intent, memberIds: intent.memberIds.filter(id => id !== memberId) }));
      const intents = [...kept];
      for (const kind of kinds) {
        const existing = intents.find(intent => intent.kind === kind);
        if (existing) existing.memberIds = [...existing.memberIds, memberId];
        else intents.push({ id: leadId + "-INT-" + memberId + "-" + kind, kind, source: kind.startsWith("AFTERSCHOOL") ? "PINO Afterschool" : kind.startsWith("MYTIME") ? "MyTime by PINO" : kind === "OPEN_STUDIO" ? "Open Studio" : "Nhập thủ công", memberIds: [memberId], status: "SUBMITTED", createdAt: null });
      }
      return { ...record, intents: intents.filter(intent => intent.memberIds.length > 0) };
    }));
    setFixtureNotice("Đã cập nhật chương trình quan tâm theo thành viên trong fixture. Không ghi Core.");
  }

  function saveInlineMember(leadId: string, memberId: string, name: string, age: string, roles: LeadM1Role[]) {
    const normalizedAge = age.trim() ? Number(age) : null;
    const target = records.find(record => record.id === leadId)?.members.find(member => member.id === memberId);
    if (!target || !name.trim() || !roles.length || (!target.primaryContact && roles.includes("PARENT"))
      || (normalizedAge !== null && (!Number.isInteger(normalizedAge) || normalizedAge < 0 || normalizedAge > 120))) return false;
    setRecords(current => current.map(record => record.id === leadId ? { ...record, members: record.members.map(member => member.id === memberId ? { ...member, name: name.trim(), age: normalizedAge, roles } : member) } : record));
    setFixtureNotice("Đã cập nhật thành viên trong fixture. Không ghi Core.");
    return true;
  }

  function openEdit(record: LeadM1Record) {
    setDraft(makeDraft(record));
    setStep(1);
    setFormError("");
    setDrawer({ mode: "edit", leadId: record.id });
  }

  function saveDraft() {
    if (!draft.contactName.trim()) { setFormError("Tên người liên hệ là bắt buộc."); setStep(1); return; }
    if (draft.members.filter(member => member.primaryContact).length > 1) { setFormError("Chỉ một thành viên được chọn là người liên hệ chính."); setStep(2); return; }
    if (!/^0\d{9}$/.test(draft.phone.replace(/\D/g, ""))) { setFormError("Số điện thoại mẫu phải có 10 chữ số và bắt đầu bằng 0."); setStep(1); return; }
    const normalizedPhone = draft.phone.replace(/\D/g, "");
    if (records.some(record => record.phone === normalizedPhone && (drawer?.mode === "create" || record.id !== drawer?.leadId))) {
      setFormError("Số điện thoại đã có trong dữ liệu xem trước.");
      setStep(1);
      return;
    }
    if (draft.members.some(member => !member.name.trim() || member.roles.length === 0 || (member.age !== null && (member.age < 0 || member.age > 120)))) {
      setFormError("Mỗi thành viên cần có họ tên và ít nhất một vai trò; tuổi phải hợp lệ.");
      setStep(2);
      return;
    }
    const memberById = new Map(draft.members.map(member => [member.id, member]));
    if (draft.relationships.some(relation => {
      const parent = memberById.get(relation.fromMemberId);
      const child = memberById.get(relation.toMemberId);
      return !parent || !child || parent.id === child.id || !parent.roles.includes("PARENT")
        || !(child.roles.includes("STUDENT") || (child.roles.includes("GUEST") && child.age !== null && child.age < 18));
    })) {
      setFormError("Quan hệ không còn hợp lệ sau khi chỉnh sửa thành viên hoặc vai trò. Hãy cập nhật quan hệ trước khi lưu.");
      setStep(2);
      return;
    }
    const nextRecord = createFixtureFromDraft(draft, drawer?.mode === "edit" ? drawer.leadId : "LEAD-MOCK-" + String(nextFixtureNumber).padStart(3, "0"));
    setRecords(current => drawer?.mode === "edit" ? current.map(record => record.id === nextRecord.id ? nextRecord : record) : [nextRecord, ...current]);
    if (drawer?.mode === "create") setNextFixtureNumber(value => value + 1);
    setFixtureNotice("Đã cập nhật fixture trong bộ nhớ preview. Không có request hoặc ghi dữ liệu Core.");
    setDrawer(null);
    if (drawer?.mode === "create") setPreviewParam("lead", nextRecord.id);
  }

  const backToTable = pathname + "?m1Preview=1";
  const currentUrl = pathname + "?" + searchParams.toString();

  return <main className={styles.page}>
    <header className={styles.heading}>
      <div>
        <span>Sales · PLT-LEAD · M1 FE Shell</span>
        <h1>Leads</h1>
        <p>Danh bạ đầu mối theo số điện thoại; thành viên và nhu cầu được gom dưới cùng một Lead.</p>
      </div>
      <div className={styles.headingActions}>
        <BoDataGridBadge>PREVIEW · DỮ LIỆU GIẢ LẬP</BoDataGridBadge>
        <button type="button" onClick={openCreate}>＋ Tạo Lead mẫu</button>
      </div>
    </header>

    <aside className={styles.previewNotice} role="note">
      <strong>Chế độ Founder review · M1</strong>
      <span>Fixture local, chỉ tồn tại trong bộ nhớ trình duyệt. Không đọc/ghi Acquisition API, Person, Actor, Guardian hoặc Core. Refresh sẽ khôi phục fixture chuẩn.</span>
      <a href={pathname}>Quay về màn Acquisition Intent hiện tại</a>
    </aside>

    {fixtureNotice ? <p className={styles.previewNotice} role="status">{fixtureNotice}</p> : null}

    <BoDataGrid
      rows={filteredRecords}
      columns={columns}
      rowKey={record => record.id}
      caption="Lead household directory · M1 preview fixture"
      search={query}
      onSearchChange={setQuery}
      searchPlaceholder="Tìm tên, số điện thoại, thành viên, chương trình…"
      state="ready"
      resultLabel={filteredRecords.length + " / " + records.length + " Leads"}
      selectedRowKey={selectedLeadId ?? quickViewId}
      onRowOpen={record => setPreviewParam("quickView", record.id)}
      quickViewOpener
      toolbarActions={<label className={styles.filterControl}>Trạng thái<select value={lifecycle} onChange={event => setLifecycle(event.target.value as typeof lifecycle)}><option value="ALL">Tất cả</option><option value="ACTIVE">Đang hoạt động</option><option value="ARCHIVED">Đã lưu trữ</option></select></label>}
      emptyTitle="Không có Lead phù hợp"
      emptyMessage="Thay đổi từ khóa hoặc bộ lọc trạng thái."
    />

    {selectedLead ? <BoFullDetail
      title={selectedLead.contactName}
      description={selectedLead.id + " · Dữ liệu mẫu"}
      currentUrl={currentUrl}
      returnTo={backToTable}
      activeTab={activeTab}
      actions={<div className={styles.detailActions}><BoDataGridBadge>DỮ LIỆU MẪU</BoDataGridBadge><button type="button" onClick={() => openEdit(selectedLead)}>Chỉnh sửa</button></div>}
      tabs={[
        { id: "detail", label: "Tổng quan", content: <><LeadOverview record={selectedLead} onSave={(name, phone) => saveInlineContact(selectedLead.id, name, phone)} /><div className={styles.detailActions}><button type="button" className={styles.primaryButton} onClick={() => openConvert(selectedLead)}>Convert Lead · Xem trước</button></div></> },
        { id: "members", label: "Thành viên", content: <LeadMembers record={selectedLead} onSave={(memberId, name, age, roles) => saveInlineMember(selectedLead.id, memberId, name, age, roles)} onSaveInterests={(memberId, kinds) => saveMemberInterests(selectedLead.id, memberId, kinds)} /> },
        { id: "relationships", label: "Quan hệ", content: <LeadRelationships record={selectedLead} /> },
        { id: "history", label: "Lịch sử", content: <LeadHistory /> },
      ]}
    /> : null}

    {quickViewId && !drawer ? <BoDrawer
      title={quickViewLead?.contactName ?? "Lead"}
      eyebrow="Quick View · Lead household"
      mode="view"
      size="lg"
      onClose={() => setPreviewParam("quickView", null)}
      footer={quickViewLead ? <div className={styles.drawerFooter}><button type="button" onClick={() => { setPreviewParam("quickView", null); openEdit(quickViewLead); }}>Chỉnh sửa</button><button type="button" className={styles.primaryButton} onClick={() => openFullDetail(quickViewLead.id)}>Mở chi tiết đầy đủ →</button></div> : null}
    >{quickViewLead ? <LeadQuickView record={quickViewLead} /> : <p role="alert">Lead fixture không còn tồn tại trong bộ nhớ preview. Refresh để khôi phục fixture chuẩn.</p>}</BoDrawer> : null}

    {convertLead ? <BoDrawer
      title="Chuyển đổi Lead"
      eyebrow="M1 · Conversion preview · Không ghi Core"
      mode="view"
      size="lg"
      onClose={() => { setConvertLeadId(null); setConvertMessage(""); }}
      footer={<div className={styles.drawerFooter}>
        <button type="button" onClick={() => setConvertLeadId(null)}>Hủy</button>
        <button type="button" className={styles.primaryButton} onClick={previewConversion}>Xác nhận xem trước</button>
      </div>}
    >
      <div className={styles.drawerContent}>
        <div className={styles.fixtureStrip}>Đây là shell duyệt luồng chuyển đổi, không thực hiện conversion thật.</div>
        <BoProperties compact items={[{ key: "contact", label: "Liên hệ chính", value: convertLead.contactName }, { key: "phone", label: "Số điện thoại", value: convertLead.phone }, { key: "actors", label: "Actor khả dụng", value: "Parent · Student · Guest (mapping tại M2/M3)" }]} />
        <section className={styles.memberSection}>
          <h3>Person · Liên hệ chính</h3>
          <div className={styles.memberFields}>
            <label>Person<select value={contactPersonMode} onChange={event => setContactPersonMode(event.target.value as "NEW" | "EXISTING")}><option value="NEW">Tạo mới</option><option value="EXISTING">Liên kết hiện có</option></select></label>
            <label>Person ID<input placeholder="PERSON-..." value={contactPersonId} disabled={contactPersonMode !== "EXISTING"} onChange={event => setContactPersonId(event.target.value)} /></label>
            <label>Tên canonical<input value={contactCanonicalName} onChange={event => setContactCanonicalName(event.target.value)} /></label>
          </div>
          <div className={styles.roleOptions} aria-label="Actors liên hệ chính">{ROLE_OPTIONS.map(role => <label key={role}><input type="checkbox" checked={contactActorRoles.includes(role)} onChange={event => setContactActorRoles(current => event.target.checked ? [...current, role] : current.filter(item => item !== role))} />{leadM1RoleLabel(role)}</label>)}</div>
          <h3>Chọn thành viên để chuyển đổi</h3>
          {convertLead.members.filter(member => !member.primaryContact).map(member => <div className={styles.primaryContactOption} key={member.id}>
            <input type="checkbox" aria-label={"Chọn " + member.name} checked={convertSelected.includes(member.id)} onChange={event => setConvertSelected(current => event.target.checked ? [...current, member.id] : current.filter(id => id !== member.id))} />
            <span>{member.name} · {member.roles.map(leadM1RoleLabel).join(" / ")}</span>
            {convertSelected.includes(member.id) ? <span className={styles.memberFields}>
              <span>Person<select aria-label={"Person " + member.name} value={memberPersonModes[member.id] ?? "NEW"} onChange={event => setMemberPersonModes(current => ({ ...current, [member.id]: event.target.value as "NEW" | "EXISTING" }))}><option value="NEW">Tạo mới</option><option value="EXISTING">Liên kết hiện có</option></select></span>
              <span>Person ID<input aria-label={"Person ID " + member.name} placeholder="PERSON-..." disabled={memberPersonModes[member.id] !== "EXISTING"} value={memberPersonIds[member.id] ?? ""} onChange={event => setMemberPersonIds(current => ({ ...current, [member.id]: event.target.value }))} /></span>
              <span>Tên canonical<input aria-label={"Tên canonical " + member.name} value={memberCanonicalNames[member.id] ?? ""} onChange={event => setMemberCanonicalNames(current => ({ ...current, [member.id]: event.target.value }))} /></span>
              <span className={styles.roleOptions}>{ROLE_OPTIONS.filter(role => role !== "PARENT").map(role => <span key={role}><input type="checkbox" aria-label={leadM1RoleLabel(role) + " " + member.name} checked={(memberActorRoles[member.id] ?? []).includes(role)} onChange={event => setMemberActorRoles(current => ({ ...current, [member.id]: event.target.checked ? [...(current[member.id] ?? []), role] : (current[member.id] ?? []).filter(item => item !== role) }))} />{leadM1RoleLabel(role)}</span>)}</span>
            </span> : null}
          </div>)}
        </section>
        <section className={styles.relationshipSection}><h3>Quan hệ khai báo (chưa xác nhận)</h3>
          {convertLead.relationships.map(relation => <label className={styles.primaryContactOption} key={relation.id}>
            <input type="checkbox" checked={guardianConfirmedIds.includes(relation.id)} onChange={event => setGuardianConfirmedIds(current => event.target.checked ? [...current, relation.id] : current.filter(id => id !== relation.id))} />
            <span>{convertLead.members.find(member => member.id === relation.fromMemberId)?.name ?? "—"} → {convertLead.members.find(member => member.id === relation.toMemberId)?.name ?? "—"} · {relation.label} · {guardianConfirmedIds.includes(relation.id) ? "Đã chọn xác nhận trong preview" : "Chưa xác nhận"}</span>
          </label>)}
          <p>Không tự tạo Guardian từ quan hệ khai báo.</p>
        </section>
        {convertMessage ? <p role="status" className={styles.previewNotice}>{convertMessage}</p> : null}
      </div>
    </BoDrawer> : null}

    {drawer ? <LeadCreateEditDrawer
      mode={drawer.mode}
      draft={draft}
      step={step}
      error={formError}
      onClose={() => { setDrawer(null); setFormError(""); }}
      onStepChange={setStep}
      onDraftChange={setDraft}
      onSave={saveDraft}
    /> : null}
  </main>;
}

function LeadQuickView({ record }: { record: LeadM1Record }) {
  return <div className={styles.quickView}>
    <div className={styles.fixtureStrip}>DỮ LIỆU MẪU · PREVIEW ONLY</div>
    <PropertySection title="Thông tin liên hệ" schema={CONTACT_FIELD_SCHEMA} values={{ contactName: record.contactName, phone: record.phone }} mode="VIEW" />
    <BoProperties compact items={[
      { key: "status", label: "Trạng thái Lead", value: record.lifecycle === "ACTIVE" ? "Đang hoạt động" : "Đã lưu trữ" },
      { key: "members", label: "Household", value: leadM1MemberSummary(record) },
      { key: "person", label: "Person liên kết", value: "— · Chưa mô phỏng identity match" },
      { key: "actors", label: "Actors hiện hữu", value: "—" },
    ]} />
    <section><h3>Thành viên</h3><ul>{record.members.map(member => <li key={member.id}><strong>{member.name}</strong><span>{member.age === null ? "Tuổi —" : member.age + " tuổi"} · {member.roles.map(leadM1RoleLabel).join(" · ")}</span></li>)}</ul></section>
    <section><h3>Quan tâm</h3><div className={styles.badgeWrap}>{record.intents.map(intent => <BoDataGridBadge key={intent.id}>{LEAD_M1_INTEREST_LABELS[intent.kind]}</BoDataGridBadge>)}</div></section>
  </div>;
}

function LeadOverview({ record, onSave }: { record: LeadM1Record; onSave: (name: string, phone: string) => boolean }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(record.contactName);
  const [phone, setPhone] = useState(record.phone);
  const [error, setError] = useState("");
  return <div className={styles.detailContent}>
    <section className={styles.propertySection}><h3>Liên hệ chính · Chỉnh sửa trực tiếp</h3>
      {editing ? <div className={styles.memberFields}>
        <label>Họ tên<input value={name} onChange={event => setName(event.target.value)} /></label>
        <label>Số điện thoại<input value={phone} onChange={event => setPhone(event.target.value)} /></label>
        <button type="button" onClick={() => { if (onSave(name, phone)) { setEditing(false); setError(""); } else setError("Tên hoặc số điện thoại không hợp lệ / trùng Lead."); }}>Lưu</button>
        <button type="button" onClick={() => { setEditing(false); setError(""); setName(record.contactName); setPhone(record.phone); }}>Hủy</button>
      </div> : <button type="button" onClick={() => setEditing(true)}>Sửa liên hệ</button>}
      {error ? <p role="alert">{error}</p> : null}
    </section>
    <div className={styles.fixtureStrip}>Fixture local · không phải Core record</div>
    <BoProperties items={[
      { key: "contact", label: "Người liên hệ", value: record.contactName },
      { key: "phone", label: "Số điện thoại", value: record.phone },
      { key: "status", label: "Trạng thái Lead", value: <BoDataGridStatus value={record.lifecycle === "ACTIVE" ? "Đang hoạt động" : "Đã lưu trữ"} tone={record.lifecycle === "ACTIVE" ? "success" : "neutral"} /> },
      { key: "household", label: "Household", value: record.members.length + " thành viên" },
      { key: "person", label: "Person liên kết", value: "— · Chưa mô phỏng identity match" },
      { key: "actors", label: "Actors hiện hữu", value: "—" },
      { key: "createdAt", label: "Created Time", value: "—" },
      { key: "createdBy", label: "Created By", value: "—" },
      { key: "updatedAt", label: "Last Modified Time", value: "—" },
      { key: "updatedBy", label: "Last Modified By", value: "—" },
    ]} />
    <p className={styles.helperNote}>Số điện thoại là khóa nhận diện Lead trong acquisition. Phone match không tự tạo Person, Parent, Student, Guest hay quyền Guardian.</p>
  </div>;
}

function LeadMembers({ record, onSave, onSaveInterests }: { record: LeadM1Record; onSave: (memberId: string, name: string, age: string, roles: LeadM1Role[]) => boolean; onSaveInterests: (memberId: string, kinds: LeadM1IntentKind[]) => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [roles, setRoles] = useState<LeadM1Role[]>([]);
  const [interests, setInterests] = useState<LeadM1IntentKind[]>([]);
  const [error, setError] = useState("");
  const columns: BoDataGridColumn<LeadM1Member>[] = [
    { key: "name", header: "Thành viên", minWidth: 200, render: member => <div className={styles.stackCell}><strong>{member.name}</strong><small>{member.id}</small></div> },
    { key: "age", header: "Tuổi", minWidth: 90, render: member => member.age === null ? "—" : member.age + " tuổi" },
    { key: "gender", header: "Giới tính", minWidth: 100, render: member => member.gender },
    { key: "roles", header: "Vai trò", minWidth: 180, render: member => <div className={styles.badgeWrap}>{member.roles.map(role => <BoDataGridBadge key={role}>{leadM1RoleLabel(role)}</BoDataGridBadge>)}</div> },
    { key: "contact", header: "Liên hệ chính", minWidth: 120, render: member => member.primaryContact ? "Người liên hệ" : "—" },
    { key: "interests", header: "Chương trình quan tâm", minWidth: 220, render: member => <div className={styles.badgeWrap}>{record.intents.filter(intent => intent.memberIds.includes(member.id)).map(intent => <BoDataGridBadge key={intent.id}>{LEAD_M1_INTEREST_LABELS[intent.kind]}</BoDataGridBadge>)}</div> },
    { key: "edit", header: "Thao tác", minWidth: 95, render: member => <button type="button" onClick={() => { setEditingId(member.id); setName(member.name); setAge(member.age === null ? "" : String(member.age)); setRoles([...member.roles]); setInterests(record.intents.filter(intent => intent.memberIds.includes(member.id)).map(intent => intent.kind)); setError(""); }}>Sửa</button> },
  ];
  return <section className={styles.detailContent}><div className={styles.sectionHeading}><h2>Household members</h2><BoDataGridBadge>{record.members.length} thành viên</BoDataGridBadge></div>
    <BoDataGrid rows={record.members} columns={columns} rowKey={member => member.id} caption="Lead members" showToolbar={false} />
    {editingId ? <section className={styles.propertySection} aria-label="Chỉnh sửa thành viên trực tiếp">
      <h3>Chỉnh sửa · {record.members.find(member => member.id === editingId)?.name}</h3>
      <div className={styles.memberFields}>
        <label>Họ tên<input value={name} onChange={event => setName(event.target.value)} /></label>
        <label>Tuổi<input inputMode="numeric" value={age} onChange={event => setAge(event.target.value)} /></label>
        <fieldset className={styles.roleOptions}><legend>Actor</legend>{(record.members.find(member => member.id === editingId)?.primaryContact ? ROLE_OPTIONS : ROLE_OPTIONS.filter(role => role !== "PARENT")).map(role => <label key={role}><input type="checkbox" checked={roles.includes(role)} onChange={event => setRoles(current => event.target.checked ? [...current, role] : current.filter(item => item !== role))} />{leadM1RoleLabel(role)}</label>)}</fieldset>
        <fieldset className={styles.roleOptions}><legend>Chương trình quan tâm</legend>{PROGRAM_OPTIONS.map(option => <label key={option.kind}><input type="checkbox" checked={interests.includes(option.kind)} onChange={event => setInterests(current => event.target.checked ? [...current, option.kind] : current.filter(kind => kind !== option.kind))} />{LEAD_M1_INTEREST_LABELS[option.kind]}</label>)}</fieldset>
        <button type="button" onClick={() => { if (onSave(editingId, name, age, roles)) { onSaveInterests(editingId, interests); setEditingId(null); setError(""); } else setError("Họ tên, tuổi hoặc Actor không hợp lệ."); }}>Lưu</button>
        <button type="button" onClick={() => { setEditingId(null); setError(""); }}>Hủy</button>
      </div>
      {error ? <p role="alert">{error}</p> : null}
    </section> : null}
    <p className={styles.helperNote}>Các Member trong fixture chỉ là candidates thuộc Lead. M1 không tạo Student/Parent/Guest Actor thật.</p>
  </section>;
}

function LeadRelationships({ record }: { record: LeadM1Record }) {
  const byId = new Map(record.members.map(member => [member.id, member]));
  const columns: BoDataGridColumn<LeadM1Relationship>[] = [
    { key: "from", header: "Từ người", minWidth: 190, render: relation => byId.get(relation.fromMemberId)?.name ?? "—" },
    { key: "relation", header: "Quan hệ", minWidth: 140, render: relation => relation.label },
    { key: "to", header: "Đến người", minWidth: 190, render: relation => byId.get(relation.toMemberId)?.name ?? "—" },
    { key: "status", header: "Xác nhận", minWidth: 145, render: relation => <BoDataGridStatus value="Khai báo · chưa xác minh" tone="warning" /> },
  ];
  return <section className={styles.detailContent}><div className={styles.sectionHeading}><h2>Quan hệ trong household</h2><BoDataGridBadge>{record.relationships.length} quan hệ</BoDataGridBadge></div>
    <BoDataGrid rows={record.relationships} columns={columns} rowKey={relation => relation.id} caption="Declared household relationships" showToolbar={false} />
    <p className={styles.helperNote}>Quan hệ Parent → Student/Guest ở đây là khai báo để nhân viên nhận diện household. Không phải Guardian relationship đã xác thực và không cấp quyền.</p>
  </section>;
}

function LeadHistory() {
  return <section className={styles.detailContent}>
    <h2>Lịch sử thay đổi</h2>
    <div className={styles.emptyHistory}><strong>Chưa có Core audit history trong M1 preview</strong><p>Không dựng sự kiện, thời điểm hoặc người thao tác giả. Khi M2/M3 tích hợp projection được phép, tab này sẽ hiển thị history thật.</p></div>
  </section>;
}

function LeadCreateEditDrawer({
  mode, draft, step, error, onClose, onStepChange, onDraftChange, onSave,
}: {
  mode: "create" | "edit"; draft: LeadDraft; step: 1 | 2; error: string;
  onClose: () => void; onStepChange: (step: 1 | 2) => void; onDraftChange: (draft: LeadDraft) => void; onSave: () => void;
}) {
  const [relationshipFrom, setRelationshipFrom] = useState("");
  const [relationshipTo, setRelationshipTo] = useState("");
  const [relationshipLabel, setRelationshipLabel] = useState("Người giám hộ");
  const [localError, setLocalError] = useState("");
  const interestFields = PROGRAM_OPTIONS;

  function updateMember(index: number, patch: Partial<LeadM1Member>) {
    onDraftChange({ ...draft, members: draft.members.map((member, current) => current === index ? { ...member, ...patch } : member) });
  }
  function addMember() {
    onDraftChange({ ...draft, members: [...draft.members, { id: "DRAFT-MEM-" + String(draft.members.length + 1), name: "", age: null, gender: "—", roles: [], primaryContact: false }] });
  }
  function removeMember(index: number) {
    const removed = draft.members[index];
    const members = draft.members.filter((_, current) => current !== index);
    const relationships = draft.relationships.filter(item => item.fromMemberId !== removed.id && item.toMemberId !== removed.id);
    onDraftChange({ ...draft, members, relationships });
  }
  function addRelationship() {
    const from = draft.members.find(member => member.id === relationshipFrom);
    const to = draft.members.find(member => member.id === relationshipTo);
    if (!from || !to || from.id === to.id || !from.roles.includes("PARENT")) { setLocalError("Chọn một Parent và một Student/Guest nhỏ tuổi."); return; }
    if (!(to.roles.includes("STUDENT") || (to.roles.includes("GUEST") && to.age !== null && to.age < 18))) { setLocalError("Người được liên kết phải là Student hoặc Guest dưới 18 tuổi."); return; }
    if (draft.relationships.some(item => item.fromMemberId === from.id && item.toMemberId === to.id)) { setLocalError("Quan hệ này đã được khai báo."); return; }
    onDraftChange({ ...draft, relationships: [...draft.relationships, { id: "DRAFT-REL-" + String(draft.relationships.length + 1), fromMemberId: from.id, toMemberId: to.id, label: relationshipLabel, status: "DECLARED" }] });
    setRelationshipFrom(""); setRelationshipTo(""); setLocalError("");
  }

  return <BoDrawer
    title={mode === "create" ? "Tạo Lead mẫu" : "Chỉnh sửa Lead mẫu"}
    eyebrow="M1 FE Shell · Local fixture only"
    mode={mode}
    size="lg"
    onClose={onClose}
    footer={<div className={styles.drawerFooter}>
      {step === 2 ? <button type="button" onClick={() => { setLocalError(""); onStepChange(1); }}>← Quay lại</button> : <button type="button" onClick={onClose}>Hủy</button>}
      {step === 1 ? <button type="button" className={styles.primaryButton} onClick={() => { if (!draft.contactName.trim() || !draft.phone.trim()) { setLocalError("Nhập người liên hệ và số điện thoại trước khi tiếp tục."); return; } setLocalError(""); onStepChange(2); }}>Tiếp tục: Thành viên →</button> : <button type="button" className={styles.primaryButton} onClick={onSave}>Lưu fixture mẫu</button>}
    </div>}
  >
    <div className={styles.drawerContent}>
      <div className={styles.stepProgress}><span data-active={step === 1 || undefined}>1 · Thông tin liên hệ</span><i /><span data-active={step === 2 || undefined}>2 · Thành viên</span></div>
      <div className={styles.fixtureStrip}>Mọi thay đổi chỉ nằm trong state của preview. Không gửi API hoặc ghi Core.</div>
      {step === 1 ? <>
        <PropertySection title="Thông tin liên hệ" schema={CONTACT_FIELD_SCHEMA} values={{ contactName: draft.contactName, phone: draft.phone }} mode={mode === "create" ? "CREATE" : "EDIT"} onChange={(key, value) => onDraftChange({ ...draft, [key]: value as string })} />
        <section className={styles.interestSection}>
          <div className={styles.sectionHeading}><div><h3>Chương trình quan tâm</h3><p>Chọn riêng theo từng chương trình; có thể chọn cả hai.</p></div><BoDataGridBadge>Tùy chọn</BoDataGridBadge></div>
          <div className={styles.programGrid}>
            {(["AFTERSCHOOL", "MYTIME"] as const).map(program => <article className={styles.programCard} key={program}>
              <strong>{program === "AFTERSCHOOL" ? "PINO Afterschool" : "MyTime by PINO"}</strong>
              <div>{interestFields.filter(field => field.program === program).map(field => <label className={styles.interestOption} key={field.kind}>
                <input type="checkbox" checked={draft.interests.includes(field.kind)} onChange={event => onDraftChange({ ...draft, interests: event.target.checked ? [...draft.interests, field.kind] : draft.interests.filter(kind => kind !== field.kind) })} />
                <span>{field.label}</span>
              </label>)}</div>
            </article>)}
          </div>
        </section>
      </> : <>
        <section className={styles.memberSection}>
          <div className={styles.sectionHeading}><div><h3>Thành viên trong household</h3><p>Vai trò dự kiến, chưa phải Actor thật.</p></div><button type="button" onClick={addMember}>＋ Thêm thành viên</button></div>
          {!draft.members.length ? <p className={styles.emptyHint}>Chưa có thành viên. Có thể tạo Lead độc lập.</p> : null}
          {draft.members.map((member, index) => <article className={styles.memberDraft} key={member.id}>
            <div className={styles.memberDraftHeader}><strong>Thành viên {index + 1}</strong><button type="button" onClick={() => removeMember(index)}>Gỡ</button></div>
            <div className={styles.memberFields}>
              <label>Họ và tên<input value={member.name} onChange={event => updateMember(index, { name: event.target.value })} /></label>
              <label>Tuổi<input type="number" min={0} max={120} value={member.age ?? ""} onChange={event => updateMember(index, { age: event.target.value === "" ? null : Number(event.target.value) })} /></label>
              <label>Giới tính<select value={member.gender} onChange={event => updateMember(index, { gender: event.target.value as LeadM1Member["gender"] })}><option>—</option><option>Nữ</option><option>Nam</option><option>Khác</option></select></label>
            </div>
            <div className={styles.roleOptions} aria-label={"Vai trò của thành viên " + (index + 1)}>
              {ROLE_OPTIONS.map(role => <label key={role}><input type="checkbox" checked={member.roles.includes(role)} onChange={event => updateMember(index, { roles: event.target.checked ? [...member.roles, role] : member.roles.filter(item => item !== role) })} />{leadM1RoleLabel(role)}</label>)}
            </div>
            <label className={styles.primaryContactOption}><input type="checkbox" checked={member.primaryContact} onChange={event => updateMember(index, { primaryContact: event.target.checked })} />Người liên hệ chính</label>
          </article>)}
        </section>
        {draft.members.length ? <section className={styles.relationshipSection}>
          <div className={styles.sectionHeading}><div><h3>Quan hệ được khai báo</h3><p>Parent → Student hoặc Guest nhỏ tuổi; không xác thực quyền giám hộ.</p></div><BoDataGridBadge>{draft.relationships.length} quan hệ</BoDataGridBadge></div>
          <div className={styles.relationshipComposer}>
            <label>Parent<select value={relationshipFrom} onChange={event => setRelationshipFrom(event.target.value)}><option value="">Chọn Parent</option>{draft.members.filter(member => member.roles.includes("PARENT")).map(member => <option key={member.id} value={member.id}>{member.name || "Chưa nhập tên"}</option>)}</select></label>
            <label>Student / Guest nhỏ tuổi<select value={relationshipTo} onChange={event => setRelationshipTo(event.target.value)}><option value="">Chọn thành viên</option>{draft.members.filter(member => member.roles.includes("STUDENT") || (member.roles.includes("GUEST") && member.age !== null && member.age < 18)).map(member => <option key={member.id} value={member.id}>{member.name || "Chưa nhập tên"}</option>)}</select></label>
            <label>Quan hệ<select value={relationshipLabel} onChange={event => setRelationshipLabel(event.target.value)}><option>Mẹ</option><option>Cha</option><option>Người giám hộ</option><option>Khác</option></select></label>
            <button type="button" onClick={addRelationship}>＋ Thêm</button>
          </div>
          {draft.relationships.map(item => <div className={styles.relationshipLine} key={item.id}>
            <span>{draft.members.find(member => member.id === item.fromMemberId)?.name ?? "—"} → {draft.members.find(member => member.id === item.toMemberId)?.name ?? "—"} · {item.label}</span>
            <BoDataGridStatus value="Khai báo" tone="warning" />
            <button type="button" aria-label={"Gỡ quan hệ " + item.label} onClick={() => onDraftChange({ ...draft, relationships: draft.relationships.filter(relation => relation.id !== item.id) })}>Gỡ</button>
          </div>)}
        </section> : null}
      </>}
      {error || localError ? <p className={styles.formError} role="alert">{error || localError}</p> : null}
    </div>
  </BoDrawer>;
}