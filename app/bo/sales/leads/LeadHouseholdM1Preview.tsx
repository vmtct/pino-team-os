"use client";
import {ManualIntakeDefinitiveRejection,parseManualIntake,type ManualIntakeInput,type ManualIntakeCenter,type ManualIntakeReceipt,type createLeadManualIntakeApi} from "@/lib/bo-lead-manual-intake-api";
import type {LeadRecoveryJournal} from "./lead-recovery-journal";
import type {createLeadIntentApi,IntentAction} from "@/lib/bo-lead-intent-api";
import type {LeadRecoveryInput,LeadRecoveryReceipt} from "@/lib/bo-lead-recovery-api";

import { useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { LeadReadModel } from "./lead-household-read-model";
import { LeadCommandFence, memberInput, type LeadHouseholdApi, type LeadCommand } from "./lead-household-provider";
import type { LeadDetail, LeadIntent, LeadMemberInput, LeadInterest, LeadRelationInput } from "@/lib/bo-lead-household-client";
import { leadReadRow, leadReadDetail, leadAuditTime, leadInquiryLabel, websiteProgramLabel, websiteInquirySummary } from "./lead-household-read-presentation";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TddHostMenu } from "@/app/components/workspace-adapters/SurfaceWorkspace";
import { BoApplicationShellContext } from "@/app/bo/shell/BoApplicationShellContext";
import { applyBoFilterSettings, type BoFilterField, type BoFilterSettings } from "@/lib/bo-filter-settings-state";
import { BoFullDetail } from "@/app/bo/components/BoFullDetail";
import { BoProperties } from "@/app/bo/components/BoProperties";
import { BoDataGrid, BoDataGridBadge, BoDataGridStatus, BoDrawer, type BoDataGridColumn } from "@/app/bo/components/data-grid";
import {
  LEAD_M1_INTEREST_LABELS,
  leadM1MemberSummary,
  leadM1RoleLabel,
  leadM1SearchText,
  type LeadM1IntentKind,
  type LeadM1Member,
  type LeadM1Record,
  type LeadM1Relationship,
  type LeadM1Role,
} from "./lead-household-presentation";
import styles from "./lead-household-m1.module.css";
import {CONTACT_FIELD_SCHEMA,LEAD_TABLE_COLUMNS,LEAD_AUDIT_TABLE_COLUMNS,LEAD_DETAIL_TABS,leadFixtureFilterable} from "./lead-presentation-schema";

export type DrawerState = { mode: "create" } | { mode: "edit"; leadId: string };
export type LeadDraft = {
  contactName: string;
  phone: string;
  members: LeadM1Member[];
  relationships: LeadM1Relationship[];
  interests: LeadM1IntentKind[];
};
export type LeadReviewSaveContext = { draft: LeadDraft; drawer: DrawerState | null; setFormError:(value:string)=>void; setStep:(value:1|2)=>void; setDrawer:(value:DrawerState|null)=>void; openCreated:(id:string)=>void };
export interface LeadReviewPort {
  records: LeadM1Record[];
  notice: string;
  label: string;
  createLabel: string;
  drawer: {createTitle:string;editTitle:string;eyebrow:string;saveLabel:string;contactRequired:boolean;missingContactMessage:string;interestDescription:string};
  missingRecordMessage: string;
  emptyHistory: React.ReactNode;
  backToTable: (pathname:string)=>string;
  saveDraft: (context:LeadReviewSaveContext)=>void;
  saveInlineContact: (id:string,name:string,phone:string)=>boolean;
  saveMemberInterests: (leadId:string,memberId:string,kinds:LeadM1IntentKind[])=>void;
  updateMembers: (leadId:string,members:LeadM1Member[])=>boolean;
  addMember: (leadId:string,name:string,role:LeadM1Role)=>boolean;
  addRelationship: (leadId:string,from:string,to:string,label:string)=>boolean;
  updateRelationships: (leadId:string,relationships:LeadM1Relationship[])=>boolean;
  saveLeadInterests: (leadId:string,kinds:LeadM1IntentKind[])=>void;
}
type FieldMode = "VIEW" | "CREATE" | "EDIT";

const PROGRAM_OPTIONS: Array<{ kind: LeadM1IntentKind; program: "AFTERSCHOOL" | "MYTIME"; label: string }> = [
  { kind: "AFTERSCHOOL_ART", program: "AFTERSCHOOL", label: "Hội họa" },
  { kind: "AFTERSCHOOL_PIANO", program: "AFTERSCHOOL", label: "Piano" },
  { kind: "MYTIME_ACRYLIC", program: "MYTIME", label: "Hội họa" },
  { kind: "MYTIME_PIANO", program: "MYTIME", label: "Piano" },
];
const ROLE_OPTIONS: LeadM1Role[] = ["PARENT", "STUDENT", "GUEST"];

