/** PAP-2426 local-only synthetic review state; never imported by native runtime. */
import {useState} from "react";
import styles from "@/app/bo/sales/leads/lead-household-m1.module.css";
import {LeadHouseholdM1Preview,validLeadRelationship,type LeadDraft,type LeadReviewPort,type LeadReviewSaveContext} from "@/app/bo/sales/leads/LeadHouseholdM1Preview";
import type {LeadM1Record,LeadM1Intent,LeadM1IntentKind,LeadM1Member,LeadM1Relationship} from "@/app/bo/sales/leads/lead-household-presentation";

function createFixtureFromDraft(draft: LeadDraft, id: string): LeadM1Record {
  const members = draft.members.map((member, index) => ({ ...member, id: id + "-MEM-" + String(index + 1).padStart(2, "0") }));
  const oldIds = new Map<string, string>(draft.members.map((member, index) => [member.id, members[index].id] as const));
  const relationships = draft.relationships.map((relation, index) => ({ ...relation, id: id + "-REL-" + String(index + 1).padStart(2, "0"), fromMemberId: oldIds.get(relation.fromMemberId) ?? relation.fromMemberId, toMemberId: oldIds.get(relation.toMemberId) ?? relation.toMemberId }));
  const relatedPeople = members.filter(member => member.roles.some(role => role !== "PARENT")).map(member => member.id);
  const intents: LeadM1Intent[] = draft.interests.map((kind, index) => ({ id: id + "-INT-" + String(index + 1).padStart(2, "0"), kind, source: kind.startsWith("AFTERSCHOOL") ? "PINO Afterschool" : kind.startsWith("MYTIME") ? "MyTime by PINO" : kind === "OPEN_STUDIO" ? "Open Studio" : "Nhập thủ công", memberIds: relatedPeople, status: "SUBMITTED", createdAt: null }));
  return { id, fixture: true, contactName: draft.contactName.trim(), phone: draft.phone.replace(/\D/g, ""), lifecycle: "ACTIVE", members, relationships, intents, createdAt: null, createdBy: null, updatedAt: null, updatedBy: null };
}

export function LeadLocalReview({seed,canonicalReview=false}:{seed:LeadM1Record;canonicalReview?:boolean}) {
  const [records,setRecords]=useState<LeadM1Record[]>(()=>[seed]);
  const [notice,setFixtureNotice]=useState("");
  const [nextFixtureNumber,setNextFixtureNumber]=useState(2);
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
  function addMember(leadId:string,name:string,role:LeadM1Member["roles"][number]) {
    const record=records.find(row=>row.id===leadId);if(!record)return false;
    return updateMembers(leadId,[...record.members,{id:leadId+"-MEM-"+crypto.randomUUID(),name,age:null,gender:"—",roles:[role],primaryContact:false}]);
  }
  function addRelationship(leadId:string,from:string,to:string,label:string) {
    const record=records.find(row=>row.id===leadId);if(!record)return false;
    return updateRelationships(leadId,[...record.relationships,{id:leadId+"-REL-"+crypto.randomUUID(),fromMemberId:from,toMemberId:to,label,status:"DECLARED"}]);
  }
  function saveLeadInterests(leadId: string, kinds: LeadM1IntentKind[]) {
    setRecords(current => current.map(record => {
      if (record.id !== leadId) return record;
      const intents = record.intents.filter(intent => kinds.includes(intent.kind));
      for (const kind of kinds) if (!intents.some(intent => intent.kind === kind)) intents.push({ id: leadId + "-INT-" + kind, kind, source: kind.startsWith("AFTERSCHOOL") ? "PINO Afterschool" : kind.startsWith("MYTIME") ? "MyTime by PINO" : "Nhập thủ công", memberIds: [], status: "SUBMITTED", createdAt: null });
      return { ...record, intents };
    }));
  }
  function saveDraft({draft,drawer,setFormError,setStep,setDrawer,openCreated}:LeadReviewSaveContext) {
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
    if (drawer?.mode === "create") openCreated(nextRecord.id);
  }
  const review:LeadReviewPort={records,notice,label:"DỮ LIỆU MẪU",createLabel:"＋ Tạo Lead mẫu",missingRecordMessage:"Lead fixture không còn tồn tại trong bộ nhớ preview. Refresh để khôi phục fixture chuẩn.",emptyHistory:<LeadHistory/>,backToTable:path=>canonicalReview?path+"?m1Preview=1":path,saveDraft,saveInlineContact,saveMemberInterests,updateMembers,updateRelationships,saveLeadInterests,addMember,addRelationship};
  return <LeadHouseholdM1Preview review={review}/>;
}

function LeadHistory() {
  return <section className={styles.detailContent}>
    <h2>Lịch sử thay đổi</h2>
    <div className={styles.emptyHistory}><strong>Chưa có lịch sử thay đổi</strong></div>
  </section>;
}
