"use client";

import { useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { LeadReadModel } from "./lead-household-read-model";
import { LeadCommandFence, memberInput, type LeadHouseholdApi, type LeadCommand } from "./lead-household-provider";
import type { LeadDetail, LeadMemberInput, LeadInterest, LeadRelationInput } from "@/lib/bo-lead-household-client";
import { leadReadRow, leadReadDetail, leadAuditTime, leadInquiryLabel } from "./lead-household-read-presentation";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TddHostMenu } from "@/app/components/workspace-adapters/SurfaceWorkspace";
import { applyBoFilterSettings, type BoFilterField, type BoFilterSettings } from "@/lib/bo-filter-settings-state";
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
    <div className={styles.drawerContent} role="list">
      {schema.map(field => <div className={styles.propertyRows} role="listitem" key={field.key}>
        <div className="pds-compact-muted">{field.label}{field.required ? " *" : ""}</div>
        <div className={styles.mono}>
          {mode === "VIEW" ? String(values[field.key] ?? "—") : (
            <input className="pds-compact-field"
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

export function LeadHouseholdM1Preview({localReview=false,readApi,commandApi}: {localReview?: boolean; readApi?: Pick<LeadHouseholdApi,"search"|"detail"|"history">;commandApi?:LeadHouseholdApi} = {}) {
  const menu = useContext(TddHostMenu);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [fixtureRecords, setRecords] = useState<LeadM1Record[]>([LEAD_M1_FIXTURE]);
  const [,refreshRead] = useReducer((v:number)=>v+1,0);
  const readModel = useMemo(()=>readApi?new LeadReadModel(readApi,refreshRead):null,[readApi]);
  const commandFence=useMemo(()=>commandApi&&commandApi===readApi&&!localReview?new LeadCommandFence(commandApi):null,[commandApi,readApi,localReview]);
  const [commandNotice,setCommandNotice]=useState("");
  const commandBusyRef=useRef(false);
  const [commandBusy,setCommandBusy]=useState(false);
  const records = readModel ? readModel.directory.items.map(leadReadRow) : fixtureRecords;
  useEffect(()=>()=>readModel?.dispose(),[readModel]);
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
  const quickViewId = searchParams.get("quickView");
  const detailId=selectedLeadId??quickViewId;
  const currentDetail=readModel?.selected.record;
  const selectedLead = readModel ? (currentDetail?.id===selectedLeadId ? leadReadDetail(currentDetail) : null) : records.find(record => record.id === selectedLeadId) ?? null;
  const quickViewLead = readModel ? (currentDetail?.id===quickViewId ? leadReadDetail(currentDetail) : null) : records.find(record => record.id === quickViewId) ?? null;
  useEffect(()=>{ if(!readModel)return; const timer=setTimeout(()=>void readModel.search({q:query.trim()||undefined,status:lifecycle==="ALL"?undefined:lifecycle,limit:50}),150); return ()=>clearTimeout(timer); },[readModel,query,lifecycle]);
  useEffect(()=>{if(readModel)void readModel.select(detailId);},[readModel,detailId]);
  const detailReady=readModel?.selected.phase==="ready"&&readModel.selected.id===selectedLeadId;
  useEffect(()=>{if(readModel&&detailReady&&activeTab==="history")void readModel.openHistory();},[readModel,detailReady,activeTab,selectedLeadId]);
  const convertLead = records.find(record => record.id === convertLeadId) ?? null;

  async function executeContact(operation:()=>Promise<LeadDetail|null>):Promise<boolean>{
    if(!commandFence||!readModel||commandBusyRef.current)return false;
    commandBusyRef.current=true;setCommandBusy(true);setCommandNotice("");
    try {
      const result=operation();refreshRead();
      const detail=await result;
      if(!detail){setCommandNotice("Không tìm thấy Lead trong phạm vi được phép xem. Kiểm tra lại thông tin trước khi gửi yêu cầu mới.");return false;}
      await Promise.all([readModel.refreshDirectory(),readModel.selected.id===detail.id?readModel.select(detail.id):Promise.resolve()]);
      const refreshFailed=readModel.directory.phase==="error"||(readModel.selected.id===detail.id&&readModel.selected.phase!=="ready");
      setCommandNotice(refreshFailed?"Đã xác nhận kết quả Lead; chưa tải lại được toàn bộ dữ liệu.":"Đã tải lại thông tin Lead.");
      if(drawer?.mode==="create"){setDrawer(null);openFullDetail(detail.id);}
      return true;
    }catch{
      setCommandNotice(commandFence.state==="uncertain"?"Chưa xác định kết quả. Chỉ thử lại cùng yêu cầu.":commandFence.state==="conflict"?"Dữ liệu đã thay đổi. Tải lại trước khi chỉnh sửa.":commandFence.state==="reload_required"?"Đã nhận kết quả, cần tải lại Lead.":"Không thể cập nhật Lead.");
      return false;
    }finally{commandBusyRef.current=false;setCommandBusy(false);refreshRead();}
  }
  function saveCanonicalContact(field:"name"|"phone",value:string):Promise<boolean>{
    const target=readModel?.selected.record;
    if(!commandFence||commandFence.state!=="idle"||!target||target.id!==selectedLeadId||target.status!=="ACTIVE")return Promise.resolve(false);
    const contact={phone:field==="phone"?value:target.phone,contactDisplayName:field==="name"?value.trim()||null:target.contactDisplayName};
    return executeContact(()=>commandFence.submit({kind:"contact",leadId:target.id,expectedVersion:target.version,contact}));
  }
  function submitMember(make:(target:LeadDetail)=>LeadCommand|null):Promise<boolean>{
    const target=readModel?.selected.record;
    if(!commandFence||commandFence.state!=="idle"||!target||target.id!==selectedLeadId||target.status!=="ACTIVE")return Promise.resolve(false);
    const command=make(target);
    return command?executeContact(()=>commandFence.submit(command)):Promise.resolve(false);
  }
  function updateCanonicalMember(memberId:string,patch:Partial<LeadMemberInput>){
    return submitMember(target=>{
      const member=target.members.find(m=>m.id===memberId);
      return member?{kind:"updateMember",leadId:target.id,expectedVersion:target.version,memberId,member:memberInput(member,patch)}:null;
    });
  }
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
    if(readModel)return records;
    const term = query.trim().toLocaleLowerCase("vi");
    return records.filter(record =>
      (lifecycle === "ALL" || record.lifecycle === lifecycle)
      && (!term || leadM1SearchText(record).includes(term))
    );
  }, [lifecycle, query, records, readModel]);

  const columns = useMemo<BoDataGridColumn<LeadM1Record>[]>(() => [
    { key: "contact", header: "Người liên hệ", minWidth: 210, sticky: true, sortable: !readModel, render: record => <div className={styles.identityCell}><strong>{record.contactName}</strong><small>{record.id}</small>{record.fixture?<BoDataGridBadge>DỮ LIỆU MẪU</BoDataGridBadge>:null}</div> },
    { key: "phone", header: "Số điện thoại", minWidth: 140, render: record => <span className={styles.mono}>{record.phone}</span> },
    { key: "household", header: "Thành viên", minWidth: 170, render: record => <div className={styles.stackCell}><strong>{record.memberCount??record.members.length} thành viên</strong><small>{record.fixture?leadM1MemberSummary(record):"—"}</small></div> },
    { key: "interest", header: "Chương trình quan tâm", minWidth: 230, render: record => <div className={styles.badgeWrap + " pds-choice-group"}>{record.fixture?record.intents.map(intent => <BoDataGridBadge key={intent.id}>{LEAD_M1_INTEREST_LABELS[intent.kind]}</BoDataGridBadge>):"—"}</div> },
    { key: "source", header: "Nguồn", minWidth: 150, render: record => <div className={styles.stackCell}>{record.fixture?Array.from(new Set(record.intents.map(intent => intent.source))).map(source => <small key={source}>{source}</small>):"—"}</div> },
    { key: "lifecycle", header: "Trạng thái", minWidth: 120, render: record => <BoDataGridStatus value={record.lifecycle === "ACTIVE" ? "Đang hoạt động" : "Đã lưu trữ"} tone={record.lifecycle === "ACTIVE" ? "success" : "neutral"} /> },
    ...LEAD_M1_AUDIT_COLUMNS.map(field => ({ key: field.key, header: field.label, minWidth: field.type === "datetime" ? 150 : 130, render: (record: LeadM1Record) => field.type==="datetime"?leadAuditTime(record[field.key]):record[field.key]??field.fallback })),
  ], [readModel]);

  const filterFields = useMemo<BoFilterField[]>(() => columns.map(column => ({key:column.key, type:"text", filterable:!readModel&&["phone","lifecycle"].includes(column.key)})), [columns,readModel]);
  const [tableSettings,setTableSettings] = useState<BoFilterSettings>(() => ({group:{combinator:"and",filters:[]},visibleKeys:columns.map(column=>column.key)}));
  const [sortDirection,setSortDirection] = useState<"asc"|"desc">("asc");
  const tableRows = useMemo(() => readModel?filteredRecords:[...applyBoFilterSettings(filteredRecords,tableSettings,filterFields)].sort((a,b) => a.contactName.localeCompare(b.contactName,"vi")*(sortDirection==="asc"?1:-1)),[filteredRecords,tableSettings,filterFields,sortDirection,readModel]);

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

  function updateMembers(leadId: string, members: LeadM1Member[]) {
    const target = records.find(record => record.id === leadId);
    if (!target || members.filter(member => member.primaryContact).length > 1 || members.some(member => !member.name.trim() || !member.roles.length || (!member.primaryContact && member.roles.includes("PARENT")) || (member.age !== null && (!Number.isInteger(member.age) || member.age < 0 || member.age > 120)))) return false;
    const ids = new Set(members.map(member => member.id));
    const relationships = target.relationships.filter(relation => ids.has(relation.fromMemberId) && ids.has(relation.toMemberId));
    if (relationships.some(relation => !validLeadRelationship(relation, members))) return false;
    setRecords(current => current.map(record => record.id === leadId ? { ...record, members, relationships, intents: record.intents.map(intent => ({ ...intent, memberIds: intent.memberIds.filter(id => ids.has(id)) })) } : record));
    return true;
  }
  function updateRelationships(leadId: string, relationships: LeadM1Relationship[]) {
    const target = records.find(record => record.id === leadId);
    if (!target || relationships.some(relation => !validLeadRelationship(relation, target.members)) || new Set(relationships.map(relation => relation.fromMemberId + ":" + relation.toMemberId)).size !== relationships.length) return false;
    setRecords(current => current.map(record => record.id === leadId ? { ...record, relationships } : record));
    return true;
  }
  function saveLeadInterests(leadId: string, kinds: LeadM1IntentKind[]) {
    setRecords(current => current.map(record => {
      if (record.id !== leadId) return record;
      const intents = record.intents.filter(intent => kinds.includes(intent.kind));
      for (const kind of kinds) if (!intents.some(intent => intent.kind === kind)) intents.push({ id: leadId + "-INT-" + kind, kind, source: kind.startsWith("AFTERSCHOOL") ? "PINO Afterschool" : kind.startsWith("MYTIME") ? "MyTime by PINO" : "Nhập thủ công", memberIds: [], status: "SUBMITTED", createdAt: null });
      return { ...record, intents };
    }));
  }

  function saveDraft() {
    if(readModel){
      if(!commandFence||commandFence.state!=="idle"||commandBusyRef.current||drawer?.mode!=="create")return;
      const phone=draft.phone.replace(/\D/g,"").replace(/^84/,"0");
      if(!/^0\d{9}$/.test(phone)||!draft.contactName.trim()){setFormError("Nhập tên và số điện thoại hợp lệ.");setStep(1);return;}
      const primaries=draft.members.filter(m=>m.primaryContact);
      const interests=draft.interests.filter(isMemberInterest);
      if(draft.members.length>20||primaries.length>1||draft.members.some(m=>!m.name.trim()||!m.roles.length||(!m.primaryContact&&m.roles.includes("PARENT"))||m.age!==null&&(!Number.isInteger(m.age)||m.age<0||m.age>120))){setFormError("Kiểm tra thông tin thành viên (tối đa 20) và liên hệ chính.");setStep(2);return;}
      if(draft.relationships.length||interests.length!==draft.interests.length||interests.length&&!draft.members.some(m=>m.roles.some(r=>r!=="PARENT"))){setFormError("Chương trình quan tâm cần Student/Guest; khai báo quan hệ sau khi tạo Lead.");setStep(2);return;}
      const members:LeadMemberInput[]=draft.members.map(m=>({displayName:m.name.trim(),intendedRoles:m.roles,gender:m.gender==="Nam"?"MALE":m.gender==="Nữ"?"FEMALE":m.gender==="Khác"?"OTHER":null,birthPrecision:"UNKNOWN",birthYear:null,birthMonth:null,birthDay:null,reportedAge:m.age,interestKinds:m.roles.some(r=>r!=="PARENT")?interests:[]}));
      const primaryMemberIndex=draft.members.findIndex(m=>m.primaryContact);
      setFormError("");void executeContact(()=>commandFence.submit({kind:"create",input:{contact:{phone,contactDisplayName:draft.contactName.trim()},members,primaryMemberIndex:primaryMemberIndex<0?null:primaryMemberIndex}}));return;
    }
    if (!draft.contactName.trim()) { setFormError("Tên người liên hệ là bắt buộc."); setStep(1); return; }
    if (draft.members.filter(member => member.primaryContact).length > 1) { setFormError("Chỉ một thành viên được chọn là người liên hệ chính."); setStep(2); return; }
    if (!/^0\d{9}$/.test(draft.phone.replace(/\D/g, ""))) { setFormError("Số điện thoại mẫu phải có 10 chữ số và bắt đầu bằng 0."); setStep(1); return; }
    const normalizedPhone = draft.phone.replace(/\D/g, "");
    if (records.some(record => record.phone === normalizedPhone && (drawer?.mode === "create" || record.id !== drawer?.leadId))) {
      setFormError("Số điện thoại đã có trong dữ liệu xem trước.");
      setStep(1);
      return;
    }
    if (draft.members.some(member => !member.name.trim() || member.roles.length === 0 || (!member.primaryContact && member.roles.includes("PARENT")) || (member.age !== null && (member.age < 0 || member.age > 120)))) {
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

  const backToTable = localReview ? pathname + "?m1Preview=1" : pathname;
  const currentUrl = pathname + (searchParams.size ? "?" + searchParams.toString() : "");

  return <main className={styles.page}>
    {commandFence&&commandNotice?<p role="status" className={styles.previewNotice}>{commandNotice}</p>:null}
    {commandFence?.state==="uncertain"?<button type="button" className="secondary-btn" onClick={()=>void executeContact(()=>commandFence.retry())}>Thử lại cùng yêu cầu</button>:null}
    {commandFence&&(commandFence.state==="reload_required"||commandFence.state==="conflict")&&commandFence.reloadTarget?<button type="button" className="secondary-btn" onClick={()=>{const id=commandFence.reloadTarget;if(id)void executeContact(()=>commandFence.reload(id));}}>Tải lại Lead</button>:null}
    {readModel&&selectedLeadId&&!selectedLead?<div role="status"><button className="secondary-btn" onClick={()=>setPreviewParam("lead",null)}>← Danh bạ Leads</button><LeadReadStatus phase={readModel.selected.phase} error={readModel.selected.error?.status} onRetry={()=>void readModel.select(selectedLeadId)} /></div>:null}
    {!selectedLead && !(readModel&&selectedLeadId) ? <><header className={styles.heading}>
      <div>
        <div className={styles.titleRow}>{menu("lead-menu-btn")}<h1>Leads</h1></div>
        <p>Danh bạ đầu mối theo số điện thoại; thành viên và nhu cầu được gom dưới cùng một Lead.</p>
      </div>
      <div className={styles.headingActions + " pds-compact-actions"}>
        {!readModel?<BoDataGridBadge>DỮ LIỆU MẪU</BoDataGridBadge>:null}
        <button className="primary-btn" type="button" disabled={Boolean(readModel)&&(!commandFence||commandBusy||commandFence.state!=="idle")} onClick={openCreate}>{readModel?"＋ Tạo Lead":"＋ Tạo Lead mẫu"}</button>
      </div>
    </header>


    {fixtureNotice ? <p className={styles.previewNotice} role="status">{fixtureNotice}</p> : null}

    <BoDataGrid
      rows={tableRows}
      columns={columns}
      rowsAlreadyFiltered
      typedFilterSettings={tableSettings}
      typedFilterFields={filterFields}
      onTypedFilterSettingsChange={setTableSettings}
      sortKey={readModel?null:"contact"}
      sortDirection={sortDirection}
      onSortChange={readModel?undefined:(_,direction)=>setSortDirection(direction)}
      rowKey={record => record.id}
      caption="Danh bạ Leads"
      search={query}
      onSearchChange={setQuery}
      searchPlaceholder="Tìm tên, số điện thoại, thành viên, chương trình…"
      state={readModel?(readModel.directory.phase==="idle"||readModel.directory.phase==="loading"?"loading":readModel.directory.phase==="error"?(readModel.directory.error?.status===403?"permission":"error"):"ready"):"ready"}
      onRefresh={readModel?()=>void readModel.search({q:query.trim()||undefined,status:lifecycle==="ALL"?undefined:lifecycle,limit:50}):undefined}
      resultLabel={readModel?tableRows.length+" Leads đã tải":tableRows.length + " / " + records.length + " Leads"}
      selectedRowKey={selectedLeadId ?? quickViewId}
      onRowOpen={record => setPreviewParam("quickView", record.id)}
      quickViewOpener
      toolbarActions={<label className={styles.filterControl}>Trạng thái<select className="pds-compact-field" value={lifecycle} onChange={event => setLifecycle(event.target.value as typeof lifecycle)}><option value="ALL">Tất cả</option><option value="ACTIVE">Đang hoạt động</option><option value="ARCHIVED">Đã lưu trữ</option></select></label>}
      emptyTitle="Không có Lead phù hợp"
      emptyMessage="Thay đổi từ khóa hoặc bộ lọc trạng thái."
    />
    {readModel?.directory.nextCursor?<button type="button" className="secondary-btn" disabled={readModel.directory.phase==="loading"} onClick={()=>void readModel.nextDirectory()}>Tải thêm</button>:null}

    </> : null}

    {selectedLead ? <BoFullDetail
      title={selectedLead.contactName}
      description={selectedLead.id + (selectedLead.fixture?" · Dữ liệu mẫu":"")}
      currentUrl={currentUrl}
      returnTo={backToTable}
      activeTab={activeTab}
      designVariant="business-v25"
      actions={<div className={styles.detailActions}>{menu("lead-detail-menu-btn")}{selectedLead.fixture?<BoDataGridBadge>DỮ LIỆU MẪU</BoDataGridBadge>:null}</div>}
      tabs={[
        { id: "detail", label: "Tổng quan", content: <LeadOverview record={selectedLead} liveContact={commandFence&&currentDetail&&currentDetail.id===selectedLead.id&&currentDetail.status==="ACTIVE"?{name:currentDetail.contactDisplayName,phone:currentDetail.phone,version:currentDetail.version,disabled:commandFence.state!=="idle",save:saveCanonicalContact}:undefined} onSave={(name, phone) => saveInlineContact(selectedLead.id, name, phone)} onConvert={() => openConvert(selectedLead)} onSaveInterests={kinds => saveLeadInterests(selectedLead.id, kinds)} /> },
        { id: "members", label: "Thành viên", content: <LeadMembers record={selectedLead} live={commandFence&&currentDetail?.id===selectedLead.id&&currentDetail.status==="ACTIVE"?{detail:currentDetail,disabled:commandFence.state!=="idle",update:updateCanonicalMember,add:(name,role)=>submitMember(target=>({kind:"addMember",leadId:target.id,expectedVersion:target.version,member:{displayName:name,intendedRoles:[role],gender:null,birthPrecision:"UNKNOWN",birthYear:null,birthMonth:null,birthDay:null,reportedAge:null,interestKinds:[]}})),primary:memberId=>submitMember(target=>({kind:"primary",leadId:target.id,expectedVersion:target.version,memberId})),retire:memberId=>submitMember(target=>({kind:"retireMember",leadId:target.id,expectedVersion:target.version,memberId}))}:undefined} onSave={members => updateMembers(selectedLead.id, members)} onSaveInterests={(memberId, kinds) => saveMemberInterests(selectedLead.id, memberId, kinds)} /> },
        { id: "relationships", label: "Quan hệ", content: <LeadRelationships record={selectedLead} live={commandFence&&currentDetail?.id===selectedLead.id&&currentDetail.status==="ACTIVE"?{disabled:commandFence.state!=="idle",add:relationship=>submitMember(target=>({kind:"addRelation",leadId:target.id,expectedVersion:target.version,relationship})),update:(relationshipId,relationship)=>submitMember(target=>target.relationships.some(r=>r.id===relationshipId&&r.status==="DECLARED")?{kind:"updateRelation",leadId:target.id,expectedVersion:target.version,relationshipId,relationship}:null),confirm:relationshipId=>submitMember(target=>target.relationships.some(r=>r.id===relationshipId&&r.status==="DECLARED")?{kind:"confirmRelation",leadId:target.id,expectedVersion:target.version,relationshipId}:null),retire:relationshipId=>submitMember(target=>target.relationships.some(r=>r.id===relationshipId)?{kind:"retireRelation",leadId:target.id,expectedVersion:target.version,relationshipId}:null)}:undefined} onSave={relationships => updateRelationships(selectedLead.id, relationships)} /> },
        { id: "history", label: "Lịch sử", content: readModel?<LeadInquiryHistory model={readModel}/>:<LeadHistory /> },
      ]}
    /> : null}

    {quickViewId && !drawer ? <BoDrawer
      title={quickViewLead?.contactName ?? "Lead"}
      eyebrow="Xem nhanh Lead"
      mode="view"
      size="lg"
      onClose={() => setPreviewParam("quickView", null)}
      footer={quickViewLead ? <div className={styles.drawerFooter + " pds-compact-actions"}><button type="button" className="primary-btn" onClick={() => openFullDetail(quickViewLead.id)}>Mở chi tiết đầy đủ →</button></div> : null}
    >{quickViewLead ? <LeadQuickView record={quickViewLead} /> : readModel?<LeadReadStatus phase={readModel.selected.phase} error={readModel.selected.error?.status} onRetry={()=>void readModel.select(quickViewId)}/>:<p role="alert">Lead fixture không còn tồn tại trong bộ nhớ preview. Refresh để khôi phục fixture chuẩn.</p>}</BoDrawer> : null}

    {convertLead ? <BoDrawer
      title="Chuyển đổi Lead"
      eyebrow="Xem trước"
      mode="view"
      size="lg"
      onClose={() => { setConvertLeadId(null); setConvertMessage(""); }}
      footer={<div className={styles.drawerFooter + " pds-compact-actions"}>
        <button className="secondary-btn" type="button" onClick={() => setConvertLeadId(null)}>Hủy</button>
        <button type="button" className="primary-btn" onClick={previewConversion}>Xác nhận xem trước</button>
      </div>}
    >
      <div className={styles.drawerContent}>
        <div className="pds-compact-muted">Chỉ xem trước, chưa tạo hồ sơ.</div>
        <BoProperties compact items={[{ key: "contact", label: "Liên hệ chính", value: convertLead.contactName }, { key: "phone", label: "Số điện thoại", value: convertLead.phone }, { key: "actors", label: "Actor khả dụng", value: "Parent · Student · Guest" }]} />
        <section className={styles.memberSection}>
          <h3>Person · Liên hệ chính</h3>
          <div className={styles.memberFields}>
            <label className="pds-compact-label">Person<select className="pds-compact-field" value={contactPersonMode} onChange={event => setContactPersonMode(event.target.value as "NEW" | "EXISTING")}><option value="NEW">Tạo mới</option><option value="EXISTING">Liên kết hiện có</option></select></label>
            <label className="pds-compact-label">Person ID<input className="pds-compact-field" placeholder="PERSON-..." value={contactPersonId} disabled={contactPersonMode !== "EXISTING"} onChange={event => setContactPersonId(event.target.value)} /></label>
            <label className="pds-compact-label">Tên canonical<input className="pds-compact-field" value={contactCanonicalName} onChange={event => setContactCanonicalName(event.target.value)} /></label>
          </div>
          <div className={styles.roleOptions + " pds-choice-group"} aria-label="Actors liên hệ chính">{ROLE_OPTIONS.map(role => <label key={role}><input type="checkbox" checked={contactActorRoles.includes(role)} onChange={event => setContactActorRoles(current => event.target.checked ? [...current, role] : current.filter(item => item !== role))} />{leadM1RoleLabel(role)}</label>)}</div>
          <h3>Chọn thành viên để chuyển đổi</h3>
          {convertLead.members.filter(member => !member.primaryContact).map(member => <div className={styles.convertMember + " pds-compact-card"} key={member.id}><div className={styles.convertMemberHeader}>
            <input type="checkbox" aria-label={"Chọn " + member.name} checked={convertSelected.includes(member.id)} onChange={event => setConvertSelected(current => event.target.checked ? [...current, member.id] : current.filter(id => id !== member.id))} />
            <span>{member.name} · {member.roles.map(leadM1RoleLabel).join(" / ")}</span></div>
            {convertSelected.includes(member.id) ? <><span className={styles.memberFields}>
              <span className="pds-compact-label">Person<select className="pds-compact-field" aria-label={"Person " + member.name} value={memberPersonModes[member.id] ?? "NEW"} onChange={event => setMemberPersonModes(current => ({ ...current, [member.id]: event.target.value as "NEW" | "EXISTING" }))}><option value="NEW">Tạo mới</option><option value="EXISTING">Liên kết hiện có</option></select></span>
              <span className="pds-compact-label">Person ID<input className="pds-compact-field" aria-label={"Person ID " + member.name} placeholder="PERSON-..." disabled={memberPersonModes[member.id] !== "EXISTING"} value={memberPersonIds[member.id] ?? ""} onChange={event => setMemberPersonIds(current => ({ ...current, [member.id]: event.target.value }))} /></span>
              <span className="pds-compact-label">Tên canonical<input className="pds-compact-field" aria-label={"Tên canonical " + member.name} value={memberCanonicalNames[member.id] ?? ""} onChange={event => setMemberCanonicalNames(current => ({ ...current, [member.id]: event.target.value }))} /></span></span>
              <span className={styles.roleOptions + " pds-choice-group"}>{ROLE_OPTIONS.filter(role => role !== "PARENT").map(role => <span key={role}><input type="checkbox" aria-label={leadM1RoleLabel(role) + " " + member.name} checked={(memberActorRoles[member.id] ?? []).includes(role)} onChange={event => setMemberActorRoles(current => ({ ...current, [member.id]: event.target.checked ? [...(current[member.id] ?? []), role] : (current[member.id] ?? []).filter(item => item !== role) }))} />{leadM1RoleLabel(role)}</span>)}</span>
            </> : null}
          </div>)}
        </section>
        <section className={styles.relationshipSection}><h3>Quan hệ khai báo (chưa xác nhận)</h3>
          {convertLead.relationships.map(relation => <label className={styles.primaryContactOption + " pds-choice"} key={relation.id}>
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
      live={Boolean(commandFence)}
      locked={Boolean(commandFence)&&(commandBusy||commandFence?.state!=="idle")}
      recovery={commandFence?<>{commandNotice?<p role="status">{commandNotice}</p>:null}{commandFence.state==="uncertain"?<button type="button" className="secondary-btn" disabled={commandBusy} onClick={()=>void executeContact(()=>commandFence.retry())}>Thử lại cùng yêu cầu</button>:null}{commandFence.isCreateConflict?<button type="button" className="secondary-btn" disabled={commandBusy} onClick={()=>void executeContact(()=>commandFence.reloadCreateConflict())}>Kiểm tra Lead đã có</button>:null}{commandFence.state==="reload_required"&&commandFence.reloadTarget?<button type="button" className="secondary-btn" disabled={commandBusy} onClick={()=>{const id=commandFence.reloadTarget;if(id)void executeContact(()=>commandFence.reload(id));}}>Tải lại Lead</button>:null}</>:undefined}
      onClose={() => { if(commandFence&&(commandBusyRef.current||commandFence.state!=="idle"))return;setDrawer(null); setFormError(""); }}
      onStepChange={setStep}
      onDraftChange={setDraft}
      onSave={saveDraft}
    /> : null}
  </main>;
}

function LeadQuickView({ record }: { record: LeadM1Record }) {
  return <div className={styles.quickView}>
    {record.fixture?<div className="pds-compact-muted">DỮ LIỆU MẪU</div>:null}
    <PropertySection title="Thông tin liên hệ" schema={CONTACT_FIELD_SCHEMA} values={{ contactName: record.contactName, phone: record.phone }} mode="VIEW" />
    <BoProperties compact items={[
      { key: "status", label: "Trạng thái Lead", value: record.lifecycle === "ACTIVE" ? "Đang hoạt động" : "Đã lưu trữ" },
      { key: "members", label: "Household", value: leadM1MemberSummary(record) },
      { key: "person", label: "Person liên kết", value: "—" },
      { key: "actors", label: "Actors hiện hữu", value: "—" },
    ]} />
    <section><h3>Thành viên</h3><ul className="pds-compact-list">{record.members.map(member => <li key={member.id}><strong>{member.name}</strong><span>{member.age === null ? "Tuổi —" : member.age + " tuổi"} · {member.roles.map(leadM1RoleLabel).join(" · ")}</span></li>)}</ul></section>
    <section><h3>Quan tâm</h3><div className={styles.badgeWrap + " pds-choice-group"}>{record.fixture?record.intents.map(intent => <BoDataGridBadge key={intent.id}>{LEAD_M1_INTEREST_LABELS[intent.kind]}</BoDataGridBadge>):record.interestKinds?.map(kind=><BoDataGridBadge key={kind}>{LEAD_M1_INTEREST_LABELS[kind]}</BoDataGridBadge>)}</div></section>
  </div>;
}

function LeadInlineText({ value, label, onCommit, inputMode }: { value: string; label: string; onCommit: (value: string) => boolean; inputMode?: "numeric" | "tel" }) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState(false);
  const canceled = useRef(false);
  return <span className={styles.inlineField}>
    <input className="pds-direct-field" data-pds-appearance="underline" aria-label={label} aria-invalid={error || undefined} value={draft} inputMode={inputMode}
      onChange={event => { setDraft(event.target.value); setError(false); }}
      onBlur={() => { if (canceled.current) { canceled.current = false; return; } if (draft === value) return; if (onCommit(draft)) setError(false); else setError(true); }}
      onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } if (event.key === "Escape") { event.preventDefault(); canceled.current = true; setDraft(value); setError(false); event.currentTarget.blur(); } }} />
    {error ? <small role="alert" className="pds-field-error">Giá trị không hợp lệ</small> : null}
  </span>;
}
type LiveContact={name:string|null;phone:string;version:number;disabled:boolean;save:(field:"name"|"phone",value:string)=>Promise<boolean>};
function LeadContactInline({value,label,disabled,onSave,inputMode}:{value:string;label:string;disabled:boolean;onSave:(value:string)=>Promise<boolean>;inputMode?:"tel"|"numeric"}){
  const [draft,setDraft]=useState(value);
  const [error,setError]=useState(false);
  const canceled=useRef(false),inFlight=useRef(false);
  async function commit(){
    if(canceled.current){canceled.current=false;return;}
    if(disabled||inFlight.current||draft===value)return;
    inFlight.current=true;
    try{const ok=await onSave(draft);if(!ok){setDraft(value);setError(true);}}finally{inFlight.current=false;}
  }
  return <span className={styles.inlineField}><input className="pds-direct-field" data-pds-appearance="underline" aria-label={label} value={draft} disabled={disabled} aria-invalid={error||undefined} inputMode={inputMode}
    onChange={e=>{setDraft(e.target.value);setError(false);}} onBlur={()=>void commit()}
    onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();e.currentTarget.blur();}if(e.key==="Escape"){e.preventDefault();canceled.current=true;setDraft(value);setError(false);e.currentTarget.blur();}}}/>
    {error?<small role="alert" className="pds-field-error">Chưa cập nhật</small>:null}</span>;
}
function LeadOverview({ record, onSave, onConvert, onSaveInterests,liveContact }: { record: LeadM1Record; onSave: (name: string, phone: string) => boolean; onConvert: () => void; onSaveInterests: (kinds: LeadM1IntentKind[]) => void;liveContact?:LiveContact }) {
  return <div className={styles.detailContent}>
    <BoProperties items={[
      { key: "contact", label: "Người liên hệ", value: liveContact?<LeadContactInline key={record.id+":"+liveContact.version+":name"} value={liveContact.name??""} label="Người liên hệ" disabled={liveContact.disabled} onSave={name=>liveContact.save("name",name)}/>:!record.fixture?record.contactName:<LeadInlineText key={record.id + record.contactName} label="Người liên hệ" value={record.contactName} onCommit={name => onSave(name, record.phone)} /> },
      { key: "phone", label: "Số điện thoại", value: liveContact?<LeadContactInline key={record.id+":"+liveContact.version+":phone"} value={liveContact.phone} label="Số điện thoại" inputMode="tel" disabled={liveContact.disabled} onSave={phone=>liveContact.save("phone",phone)}/>:!record.fixture?record.phone:<LeadInlineText key={record.id + record.phone} label="Số điện thoại" inputMode="tel" value={record.phone} onCommit={phone => onSave(record.contactName, phone)} /> },
      { key: "status", label: "Trạng thái Lead", value: <BoDataGridStatus value={record.lifecycle === "ACTIVE" ? "Đang hoạt động" : "Đã lưu trữ"} tone={record.lifecycle === "ACTIVE" ? "success" : "neutral"} /> },
      { key: "household", label: "Household", value: record.members.length + " thành viên" },
      { key: "person", label: "Person liên kết", value: "—" },
      { key: "actors", label: "Actors hiện hữu", value: "—" },
      { key: "createdAt", label: "Created Time", value: leadAuditTime(record.createdAt) },
      { key: "createdBy", label: "Created By", value: "—" },
      { key: "updatedAt", label: "Last Modified Time", value: leadAuditTime(record.updatedAt) },
      { key: "updatedBy", label: "Last Modified By", value: "—" },
    ]} />
    {record.fixture&&!record.members.length ? <div className="pds-choice-group" aria-label="Chương trình quan tâm">{PROGRAM_OPTIONS.map(option => <label key={option.kind}><input type="checkbox" checked={record.intents.some(intent => intent.kind === option.kind)} onChange={event => { const kinds=record.intents.map(intent => intent.kind); onSaveInterests(event.target.checked ? [...kinds, option.kind] : kinds.filter(kind => kind !== option.kind)); }} />{LEAD_M1_INTEREST_LABELS[option.kind]}</label>)}</div> : null}
    <p className="pds-compact-muted">Trùng số điện thoại không đồng nghĩa đã xác minh danh tính.</p>
    <div className={styles.detailActions}><button type="button" className="secondary-btn" disabled={!record.fixture} onClick={onConvert}>Convert Lead · Xem trước</button></div>
  </div>;
}
type LiveMembers={detail:LeadDetail;disabled:boolean;update:(id:string,patch:Partial<LeadMemberInput>)=>Promise<boolean>;add:(name:string,role:LeadM1Role)=>Promise<boolean>;primary:(id:string|null)=>Promise<boolean>;retire:(id:string)=>Promise<boolean>};
const isMemberInterest=(kind:LeadM1IntentKind):kind is LeadInterest=>kind==="AFTERSCHOOL_ART"||kind==="AFTERSCHOOL_PIANO"||kind==="MYTIME_ACRYLIC"||kind==="MYTIME_PIANO";
function LeadMembers({ record, onSave, onSaveInterests,live }: { record: LeadM1Record; onSave: (members: LeadM1Member[]) => boolean; onSaveInterests: (memberId: string, kinds: LeadM1IntentKind[]) => void;live?:LiveMembers }) {
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<LeadM1Role>("STUDENT");
  function commit(members: LeadM1Member[]) { const ok=onSave(members); setError(ok ? "" : "Thành viên hoặc quan hệ không hợp lệ. Kiểm tra vai trò và quan hệ khai báo."); return ok; }
  function patch(member: LeadM1Member, next: Partial<LeadM1Member>) { return commit(record.members.map(item => item.id === member.id ? { ...item, ...next } : item)); }
  const columns: BoDataGridColumn<LeadM1Member>[] = [
    { key: "name", header: "Thành viên", minWidth: 180, render: member => <div className={styles.stackCell}>{live?<LeadContactInline key={member.id+":"+live.detail.version+":name"} label={"Họ tên "+member.id} value={member.name} disabled={live.disabled} onSave={name=>name.trim()?live.update(member.id,{displayName:name.trim()}):Promise.resolve(false)}/>:!record.fixture?member.name:<LeadInlineText key={member.id+member.name} label={"Họ tên "+member.id} value={member.name} onCommit={name => patch(member, {name:name.trim()})} />}<small>{member.id}</small></div> },
    { key: "age", header: "Tuổi", minWidth: 75, render: member => live&&live.detail.members.find(m=>m.id===member.id)?.birthPrecision==="UNKNOWN"?<LeadContactInline key={member.id+":"+live.detail.version+":age"} label={"Tuổi "+member.id} value={member.age===null?"":String(member.age)} inputMode="numeric" disabled={live.disabled} onSave={value=>{const n=value.trim()?Number(value):null;return n!==null&&(!Number.isInteger(n)||n<0||n>120)?Promise.resolve(false):live.update(member.id,{reportedAge:n});}}/>:!record.fixture?(member.age??"—"):<LeadInlineText key={member.id+String(member.age)} label={"Tuổi "+member.id} value={member.age === null ? "" : String(member.age)} inputMode="numeric" onCommit={value => patch(member, {age:value.trim() ? Number(value) : null})} /> },
    { key: "gender", header: "Giới tính", minWidth: 95, render: member => live?<select className="pds-direct-field" data-pds-appearance="underline" aria-label={"Giới tính "+member.id} value={live.detail.members.find(m=>m.id===member.id)?.gender??""} disabled={live.disabled} onChange={event=>{const value=event.target.value;void live.update(member.id,{gender:value===""?null:value as LeadMemberInput["gender"]});}}><option value="">—</option><option value="FEMALE">Nữ</option><option value="MALE">Nam</option><option value="OTHER">Khác</option><option value="UNSPECIFIED">Không xác định</option></select>:!record.fixture?member.gender:<select className="pds-direct-field" data-pds-appearance="underline" aria-label={"Giới tính "+member.id} value={member.gender} onChange={event => patch(member, {gender:event.target.value as LeadM1Member["gender"]})}><option>—</option><option>Nữ</option><option>Nam</option><option>Khác</option></select> },
    { key: "roles", header: "Vai trò", minWidth: 170, render: member => live?<div className="pds-choice-group" aria-label={"Vai trò "+member.id}>{ROLE_OPTIONS.filter(role=>role!=="PARENT"||member.primaryContact||member.roles.includes(role)).map(role=><label key={role}><input type="checkbox" disabled={live.disabled} checked={member.roles.includes(role)} onChange={event=>{const next=event.target.checked?[...member.roles,role]:member.roles.filter(item=>item!==role);if(next.length)void live.update(member.id,{intendedRoles:next});}}/>{leadM1RoleLabel(role)}</label>)}</div>:!record.fixture?member.roles.map(leadM1RoleLabel).join(" · "):<div className="pds-choice-group" aria-label={"Vai trò "+member.id}>{(member.primaryContact ? ROLE_OPTIONS : ROLE_OPTIONS.filter(role => role !== "PARENT")).map(role => <label key={role}><input type="checkbox" checked={member.roles.includes(role)} onChange={event => patch(member, {roles:event.target.checked ? [...member.roles,role] : member.roles.filter(item => item !== role)})} />{leadM1RoleLabel(role)}</label>)}</div> },
    { key: "contact", header: "Liên hệ chính", minWidth: 110, render: member => <input type="checkbox" disabled={live?live.disabled:!record.fixture} aria-label={"Liên hệ chính "+member.id} checked={member.primaryContact} onChange={event => {if(live){void live.primary(event.target.checked?member.id:null);return;}patch(member, {primaryContact:event.target.checked,roles:event.target.checked ? member.roles : member.roles.filter(role=>role!=="PARENT")});}} /> },
    { key: "interests", header: "Chương trình quan tâm", minWidth: 240, render: member => <div className="pds-choice-group">{PROGRAM_OPTIONS.map(option => <label key={option.kind}><input type="checkbox" disabled={live?live.disabled||!isMemberInterest(option.kind):!record.fixture} checked={record.fixture?record.intents.some(intent=>intent.kind===option.kind&&intent.memberIds.includes(member.id)):member.interestKinds?.includes(option.kind)??false} onChange={event=>{if(live){if(!isMemberInterest(option.kind))return;const kinds=live.detail.members.find(m=>m.id===member.id)?.interestKinds??[];void live.update(member.id,{interestKinds:event.target.checked?[...new Set([...kinds,option.kind])]:kinds.filter(kind=>kind!==option.kind)});return;}const kinds=record.intents.filter(intent=>intent.memberIds.includes(member.id)).map(intent=>intent.kind);onSaveInterests(member.id,event.target.checked?[...kinds,option.kind]:kinds.filter(kind=>kind!==option.kind));}} />{LEAD_M1_INTEREST_LABELS[option.kind]}</label>)}</div> },
    { key: "remove", header: "", minWidth: 60, render: member => <button type="button" className="pds-text-action" disabled={live?live.disabled||member.primaryContact||record.relationships.some(r=>r.fromMemberId===member.id||r.toMemberId===member.id):!record.fixture} aria-label={"Gỡ "+member.name} onClick={()=>{if(live){void live.retire(member.id);return;}commit(record.members.filter(item=>item.id!==member.id));}}>Gỡ</button> },
  ];
  return <section className={styles.detailContent}><div className={styles.sectionHeading + " pds-compact-heading"}><h2>Thành viên</h2><BoDataGridBadge>{record.members.length} thành viên</BoDataGridBadge></div>
    <BoDataGrid rows={record.members} columns={columns} rowKey={member => member.id} caption="Lead members" showToolbar={false} />
    <form className="pds-compact-form" onSubmit={event=>{event.preventDefault();if(!newName.trim())return;if(live){if(!live.disabled)void live.add(newName.trim(),newRole).then(ok=>{if(ok)setNewName("");});return;}if(!record.fixture)return;const id=record.id+"-MEM-"+Date.now();if(commit([...record.members,{id,name:newName.trim(),age:null,gender:"—",roles:[newRole],primaryContact:false}]))setNewName("");}}>
      <input className="pds-direct-field" data-pds-appearance="underline" disabled={live?live.disabled:!record.fixture} aria-label="Tên thành viên mới" placeholder="Tên thành viên mới" value={newName} onChange={event=>setNewName(event.target.value)} required />
      <select className="pds-direct-field" data-pds-appearance="underline" disabled={live?live.disabled:!record.fixture} aria-label="Vai trò thành viên mới" value={newRole} onChange={event=>setNewRole(event.target.value as LeadM1Role)}><option value="STUDENT">Student</option><option value="GUEST">Guest</option></select>
      <button type="submit" disabled={live?live.disabled:!record.fixture} className="pds-text-action">＋ Thêm thành viên</button>
    </form>
    {error ? <p role="alert" className="pds-field-error">{error}</p> : null}
    <p className="pds-compact-muted">Vai trò dự kiến, chưa tạo hồ sơ.</p>
  </section>;
}
function validLeadRelationship(relation: LeadM1Relationship, members: LeadM1Member[]) {
  const from=members.find(member=>member.id===relation.fromMemberId),to=members.find(member=>member.id===relation.toMemberId);
  return Boolean(from && to && from.id!==to.id && from.roles.includes("PARENT") && (to.roles.includes("STUDENT") || (to.roles.includes("GUEST") && to.age!==null && to.age<18)));
}
type LiveRelationships={disabled:boolean;add:(relationship:LeadRelationInput)=>Promise<boolean>;update:(id:string,relationship:LeadRelationInput)=>Promise<boolean>;confirm:(id:string)=>Promise<boolean>;retire:(id:string)=>Promise<boolean>};
function LeadRelationships({ record, onSave,live }: { record: LeadM1Record; onSave: (relationships: LeadM1Relationship[])=>boolean;live?:LiveRelationships }) {
  const [from,setFrom]=useState(""),[to,setTo]=useState(""),[label,setLabel]=useState("Người giám hộ"),[error,setError]=useState("");
  const parents=record.members.filter(member=>member.roles.includes("PARENT")),children=record.members.filter(member=>member.roles.includes("STUDENT")||(member.roles.includes("GUEST")&&member.age!==null&&member.age<18));
  const labels=["Mẹ","Cha","Người giám hộ","Khác"];
  function commit(items: LeadM1Relationship[]) { const ok=onSave(items);setError(ok?"":"Quan hệ không hợp lệ hoặc đã tồn tại.");return ok; }
  function patch(relation:LeadM1Relationship,next:Partial<LeadM1Relationship>){
    const updated={...relation,...next};
    if(live){if(!live.disabled&&relation.status==="DECLARED"&&validLeadRelationship(updated,record.members))void live.update(relation.id,{fromMemberId:updated.fromMemberId,toMemberId:updated.toMemberId,relationLabel:updated.label});return;}
    commit(record.relationships.map(item=>item.id===relation.id?updated:item));
  }
  const columns: BoDataGridColumn<LeadM1Relationship>[] = [
    { key:"from",header:"Từ người",minWidth:180,render:relation=><select className="pds-direct-field" data-pds-appearance="underline" disabled={live?live.disabled||relation.status!=="DECLARED":!record.fixture} aria-label={"Từ người "+relation.id} value={relation.fromMemberId} onChange={event=>patch(relation,{fromMemberId:event.target.value})}>{parents.map(member=><option key={member.id} value={member.id}>{member.name}</option>)}</select> },
    { key:"relation",header:"Quan hệ",minWidth:140,render:relation=><select className="pds-direct-field" data-pds-appearance="underline" disabled={live?live.disabled||relation.status!=="DECLARED":!record.fixture} aria-label={"Quan hệ "+relation.id} value={relation.label} onChange={event=>patch(relation,{label:event.target.value})}>{labels.map(value=><option key={value}>{value}</option>)}</select> },
    { key:"to",header:"Đến người",minWidth:180,render:relation=><select className="pds-direct-field" data-pds-appearance="underline" disabled={live?live.disabled||relation.status!=="DECLARED":!record.fixture} aria-label={"Đến người "+relation.id} value={relation.toMemberId} onChange={event=>patch(relation,{toMemberId:event.target.value})}>{children.map(member=><option key={member.id} value={member.id}>{member.name}</option>)}</select> },
    { key:"status",header:"Xác nhận",minWidth:145,render:relation=> <div className={styles.stackCell}><BoDataGridStatus value={relation.status==="CONFIRMED"?"Đã xác nhận khai báo":"Khai báo · chưa xác minh"} tone={relation.status==="CONFIRMED"?"success":"warning"} />{live&&relation.status==="DECLARED"?<button type="button" className="pds-text-action" disabled={live.disabled} aria-label={"Xác nhận khai báo "+relation.id} onClick={()=>void live.confirm(relation.id)}>Xác nhận khai báo</button>:null}</div> },
    { key:"remove",header:"",minWidth:60,render:relation=><button type="button" className="pds-text-action" disabled={live?live.disabled:!record.fixture} aria-label={"Gỡ quan hệ "+relation.id} onClick={()=>{if(live){void live.retire(relation.id);return;}commit(record.relationships.filter(item=>item.id!==relation.id));}}>Gỡ</button> },
  ];
  return <section className={styles.detailContent}><div className={styles.sectionHeading + " pds-compact-heading"}><h2>Quan hệ trong household</h2><BoDataGridBadge>{record.relationships.length} quan hệ</BoDataGridBadge></div>
    <BoDataGrid rows={record.relationships} columns={columns} rowKey={relation=>relation.id} caption="Declared household relationships" showToolbar={false} />
    <form className="pds-compact-form" onSubmit={event=>{event.preventDefault();if(live){if(!live.disabled&&from&&to&&from!==to)void live.add({fromMemberId:from,toMemberId:to,relationLabel:label}).then(ok=>{if(ok){setFrom("");setTo("");}});return;}if(!record.fixture)return;if(commit([...record.relationships,{id:record.id+"-REL-"+Date.now(),fromMemberId:from,toMemberId:to,label,status:"DECLARED"}])){setFrom("");setTo("");}}}>
      <select className="pds-direct-field" data-pds-appearance="underline" disabled={live?live.disabled:!record.fixture} aria-label="Parent mới" value={from} onChange={event=>setFrom(event.target.value)} required><option value="">Chọn Parent</option>{parents.map(member=><option key={member.id} value={member.id}>{member.name}</option>)}</select>
      <select className="pds-direct-field" data-pds-appearance="underline" disabled={live?live.disabled:!record.fixture} aria-label="Thành viên liên kết mới" value={to} onChange={event=>setTo(event.target.value)} required><option value="">Chọn thành viên</option>{children.map(member=><option key={member.id} value={member.id}>{member.name}</option>)}</select>
      <select className="pds-direct-field" data-pds-appearance="underline" disabled={live?live.disabled:!record.fixture} aria-label="Quan hệ mới" value={label} onChange={event=>setLabel(event.target.value)}>{labels.map(value=><option key={value}>{value}</option>)}</select>
      <button type="submit" disabled={live?live.disabled||!from||!to||from===to:!record.fixture} className="pds-text-action">＋ Thêm quan hệ</button>
    </form>
    {error?<p role="alert" className="pds-field-error">{error}</p>:null}
    <p className="pds-compact-muted">Quan hệ khai báo chưa xác minh, không cấp quyền giám hộ.</p>
  </section>;
}