function makeDraft(lead?: LeadM1Record): LeadDraft {
  return { contactName: lead?.contactName ?? "", phone: lead?.phone ?? "", members: lead ? lead.members.map(member => ({ ...member, roles: [...member.roles] })) : [], relationships: lead ? lead.relationships.map(item => ({ ...item })) : [], interests: lead ? lead.intents.map(intent => intent.kind) : [] };
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

export function LeadHouseholdM1Preview({review,readApi,commandApi,recoveryJournal,recoverApi,intentApi,manualApi}: ({readApi:Pick<LeadHouseholdApi,"search"|"detail"|"history">;review?:never}|{readApi?:never;review:LeadReviewPort}) & {commandApi?:LeadHouseholdApi;recoveryJournal?:LeadRecoveryJournal;recoverApi?:(input:LeadRecoveryInput)=>Promise<LeadRecoveryReceipt>;intentApi?:ReturnType<typeof createLeadIntentApi>;manualApi?:ReturnType<typeof createLeadManualIntakeApi>}) {
  if ((!readApi && !review) || (readApi && review)) throw new Error("Lead provider must be explicitly selected");
  const hostMenu = useContext(TddHostMenu);
  const applicationMenu = useContext(BoApplicationShellContext);
  // Register the application-owned slot instead of duplicating its fallback trigger.
  const menu = applicationMenu ?? hostMenu;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [,refreshRead] = useReducer((v:number)=>v+1,0);
  const readModel = useMemo(()=>readApi?new LeadReadModel(readApi,refreshRead):null,[readApi]);
  const commandFence=useMemo(()=>commandApi&&commandApi===readApi&&!review?new LeadCommandFence(commandApi,undefined,recoveryJournal,recoverApi,intentApi,manualApi):null,[commandApi,readApi,review,recoveryJournal,recoverApi,intentApi,manualApi]);
  const [manualOpen,setManualOpen]=useState(false);
  const [commandNotice,setCommandNotice]=useState("");
  const commandBusyRef=useRef(false);
  const [commandBusy,setCommandBusy]=useState(false);
  const [archiveTarget,setArchiveTarget]=useState<string|null>(null);
  const [archiveReason,setArchiveReason]=useState("");
  const records = readModel ? readModel.directory.items.map(leadReadRow) : review?.records ?? [];
  useEffect(()=>()=>readModel?.dispose(),[readModel]);
  const [query, setQuery] = useState("");
  const [lifecycle, setLifecycle] = useState<"ALL" | "ACTIVE" | "ARCHIVED">("ALL");
  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  const [draft, setDraft] = useState<LeadDraft>(() => makeDraft());
  const [step, setStep] = useState<1 | 2>(1);
  const [formError, setFormError] = useState("");
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

  async function executeContact(operation:()=>Promise<LeadDetail|null>):Promise<boolean>{
    if(!commandFence||!readModel||commandBusyRef.current)return false;
    commandBusyRef.current=true;setCommandBusy(true);setCommandNotice("");
    try {
      const result=operation();refreshRead();
      const detail=await result;
      if(!detail){setCommandNotice("Không tìm thấy Lead trong phạm vi được phép xem. Kiểm tra lại thông tin trước khi gửi yêu cầu mới.");return false;}
      await Promise.all([readModel.refreshDirectory(),readModel.selected.id===detail.id?readModel.select(detail.id):Promise.resolve()]);
      if(activeTab==="history"&&readModel.selected.id===detail.id&&readModel.selected.phase==="ready")await readModel.openHistory();
      const refreshFailed=readModel.directory.phase==="error"||(readModel.selected.id===detail.id&&readModel.selected.phase!=="ready");
      setCommandNotice(refreshFailed?"Đã xác nhận kết quả Lead; chưa tải lại được toàn bộ dữ liệu.":drawer?.mode==="create"&&commandFence.createOutcome==="reused"?"Lead đã tồn tại. Đã mở Lead hiện có; chưa thêm thành viên hoặc thay đổi thông tin.":"Đã tải lại thông tin Lead.");
      if(drawer?.mode==="create"){setDrawer(null);openFullDetail(detail.id);}
      if(archiveTarget===detail.id&&detail.status==="ARCHIVED"){setArchiveTarget(null);setArchiveReason("");}
      return true;
    }catch{
      setCommandNotice(commandFence.state==="uncertain"?"Chưa xác định kết quả. Chỉ thử lại cùng yêu cầu.":commandFence.state==="conflict"?"Dữ liệu đã thay đổi. Tải lại trước khi chỉnh sửa.":commandFence.state==="reload_required"?"Đã nhận kết quả, cần tải lại Lead.":"Không thể cập nhật Lead.");
      return false;
    }finally{commandBusyRef.current=false;setCommandBusy(false);refreshRead();}
  }
  async function executeManual(operation:()=>Promise<{receipt:ManualIntakeReceipt;detail:LeadDetail|null}>){
    if(!commandFence||!readModel||commandBusyRef.current)return;
    commandBusyRef.current=true;setCommandBusy(true);setCommandNotice("");
    try{
      const pending=operation();refreshRead();
      const {detail}=await pending;
      setManualOpen(false);
      await readModel.refreshDirectory();
      if(detail){
        const params=new URLSearchParams(searchParams.toString());params.delete("quickView");params.delete("leadIntent");params.set("lead",detail.id);params.set("tab","history");
        router.push(pathname+"?"+params.toString(),{scroll:false});
        if(readModel.selected.id===detail.id){await readModel.select(detail.id);if(readModel.selected.phase==="ready")await readModel.openHistory();}
      }
      setCommandNotice(detail?"Đã ghi nhận lượt tiếp nhận.":"Đã ghi nhận lượt tiếp nhận. Lead không nằm trong phạm vi xem hiện tại.");
    }catch(error){
      if(error instanceof ManualIntakeDefinitiveRejection&&commandFence.state==="idle"){
        setManualOpen(false);
        setCommandNotice("Yêu cầu chưa được ghi. Mở lại tiếp nhận thủ công để kiểm tra Center và thông tin trước khi gửi yêu cầu mới.");
      }else setCommandNotice("Chưa xác định kết quả tiếp nhận. Kiểm tra kết quả trước khi gửi yêu cầu mới.");
    }finally{commandBusyRef.current=false;setCommandBusy(false);refreshRead();}
  }
  function submitHistoryIntent(intent:LeadIntent,action:IntentAction,reason?:string):Promise<boolean>{
    const target=readModel?.selected.record;
    if(!intentApi||!recoveryJournal||!commandFence||commandFence.state!=="idle"||!target||target.id!==selectedLeadId||target.status!=="ACTIVE"||readModel?.selected.phase!=="ready"||readModel.history.phase!=="ready"||activeTab!=="history")return Promise.resolve(false);
    const current=readModel.history.items.find(item=>item.id===intent.id&&item.version===intent.version&&item.status===intent.status);
    if(!current||current.status==="CLOSED"||action==="contacted"&&current.status!=="SUBMITTED"||action==="verify-contact"&&current.status!=="SUBMITTED"&&current.status!=="CONTACTED")return Promise.resolve(false);
    return executeContact(()=>commandFence.submitIntent({leadId:target.id,intentId:current.id},action,{expectedVersion:current.version,...(action==="close"?{reason}: {})}));
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
  function submitArchive(){
    const reason=archiveReason.trim();
    if(!archiveTarget||archiveTarget!==selectedLeadId||!reason||reason.length>240)return;
    void submitMember(target=>target.id===archiveTarget?{kind:"archive",leadId:target.id,expectedVersion:target.version,reason}:null);
  }
  function updateCanonicalMember(memberId:string,patch:Partial<LeadMemberInput>){
    return submitMember(target=>{
      const member=target.members.find(m=>m.id===memberId);
      return member?{kind:"updateMember",leadId:target.id,expectedVersion:target.version,memberId,member:memberInput(member,patch)}:null;
    });
  }
  const term = query.trim().toLocaleLowerCase("vi");
  const filteredRecords = readModel ? records : records.filter(record => (lifecycle === "ALL" || record.lifecycle === lifecycle) && (!term || leadM1SearchText(record).includes(term)));

  const reviewLabel = review?.label;
  const columns = useMemo<BoDataGridColumn<LeadM1Record>[]>(() => [
    { ...LEAD_TABLE_COLUMNS.contact, sortable: !readModel, render: record => <div className={styles.identityCell}><strong>{record.contactName}</strong>{record.websiteSubmittedName?<small>Tên gửi từ website: {record.websiteSubmittedName}</small>:null}<small>{record.id}</small>{reviewLabel?<BoDataGridBadge>{reviewLabel}</BoDataGridBadge>:null}</div> },
    { ...LEAD_TABLE_COLUMNS.phone, render: record => <span className={styles.mono}>{record.phone}</span> },
    { ...LEAD_TABLE_COLUMNS.household, render: record => <div className={styles.stackCell}><strong>{record.memberCount??record.members.length} thành viên</strong><small>{record.tablePresentation?.memberSummary||"—"}</small></div> },
    { ...LEAD_TABLE_COLUMNS.interest, render: record => <div className={styles.badgeWrap + " pds-choice-group"}>{record.tablePresentation?record.tablePresentation.interestLabels.map(item => <BoDataGridBadge key={item.id}>{item.label}</BoDataGridBadge>):record.websiteProgram?<BoDataGridBadge>{websiteProgramLabel(record.websiteProgram)}</BoDataGridBadge>:"—"}</div> },
    { ...LEAD_TABLE_COLUMNS.source, render: record => <div className={styles.stackCell}>{record.tablePresentation?record.tablePresentation.sourceLabels.map(source => <small key={source}>{source}</small>):record.websiteProgram?"Website":"—"}</div> },
    { ...LEAD_TABLE_COLUMNS.lifecycle, render: record => <BoDataGridStatus value={record.lifecycle === "ACTIVE" ? "Đang hoạt động" : "Đã lưu trữ"} tone={record.lifecycle === "ACTIVE" ? "success" : "neutral"} /> },
    ...LEAD_AUDIT_TABLE_COLUMNS.map(field => ({ key: field.key, header: field.header, minWidth: field.minWidth, render: (record: LeadM1Record) => field.type==="datetime"?leadAuditTime(record[field.key]):record[field.key]??field.fallback })),
  ], [readModel,reviewLabel]);

  const filterFields = useMemo<BoFilterField[]>(() => columns.map(column => ({key:column.key, type:"text", filterable:leadFixtureFilterable(column.key,!!readModel)})), [columns,readModel]);
  const [tableSettings,setTableSettings] = useState<BoFilterSettings>(() => ({group:{combinator:"and",filters:[]},visibleKeys:columns.map(column=>column.key)}));
  const [sortDirection,setSortDirection] = useState<"asc"|"desc">("asc");
  const tableRows = readModel?filteredRecords:[...applyBoFilterSettings(filteredRecords,tableSettings,filterFields)].sort((a,b) => a.contactName.localeCompare(b.contactName,"vi")*(sortDirection==="asc"?1:-1));

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

  function saveDraft() {
    if(readModel){
      if(!commandFence||commandFence.state!=="idle"||commandBusyRef.current||drawer?.mode!=="create")return;
      const phone=draft.phone.replace(/\D/g,"").replace(/^84/,"0");
      if(!/^0\d{9}$/.test(phone)){setFormError("Nhập số điện thoại hợp lệ.");setStep(1);return;}
      const primaries=draft.members.filter(m=>m.primaryContact);
      const interests=draft.interests.filter(isMemberInterest);
      if(draft.members.length>20||primaries.length>1||draft.members.some(m=>!m.name.trim()||!m.roles.length||(!m.primaryContact&&m.roles.includes("PARENT"))||m.age!==null&&(!Number.isInteger(m.age)||m.age<0||m.age>120))){setFormError("Kiểm tra thông tin thành viên (tối đa 20) và liên hệ chính.");setStep(2);return;}
      if(draft.relationships.length||interests.length!==draft.interests.length||interests.length&&!draft.members.some(m=>m.roles.some(r=>r!=="PARENT"))){setFormError("Chương trình quan tâm cần Student/Guest; khai báo quan hệ sau khi tạo Lead.");setStep(2);return;}
      const members:LeadMemberInput[]=draft.members.map(m=>({displayName:m.name.trim(),intendedRoles:m.roles,gender:m.gender==="Nam"?"MALE":m.gender==="Nữ"?"FEMALE":m.gender==="Khác"?"OTHER":null,birthPrecision:"UNKNOWN",birthYear:null,birthMonth:null,birthDay:null,reportedAge:m.age,interestKinds:m.roles.some(r=>r!=="PARENT")?interests:[]}));
      const primaryMemberIndex=draft.members.findIndex(m=>m.primaryContact);
      setFormError("");void executeContact(()=>commandFence.submit({kind:"create",input:{contact:{phone,contactDisplayName:draft.contactName.trim()||null},members,primaryMemberIndex:primaryMemberIndex<0?null:primaryMemberIndex}}));return;
    }
    review?.saveDraft({draft,drawer,setFormError,setStep,setDrawer,openCreated:id=>setPreviewParam("lead",id)});
  }

  const backToTable = review?.backToTable(pathname) ?? pathname;
  const currentUrl = pathname + (searchParams.size ? "?" + searchParams.toString() : "");

  return <main className={styles.page}>
    {commandFence?.state==="recovery_blocked"?<p role="alert" className={styles.previewNotice}>{commandFence.rejectedIntent?"Dữ liệu tiếp nhận đã thay đổi; yêu cầu chưa được ghi. Tải lại Lead trước khi chỉnh sửa.":"Chưa xác định kết quả yêu cầu trước hoặc không đọc được nhật ký khôi phục. Không thể chỉnh sửa Lead cho đến khi có xác nhận kết quả từ hệ thống."}</p>:null}
    {commandFence?.canRecover&&!drawer&&!archiveTarget?<button type="button" className="secondary-btn" disabled={commandBusy} onClick={()=>void executeContact(async()=>{const detail=await commandFence.recoverCommitted();openFullDetail(detail.id);return detail;})}>{commandFence.rejectedIntent?"Tải lại Lead":"Kiểm tra kết quả yêu cầu trước"}</button>:null}
    {commandFence?.canRecoverManual&&!manualOpen?<button type="button" className="secondary-btn" disabled={commandBusy} onClick={()=>void executeManual(()=>commandFence.recoverManual())}>Kiểm tra kết quả tiếp nhận</button>:null}{commandFence&&commandNotice&&!drawer&&!archiveTarget&&!manualOpen?<p role="status" className={styles.previewNotice}>{commandNotice}</p>:null}
    {!drawer&&!archiveTarget&&commandFence?.state==="uncertain"?<button type="button" className="secondary-btn" disabled={commandBusy} onClick={()=>void executeContact(()=>commandFence.retry())}>Thử lại cùng yêu cầu</button>:null}
    {!drawer&&!archiveTarget&&commandFence&&(commandFence.state==="reload_required"||commandFence.state==="conflict")&&commandFence.reloadTarget?<button type="button" className="secondary-btn" disabled={commandBusy} onClick={()=>{const id=commandFence.reloadTarget;if(id)void executeContact(()=>commandFence.reload(id));}}>Tải lại Lead</button>:null}
    {readModel&&selectedLeadId&&!selectedLead?<div role="status"><button className="secondary-btn" onClick={()=>setPreviewParam("lead",null)}>← Danh bạ Leads</button><LeadReadStatus phase={readModel.selected.phase} error={readModel.selected.error?.status} onRetry={()=>void readModel.select(selectedLeadId)} /></div>:null}
    {!selectedLead && !(readModel&&selectedLeadId) ? <><header className={styles.heading}>
      <div>
        <div className={styles.titleRow}>{menu("lead-menu-btn")}<h1>Leads</h1></div>
        <p>Danh bạ đầu mối theo số điện thoại; thành viên và nhu cầu được gom dưới cùng một Lead.</p>
      </div>
      <div className={styles.headingActions + " pds-compact-actions"}>
        {review?.label?<BoDataGridBadge>{review.label}</BoDataGridBadge>:null}
        {manualApi&&recoveryJournal&&commandFence?<button className="secondary-btn" type="button" disabled={commandBusy||commandFence.state!=="idle"||Boolean(drawer)||manualOpen||Boolean(quickViewId)} onClick={()=>{setCommandNotice("");setManualOpen(true);}}>＋ Tiếp nhận thủ công</button>:null}<button className="primary-btn" type="button" disabled={manualOpen||Boolean(readModel)&&(!commandFence||commandBusy||commandFence.state!=="idle")} onClick={openCreate}>{review?.createLabel??"＋ Tạo Lead"}</button>
      </div>
    </header>


    {review?.notice ? <p className={styles.previewNotice} role="status">{review.notice}</p> : null}

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
      description={selectedLead.id + (review?.label?" · "+review.label:"")}
      currentUrl={currentUrl}
      returnTo={backToTable}
      activeTab={activeTab}
      designVariant="business-v25"
      actions={<div className={styles.detailActions}>{menu("lead-detail-menu-btn")}{commandFence&&currentDetail?.id===selectedLead.id&&currentDetail.status==="ACTIVE"?<button type="button" className="secondary-btn" disabled={commandBusy||commandFence.state!=="idle"} onClick={()=>{setArchiveReason("");setCommandNotice("");setArchiveTarget(selectedLead.id);}}>Lưu trữ Lead</button>:null}{review?.label?<BoDataGridBadge>{review.label}</BoDataGridBadge>:null}</div>}
      tabs={[
        { ...LEAD_DETAIL_TABS.detail, content: <LeadOverview record={selectedLead} liveContact={commandFence&&currentDetail&&currentDetail.id===selectedLead.id&&currentDetail.status==="ACTIVE"?{name:currentDetail.contactDisplayName,phone:currentDetail.phone,version:currentDetail.version,disabled:commandBusy||commandFence.state!=="idle",save:saveCanonicalContact}:undefined} onSave={(name, phone) => review?.saveInlineContact(selectedLead.id, name, phone) ?? false} onSaveInterests={kinds => review?.saveLeadInterests(selectedLead.id, kinds)} /> },
        { ...LEAD_DETAIL_TABS.members, content: <LeadMembers record={selectedLead} live={commandFence&&currentDetail?.id===selectedLead.id&&currentDetail.status==="ACTIVE"?{detail:currentDetail,disabled:commandBusy||commandFence.state!=="idle",update:updateCanonicalMember,add:(name,role)=>submitMember(target=>({kind:"addMember",leadId:target.id,expectedVersion:target.version,member:{displayName:name,intendedRoles:[role],gender:null,birthPrecision:"UNKNOWN",birthYear:null,birthMonth:null,birthDay:null,reportedAge:null,interestKinds:[]}})),primary:memberId=>submitMember(target=>({kind:"primary",leadId:target.id,expectedVersion:target.version,memberId})),retire:memberId=>submitMember(target=>({kind:"retireMember",leadId:target.id,expectedVersion:target.version,memberId}))}:undefined} onReviewAdd={(name,role)=>review?.addMember(selectedLead.id,name,role)??false} onSave={members => review?.updateMembers(selectedLead.id, members) ?? false} onSaveInterests={(memberId, kinds) => review?.saveMemberInterests(selectedLead.id, memberId, kinds)} /> },
        { ...LEAD_DETAIL_TABS.relationships, content: <LeadRelationships record={selectedLead} live={commandFence&&currentDetail?.id===selectedLead.id&&currentDetail.status==="ACTIVE"?{disabled:commandBusy||commandFence.state!=="idle",add:relationship=>submitMember(target=>({kind:"addRelation",leadId:target.id,expectedVersion:target.version,relationship})),update:(relationshipId,relationship)=>submitMember(target=>target.relationships.some(r=>r.id===relationshipId&&r.status==="DECLARED")?{kind:"updateRelation",leadId:target.id,expectedVersion:target.version,relationshipId,relationship}:null),confirm:relationshipId=>submitMember(target=>target.relationships.some(r=>r.id===relationshipId&&r.status==="DECLARED")?{kind:"confirmRelation",leadId:target.id,expectedVersion:target.version,relationshipId}:null),retire:relationshipId=>submitMember(target=>target.relationships.some(r=>r.id===relationshipId)?{kind:"retireRelation",leadId:target.id,expectedVersion:target.version,relationshipId}:null)}:undefined} onReviewAdd={(from,to,label)=>review?.addRelationship(selectedLead.id,from,to,label)??false} onSave={relationships => review?.updateRelationships(selectedLead.id, relationships) ?? false} /> },
        { ...LEAD_DETAIL_TABS.history, content: readModel?<LeadInquiryHistory model={readModel} live={intentApi&&recoveryJournal&&commandFence&&currentDetail?.id===selectedLead.id&&currentDetail.status==="ACTIVE"?{disabled:commandBusy||commandFence.state!=="idle",submit:submitHistoryIntent}:undefined}/>:review?.emptyHistory??null },
      ]}
    /> : null}

    {quickViewId && !drawer ? <BoDrawer
      title={quickViewLead?.contactName ?? "Lead"}
      eyebrow="Xem nhanh Lead"
      mode="view"
      size="lg"
      onClose={() => setPreviewParam("quickView", null)}
      footer={quickViewLead ? <div className={styles.drawerFooter + " pds-compact-actions"}><button type="button" className="primary-btn" onClick={() => openFullDetail(quickViewLead.id)}>Mở chi tiết đầy đủ →</button></div> : null}
    >{quickViewLead ? <LeadQuickView record={quickViewLead} presentationLabel={review?.label} /> : readModel?<LeadReadStatus phase={readModel.selected.phase} error={readModel.selected.error?.status} onRetry={()=>void readModel.select(quickViewId)}/>:<p role="alert">{review?.missingRecordMessage??"Không tìm thấy Lead"}</p>}</BoDrawer> : null}

    {archiveTarget&&commandFence?<BoDrawer title="Lưu trữ Lead" eyebrow="Lead" mode="edit" size="lg" onClose={()=>{if(!commandBusyRef.current&&commandFence.state==="idle"){setArchiveTarget(null);setArchiveReason("");}}} footer={<div className={styles.drawerFooter+" pds-compact-actions"}><button className="secondary-btn" type="button" disabled={commandBusy||commandFence.state!=="idle"} onClick={()=>{setArchiveTarget(null);setArchiveReason("");}}>Hủy</button><button className="primary-btn" type="button" disabled={commandBusy||commandFence.state!=="idle"||currentDetail?.id!==archiveTarget||currentDetail.status!=="ACTIVE"||!archiveReason.trim()||archiveReason.trim().length>240} onClick={submitArchive}>Xác nhận lưu trữ</button></div>}>
      <div className={styles.drawerContent}><p>Lead được lưu trữ, không bị xóa. Tất cả lượt tiếp nhận phải đã đóng trước khi lưu trữ.</p><label className="pds-compact-label">Lý do lưu trữ<textarea className="pds-compact-field" maxLength={240} required disabled={commandBusy||commandFence.state!=="idle"} value={archiveReason} onChange={event=>setArchiveReason(event.target.value)}/></label>{commandNotice?<p role="status">{commandNotice}</p>:null}{commandFence.state==="uncertain"?<button type="button" className="secondary-btn" disabled={commandBusy} onClick={()=>void executeContact(()=>commandFence.retry())}>Thử lại cùng yêu cầu</button>:null}{(commandFence.state==="conflict"||commandFence.state==="reload_required")&&commandFence.reloadTarget?<button type="button" className="secondary-btn" disabled={commandBusy} onClick={()=>{const id=commandFence.reloadTarget;if(id)void executeContact(()=>commandFence.reload(id));}}>Tải lại Lead</button>:null}</div>
    </BoDrawer>:null}
    {manualOpen&&manualApi&&commandFence?<ManualIntakeDrawer api={manualApi} locked={commandFence.state!=="idle"} busy={commandBusy} canRecover={commandFence.canRecoverManual} notice={commandNotice} onClose={()=>setManualOpen(false)} onSubmit={input=>void executeManual(()=>commandFence.submitManual(input))} onRecover={()=>void executeManual(()=>commandFence.recoverManual())}/>:null}
    {drawer ? <LeadCreateEditDrawer
      mode={drawer.mode}
      draft={draft}
      step={step}
      error={formError}
      live={Boolean(commandFence)}
      reviewPresentation={review?.drawer}
      locked={Boolean(commandFence)&&(commandBusy||commandFence?.state!=="idle")}
      recovery={commandFence?<>{commandNotice?<p role="status">{commandNotice}</p>:null}{commandFence.state==="uncertain"?<button type="button" className="secondary-btn" disabled={commandBusy} onClick={()=>void executeContact(()=>commandFence.retry())}>Thử lại cùng yêu cầu</button>:null}{commandFence.isCreateConflict?<button type="button" className="secondary-btn" disabled={commandBusy} onClick={()=>void executeContact(()=>commandFence.reloadCreateConflict())}>Kiểm tra Lead đã có</button>:null}{commandFence.state==="reload_required"&&commandFence.reloadTarget?<button type="button" className="secondary-btn" disabled={commandBusy} onClick={()=>{const id=commandFence.reloadTarget;if(id)void executeContact(()=>commandFence.reload(id));}}>Tải lại Lead</button>:null}</>:undefined}
      onClose={() => { if(commandFence&&(commandBusyRef.current||commandFence.state!=="idle"))return;setDrawer(null); setFormError(""); }}
      onStepChange={setStep}
      onDraftChange={setDraft}
      onSave={saveDraft}
    /> : null}
  </main>;
}

type ManualApi=ReturnType<typeof createLeadManualIntakeApi>;
function ManualIntakeDrawer({api,locked,busy,canRecover,notice,onClose,onSubmit,onRecover}:{api:ManualApi;locked:boolean;busy:boolean;canRecover:boolean;notice:string;onClose:()=>void;onSubmit:(input:ManualIntakeInput)=>void;onRecover:()=>void}){
 const [centers,setCenters]=useState<ManualIntakeCenter[]|null>(null);
 const [failed,setFailed]=useState(false);
 const [attempt,setAttempt]=useState(0);
 const [draft,setDraft]=useState({centerId:"",phone:"",sourceBrand:"PINO_HOUSE",intentKind:"GENERAL_INQUIRY",age:""});
 useEffect(()=>{
  let active=true;
  void api.centers().then(rows=>{if(active){setCenters(rows);setFailed(false);}}).catch(()=>{if(active){setCenters(null);setFailed(true);}});
  return ()=>{active=false;};
 },[api,attempt]);
 const input=parseManualIntake({centerId:draft.centerId,phone:draft.phone,sourceBrand:draft.sourceBrand,intentKind:draft.intentKind,childAge:draft.age.trim()===""?null:Number(draft.age)});
 const valid=input&&centers?.some(c=>c.id===input.centerId);
 const disabled=locked||busy||!centers;
 return <BoDrawer title="Tiếp nhận thủ công" eyebrow="Lead" mode="create" size="lg" onClose={()=>{if(!locked&&!busy)onClose();}} footer={<div className={styles.drawerFooter+" pds-compact-actions"}><button className="secondary-btn" type="button" disabled={locked||busy} onClick={onClose}>Hủy</button>{canRecover?<button type="button" className="primary-btn" disabled={busy} onClick={onRecover}>Kiểm tra kết quả tiếp nhận</button>:<button type="button" className="primary-btn" disabled={disabled||!valid} onClick={()=>{if(input&&valid)onSubmit(input);}}>Xác nhận tiếp nhận</button>}</div>}>
 <div className={styles.drawerContent}><p>Ghi nhận một lượt tiếp nhận vào danh bạ Lead theo số điện thoại. Không tự tạo hồ sơ thành viên.</p>
 {failed?<div role="alert"><p>Không thể tải Center được cấp quyền.</p><button type="button" className="secondary-btn" disabled={locked||busy} onClick={()=>{setFailed(false);setAttempt(v=>v+1);}}>Thử lại</button></div>:centers===null?<p role="status">Đang tải Center…</p>:centers.length===0?<p role="alert">Không có Center đang hoạt động được cấp quyền.</p>:null}
 <label className="pds-compact-label">Center<select aria-label="Center" className="pds-compact-field" required disabled={disabled} value={draft.centerId} onChange={e=>setDraft(v=>({...v,centerId:e.target.value}))}><option value="">Chọn Center</option>{centers?.map(c=><option key={c.id} value={c.id}>{c.displayName}</option>)}</select></label>
 <label className="pds-compact-label">Số điện thoại<input aria-label="Số điện thoại" className="pds-compact-field" type="tel" maxLength={40} required disabled={disabled} value={draft.phone} onChange={e=>setDraft(v=>({...v,phone:e.target.value}))}/></label>
 <label className="pds-compact-label">Nguồn tiếp nhận<select aria-label="Nguồn tiếp nhận" className="pds-compact-field" disabled={disabled} value={draft.sourceBrand} onChange={e=>setDraft(v=>({...v,sourceBrand:e.target.value}))}><option value="PINO_HOUSE">PINO House</option><option value="TOPPI">Toppi</option></select></label>
 <label className="pds-compact-label">Nhu cầu<select aria-label="Nhu cầu" className="pds-compact-field" disabled={disabled} value={draft.intentKind} onChange={e=>setDraft(v=>({...v,intentKind:e.target.value}))}><option value="GENERAL_INQUIRY">Tư vấn chung</option><option value="PROGRAM_INTEREST">Quan tâm chương trình</option><option value="OPEN_STUDIO">Open Studio</option></select></label>
 <label className="pds-compact-label">Tuổi bé (không bắt buộc)<input aria-label="Tuổi bé (không bắt buộc)" className="pds-compact-field" type="number" min={2} max={17} step={1} disabled={disabled} value={draft.age} onChange={e=>setDraft(v=>({...v,age:e.target.value}))}/></label>
 {notice?<p role="status">{notice}</p>:null}
 </div></BoDrawer>;
}
function LeadQuickView({ record,presentationLabel }: { record: LeadM1Record;presentationLabel?:string }) {
  return <div className={styles.quickView}>
    {presentationLabel?<div className="pds-compact-muted">{presentationLabel}</div>:null}
    <PropertySection title="Thông tin liên hệ" schema={CONTACT_FIELD_SCHEMA} values={{ contactName: record.contactName, phone: record.phone }} mode="VIEW" />
    <BoProperties compact items={[
      ...(record.websiteSubmittedName?[{key:"websiteSubmittedName",label:"Tên gửi từ website",value:record.websiteSubmittedName}]:[]),
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
function LeadOverview({ record, onSave, onSaveInterests,liveContact }: { record: LeadM1Record; onSave: (name: string, phone: string) => boolean; onSaveInterests: (kinds: LeadM1IntentKind[]) => void;liveContact?:LiveContact }) {
  return <div className={styles.detailContent}>
    <BoProperties items={[
      { key: "contact", label: "Người liên hệ", value: liveContact?<LeadContactInline key={record.id+":"+liveContact.version+":name"} value={liveContact.name??""} label="Người liên hệ" disabled={liveContact.disabled} onSave={name=>liveContact.save("name",name)}/>:!record.fixture?record.contactName:<LeadInlineText key={record.id + record.contactName} label="Người liên hệ" value={record.contactName} onCommit={name => onSave(name, record.phone)} /> },
      { key: "phone", label: "Số điện thoại", value: liveContact?<LeadContactInline key={record.id+":"+liveContact.version+":phone"} value={liveContact.phone} label="Số điện thoại" inputMode="tel" disabled={liveContact.disabled} onSave={phone=>liveContact.save("phone",phone)}/>:!record.fixture?record.phone:<LeadInlineText key={record.id + record.phone} label="Số điện thoại" inputMode="tel" value={record.phone} onCommit={phone => onSave(record.contactName, phone)} /> },
      ...(record.websiteSubmittedName?[{key:"websiteSubmittedName",label:"Tên gửi từ website",value:record.websiteSubmittedName}]:[]),
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
  </div>;
}
type LiveMembers={detail:LeadDetail;disabled:boolean;update:(id:string,patch:Partial<LeadMemberInput>)=>Promise<boolean>;add:(name:string,role:LeadM1Role)=>Promise<boolean>;primary:(id:string|null)=>Promise<boolean>;retire:(id:string)=>Promise<boolean>};
const isMemberInterest=(kind:LeadM1IntentKind):kind is LeadInterest=>kind==="AFTERSCHOOL_ART"||kind==="AFTERSCHOOL_PIANO"||kind==="MYTIME_ACRYLIC"||kind==="MYTIME_PIANO";
function LeadMembers({ record, onSave, onSaveInterests,live,onReviewAdd }: { record: LeadM1Record; onReviewAdd:(name:string,role:LeadM1Role)=>boolean; onSave: (members: LeadM1Member[]) => boolean; onSaveInterests: (memberId: string, kinds: LeadM1IntentKind[]) => void;live?:LiveMembers }) {
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
    <form className="pds-compact-form" onSubmit={event=>{event.preventDefault();if(!newName.trim())return;if(live){if(!live.disabled)void live.add(newName.trim(),newRole).then(ok=>{if(ok)setNewName("");});return;}if(!record.fixture)return;const ok=onReviewAdd(newName.trim(),newRole);setError(ok?"":"Thành viên hoặc quan hệ không hợp lệ. Kiểm tra vai trò và quan hệ khai báo.");if(ok)setNewName("");}}>
      <input className="pds-direct-field" data-pds-appearance="underline" disabled={live?live.disabled:!record.fixture} aria-label="Tên thành viên mới" placeholder="Tên thành viên mới" value={newName} onChange={event=>setNewName(event.target.value)} required />
      <select className="pds-direct-field" data-pds-appearance="underline" disabled={live?live.disabled:!record.fixture} aria-label="Vai trò thành viên mới" value={newRole} onChange={event=>setNewRole(event.target.value as LeadM1Role)}><option value="STUDENT">Student</option><option value="GUEST">Guest</option></select>
      <button type="submit" disabled={live?live.disabled:!record.fixture} className="pds-text-action">＋ Thêm thành viên</button>
    </form>
    {error ? <p role="alert" className="pds-field-error">{error}</p> : null}
    <p className="pds-compact-muted">Vai trò dự kiến, chưa tạo hồ sơ.</p>
  </section>;
}
export function validLeadRelationship(relation: LeadM1Relationship, members: LeadM1Member[]) {
  const from=members.find(member=>member.id===relation.fromMemberId),to=members.find(member=>member.id===relation.toMemberId);
  return Boolean(from && to && from.id!==to.id && from.roles.includes("PARENT") && (to.roles.includes("STUDENT") || (to.roles.includes("GUEST") && to.age!==null && to.age<18)));
}
type LiveRelationships={disabled:boolean;add:(relationship:LeadRelationInput)=>Promise<boolean>;update:(id:string,relationship:LeadRelationInput)=>Promise<boolean>;confirm:(id:string)=>Promise<boolean>;retire:(id:string)=>Promise<boolean>};
function LeadRelationships({ record, onSave,live,onReviewAdd }: { record: LeadM1Record; onReviewAdd:(from:string,to:string,label:string)=>boolean; onSave: (relationships: LeadM1Relationship[])=>boolean;live?:LiveRelationships }) {
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
    <form className="pds-compact-form" onSubmit={event=>{event.preventDefault();if(live){if(!live.disabled&&from&&to&&from!==to)void live.add({fromMemberId:from,toMemberId:to,relationLabel:label}).then(ok=>{if(ok){setFrom("");setTo("");}});return;}if(!record.fixture)return;const ok=onReviewAdd(from,to,label);setError(ok?"":"Quan hệ không hợp lệ hoặc đã tồn tại.");if(ok){setFrom("");setTo("");}}}>
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
type HistoryActions={disabled:boolean;submit:(intent:LeadIntent,action:IntentAction,reason?:string)=>Promise<boolean>};
function LeadInquiryHistory({model,live}:{model:LeadReadModel;live?:HistoryActions}) {
 const history=model.history;
 return <section className={styles.detailContent}><h2>Lịch sử tiếp nhận</h2>
 {history.phase==="error"||history.phase==="loading"||history.phase==="idle"?<LeadReadStatus phase={history.phase} error={history.error?.status} onRetry={()=>void model.openHistory()}/>:history.items.length?<ul className="pds-compact-list">{history.items.map(intent=><li key={intent.id}><strong>{leadInquiryLabel(intent)}</strong><span>{intent.sourceSurface} · {intent.status} · {leadAuditTime(intent.createdAt)}</span>{intent.websiteInterest?<><span>Tên gửi từ website: {intent.websiteInterest.contactName}</span><span>{websiteInquirySummary(intent)}</span><span>Đồng ý: {intent.websiteInterest.consent.version} · {leadAuditTime(intent.websiteInterest.consent.acceptedAt)}</span></>:null}{live&&intent.status!=="CLOSED"?<LeadInquiryActions key={intent.id+":"+intent.version} intent={intent} live={live}/>:null}</li>)}</ul>:<p>Chưa có lượt tiếp nhận.</p>}
 {history.nextCursor?<button className="secondary-btn" disabled={history.phase==="loading"} onClick={()=>void model.nextHistory()}>Tải thêm</button>:null}
 </section>;
}
function LeadInquiryActions({intent,live}:{intent:LeadIntent;live:HistoryActions}){
 const [reason,setReason]=useState("");
 const [closing,setClosing]=useState(false);
 return <div className="pds-compact-actions" role="group" aria-label={"Thao tác tiếp nhận "+intent.id}>
 {intent.status==="SUBMITTED"?<button className="secondary-btn" type="button" disabled={live.disabled} onClick={()=>void live.submit(intent,"contacted")}>Đã liên hệ</button>:null}
 {intent.status==="SUBMITTED"||intent.status==="CONTACTED"?<button className="secondary-btn" type="button" disabled={live.disabled} onClick={()=>void live.submit(intent,"verify-contact")}>Xác minh Zalo</button>:null}
 {closing?<><label className="pds-compact-label">Lý do đóng<textarea className="pds-compact-field" maxLength={240} value={reason} required disabled={live.disabled} onChange={e=>setReason(e.target.value)}/></label><button className="secondary-btn" type="button" disabled={live.disabled} onClick={()=>{setClosing(false);setReason("");}}>Hủy</button><button className="primary-btn" type="button" disabled={live.disabled||!reason.trim()} onClick={()=>void live.submit(intent,"close",reason.trim())}>Xác nhận đóng</button></>:<button className="secondary-btn" type="button" disabled={live.disabled} onClick={()=>setClosing(true)}>Đóng intent</button>}
 </div>;
}
function LeadCreateEditDrawer({
  mode, draft, step, error, onClose, onStepChange, onDraftChange, onSave,live=false,locked=false,recovery,reviewPresentation,
}: {
  mode: "create" | "edit"; draft: LeadDraft; step: 1 | 2; error: string; live?:boolean;locked?:boolean;recovery?:React.ReactNode;reviewPresentation?:LeadReviewPort["drawer"];
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
    title={reviewPresentation?(mode==="create"?reviewPresentation.createTitle:reviewPresentation.editTitle):"Tạo Lead"}
    eyebrow={reviewPresentation?.eyebrow??"Lead"}
    mode={mode}
    size="lg"
    onClose={onClose}
    footer={<div className={styles.drawerFooter + " pds-compact-actions"}>
      {step === 2 ? <button className="secondary-btn" type="button" disabled={locked} onClick={() => { setLocalError(""); onStepChange(1); }}>← Quay lại</button> : <button className="secondary-btn" type="button" disabled={locked} onClick={onClose}>Hủy</button>}
      {step === 1 ? <button type="button" className="primary-btn" disabled={locked} onClick={() => { if ((reviewPresentation?.contactRequired&&!draft.contactName.trim()) || !draft.phone.trim()) { setLocalError(reviewPresentation?.missingContactMessage??"Nhập số điện thoại trước khi tiếp tục."); return; } setLocalError(""); onStepChange(2); }}>Tiếp tục: Thành viên →</button> : <button type="button" className="primary-btn" disabled={locked} onClick={onSave}>{reviewPresentation?.saveLabel??"Tạo Lead"}</button>}
    </div>}
  >
    <div className={styles.drawerContent}>
      <div className={styles.stepProgress}><span className="pds-step" data-active={step === 1 || undefined}>1 · Thông tin liên hệ</span><i className="pds-step-rule" /><span className="pds-step" data-active={step === 2 || undefined}>2 · Thành viên</span></div>

      <fieldset disabled={locked} style={{border:0,padding:0,margin:0,minWidth:0}}>
      {step === 1 ? <>
        <PropertySection title="Thông tin liên hệ" schema={CONTACT_FIELD_SCHEMA} values={{ contactName: draft.contactName, phone: draft.phone }} mode={mode === "create" ? "CREATE" : "EDIT"} onChange={(key, value) => onDraftChange({ ...draft, [key]: value as string })} />
        <section className={styles.interestSection}>
          <div className={styles.sectionHeading + " pds-compact-heading"}><div><h3>Chương trình quan tâm</h3><p>{reviewPresentation?.interestDescription??"Áp dụng cho các thành viên Student/Guest được khai báo."}</p></div><BoDataGridBadge>Tùy chọn</BoDataGridBadge></div>
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
        {reviewPresentation&&draft.members.length ? <section className={styles.relationshipSection}>
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