function LeadReadStatus({phase,error,onRetry}:{phase:string;error?:number|null;onRetry:()=>void}) {
 return phase==="error"?<div role="alert"><p>{error===403?"Không có quyền xem Lead":error===404?"Không tìm thấy Lead":error===401?"Phiên đăng nhập không khả dụng":"Không thể tải Lead"}</p><button className="secondary-btn" onClick={onRetry}>Thử lại</button></div>:<p role="status">Đang tải…</p>;
}
function LeadInquiryHistory({model}:{model:LeadReadModel}) {
 const history=model.history;
 return <section className={styles.detailContent}><h2>Lịch sử tiếp nhận</h2>
 {history.phase==="error"||history.phase==="loading"||history.phase==="idle"?<LeadReadStatus phase={history.phase} error={history.error?.status} onRetry={()=>void model.openHistory()}/>:history.items.length?<ul className="pds-compact-list">{history.items.map(intent=><li key={intent.id}><strong>{leadInquiryLabel(intent)}</strong><span>{intent.sourceSurface} · {intent.status} · {leadAuditTime(intent.createdAt)}</span></li>)}</ul>:<p>Chưa có lượt tiếp nhận.</p>}
 {history.nextCursor?<button className="secondary-btn" disabled={history.phase==="loading"} onClick={()=>void model.nextHistory()}>Tải thêm</button>:null}
 </section>;
}
function LeadHistory() {
  return <section className={styles.detailContent}>
    <h2>Lịch sử thay đổi</h2>
    <div className={styles.emptyHistory}><strong>Chưa có lịch sử thay đổi</strong></div>
  </section>;
}

function LeadCreateEditDrawer({
  mode, draft, step, error, onClose, onStepChange, onDraftChange, onSave,live=false,locked=false,recovery,
}: {
  mode: "create" | "edit"; draft: LeadDraft; step: 1 | 2; error: string; live?:boolean;locked?:boolean;recovery?:React.ReactNode;
  onClose: () => void; onStepChange: (step: 1 | 2) => void; onDraftChange: (draft: LeadDraft) => void; onSave: () => void;
}) {
  const [relationshipFrom, setRelationshipFrom] = useState("");
  const [relationshipTo, setRelationshipTo] = useState("");
  const [relationshipLabel, setRelationshipLabel] = useState("Người giám hộ");
  const [localError, setLocalError] = useState("");
  const interestFields = PROGRAM_OPTIONS;

  function updateMember(index: number, patch: Partial<LeadM1Member>) {
    const members = draft.members.map((member, current) => {
      const next = current === index ? { ...member, ...patch } : member;
      return next.primaryContact ? next : { ...next, roles: next.roles.filter(role => role !== "PARENT") };
    });
    onDraftChange({ ...draft, members });
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
    title={live?"Tạo Lead":mode === "create" ? "Tạo Lead mẫu" : "Chỉnh sửa Lead mẫu"}
    eyebrow={live?"Lead":"Dữ liệu mẫu"}
    mode={mode}
    size="lg"
    onClose={onClose}
    footer={<div className={styles.drawerFooter + " pds-compact-actions"}>
      {step === 2 ? <button className="secondary-btn" type="button" disabled={locked} onClick={() => { setLocalError(""); onStepChange(1); }}>← Quay lại</button> : <button className="secondary-btn" type="button" disabled={locked} onClick={onClose}>Hủy</button>}
      {step === 1 ? <button type="button" className="primary-btn" disabled={locked} onClick={() => { if (!draft.contactName.trim() || !draft.phone.trim()) { setLocalError("Nhập người liên hệ và số điện thoại trước khi tiếp tục."); return; } setLocalError(""); onStepChange(2); }}>Tiếp tục: Thành viên →</button> : <button type="button" className="primary-btn" disabled={locked} onClick={onSave}>{live?"Tạo Lead":"Lưu mẫu"}</button>}
    </div>}
  >
    <div className={styles.drawerContent}>
      <div className={styles.stepProgress}><span className="pds-step" data-active={step === 1 || undefined}>1 · Thông tin liên hệ</span><i className="pds-step-rule" /><span className="pds-step" data-active={step === 2 || undefined}>2 · Thành viên</span></div>

      <fieldset disabled={locked} style={{border:0,padding:0,margin:0,minWidth:0}}>
      {step === 1 ? <>
        <PropertySection title="Thông tin liên hệ" schema={CONTACT_FIELD_SCHEMA} values={{ contactName: draft.contactName, phone: draft.phone }} mode={mode === "create" ? "CREATE" : "EDIT"} onChange={(key, value) => onDraftChange({ ...draft, [key]: value as string })} />
        <section className={styles.interestSection}>
          <div className={styles.sectionHeading + " pds-compact-heading"}><div><h3>Chương trình quan tâm</h3><p>{live?"Áp dụng cho các thành viên Student/Guest được khai báo.":"Chọn riêng theo từng chương trình; có thể chọn cả hai."}</p></div><BoDataGridBadge>Tùy chọn</BoDataGridBadge></div>
          <div className={styles.programGrid}>
            {(["AFTERSCHOOL", "MYTIME"] as const).map(program => <article className={styles.programCard + " pds-compact-card"} key={program}>
              <strong>{program === "AFTERSCHOOL" ? "PINO Afterschool" : "MyTime by PINO"}</strong>
              <div>{interestFields.filter(field => field.program === program).map(field => <label className={styles.interestOption + " pds-choice"} key={field.kind}>
                <input type="checkbox" checked={draft.interests.includes(field.kind)} onChange={event => onDraftChange({ ...draft, interests: event.target.checked ? [...draft.interests, field.kind] : draft.interests.filter(kind => kind !== field.kind) })} />
                <span>{field.label}</span>
              </label>)}</div>
            </article>)}
          </div>
        </section>
      </> : <>
        <section className={styles.memberSection}>
          <div className={styles.sectionHeading + " pds-compact-heading"}><div><h3>Thành viên trong household</h3><p>Vai trò dự kiến, chưa phải Actor thật.</p></div><button className="secondary-btn" type="button" onClick={addMember}>＋ Thêm thành viên</button></div>
          {!draft.members.length ? <p className={styles.emptyHint}>Chưa có thành viên. Có thể tạo Lead độc lập.</p> : null}
          {draft.members.map((member, index) => <article className={styles.memberDraft + " pds-compact-card"} key={member.id}>
            <div className={styles.memberDraftHeader + " pds-compact-heading"}><strong>Thành viên {index + 1}</strong><button className="secondary-btn" type="button" onClick={() => removeMember(index)}>Gỡ</button></div>
            <div className={styles.memberFields}>
              <label className="pds-compact-label">Họ và tên<input className="pds-compact-field" value={member.name} onChange={event => updateMember(index, { name: event.target.value })} /></label>
              <label className="pds-compact-label">Tuổi<input className="pds-compact-field" type="number" min={0} max={120} value={member.age ?? ""} onChange={event => updateMember(index, { age: event.target.value === "" ? null : Number(event.target.value) })} /></label>
              <label className="pds-compact-label">Giới tính<select className="pds-compact-field" value={member.gender} onChange={event => updateMember(index, { gender: event.target.value as LeadM1Member["gender"] })}><option>—</option><option>Nữ</option><option>Nam</option><option>Khác</option></select></label>
            </div>
            <div className={styles.roleOptions + " pds-choice-group"} aria-label={"Vai trò của thành viên " + (index + 1)}>
              {(member.primaryContact ? ROLE_OPTIONS : ROLE_OPTIONS.filter(role => role !== "PARENT")).map(role => <label key={role}><input type="checkbox" checked={member.roles.includes(role)} onChange={event => updateMember(index, { roles: event.target.checked ? [...member.roles, role] : member.roles.filter(item => item !== role) })} />{leadM1RoleLabel(role)}</label>)}
            </div>
            <label className={styles.primaryContactOption + " pds-choice"}><input type="checkbox" checked={member.primaryContact} onChange={event => updateMember(index, { primaryContact: event.target.checked })} />Người liên hệ chính</label>
          </article>)}
        </section>
        {live?<p className="pds-compact-muted">Sau khi tạo Lead, mở tab Quan hệ để khai báo liên kết giữa các thành viên.</p>:null}
        {!live&&draft.members.length ? <section className={styles.relationshipSection}>
          <div className={styles.sectionHeading + " pds-compact-heading"}><div><h3>Quan hệ được khai báo</h3><p>Parent → Student hoặc Guest nhỏ tuổi; không xác thực quyền giám hộ.</p></div><BoDataGridBadge>{draft.relationships.length} quan hệ</BoDataGridBadge></div>
          <div className={styles.relationshipComposer}>
            <label className="pds-compact-label">Parent<select className="pds-compact-field" value={relationshipFrom} onChange={event => setRelationshipFrom(event.target.value)}><option value="">Chọn Parent</option>{draft.members.filter(member => member.roles.includes("PARENT")).map(member => <option key={member.id} value={member.id}>{member.name || "Chưa nhập tên"}</option>)}</select></label>
            <label className="pds-compact-label">Student / Guest nhỏ tuổi<select className="pds-compact-field" value={relationshipTo} onChange={event => setRelationshipTo(event.target.value)}><option value="">Chọn thành viên</option>{draft.members.filter(member => member.roles.includes("STUDENT") || (member.roles.includes("GUEST") && member.age !== null && member.age < 18)).map(member => <option key={member.id} value={member.id}>{member.name || "Chưa nhập tên"}</option>)}</select></label>
            <label className="pds-compact-label">Quan hệ<select className="pds-compact-field" value={relationshipLabel} onChange={event => setRelationshipLabel(event.target.value)}><option>Mẹ</option><option>Cha</option><option>Người giám hộ</option><option>Khác</option></select></label>
            <button className="secondary-btn" type="button" onClick={addRelationship}>＋ Thêm</button>
          </div>
          {draft.relationships.map(item => <div className={styles.relationshipLine} key={item.id}>
            <span>{draft.members.find(member => member.id === item.fromMemberId)?.name ?? "—"} → {draft.members.find(member => member.id === item.toMemberId)?.name ?? "—"} · {item.label}</span>
            <BoDataGridStatus value="Khai báo" tone="warning" />
            <button className="secondary-btn" type="button" aria-label={"Gỡ quan hệ " + item.label} onClick={() => onDraftChange({ ...draft, relationships: draft.relationships.filter(relation => relation.id !== item.id) })}>Gỡ</button>
          </div>)}
        </section> : null}
      </>}
      </fieldset>
      {recovery}
      {error || localError ? <p className="pds-field-error" role="alert">{error || localError}</p> : null}
    </div>
  </BoDrawer>;
}
