"use client";
import { useEffect, useRef, useState } from "react";
import { BoTypedEditor } from "../../bo/components/registration/BoTypedEditor";
import { allowsField, fieldValueErrors, type AuthorizationContext, type FieldSchema, type ModuleRow, type ModuleSchema, type MutationAdapter } from "@/lib/workspace-schema";
import type { BoField, BoValue } from "@/lib/bo-registration";
import { latestRequest } from "./resource";
import { writeProperty } from "./editing";

export type TddWrites<F extends readonly FieldSchema[]> = { readonly adapter: MutationAdapter<F>; readonly version: string; readonly editorValue?: (field: BoField, value: BoValue) => BoValue; readonly directFields?: readonly string[]; readonly onSaved: (record: ModuleRow<F>, version: string) => void };
export function PropertyEditor<F extends readonly FieldSchema[]>({ schema, context, record, writes, selection, onClose }: {
  readonly schema: ModuleSchema<F>; readonly context: AuthorizationContext; readonly record: ModuleRow<F>;
  readonly writes: TddWrites<F>; readonly selection: { readonly field: BoField; readonly anchor: HTMLElement }; readonly onClose: () => void;
}) {
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState<{ context: AuthorizationContext; version: string } | null>(null);
  const saving = pending?.context === context && pending.version === writes.version;
  const request = useRef(latestRequest<Awaited<ReturnType<MutationAdapter<F>["update"]>>>());
  useEffect(() => { const current = request.current; return () => current.cancel(); }, [schema, context, record.id, writes.version, writes.adapter]);
  const metadata = schema.fields.find(f => f.key === selection.field.key);
  if (!metadata || !writes.version.trim() || !allowsField(schema, context, metadata.key, "inlineEdit")) return null;
  const original = record[metadata.key as keyof ModuleRow<F>] as BoValue;
  const projected = writes.editorValue?.(selection.field, original);
  const save = (next: BoValue) => {
    const value = projected !== undefined && next === projected ? original : next;
    if (saving || !allowsField(schema, context, metadata.key, "inlineEdit")) return;
    if (fieldValueErrors(metadata, value).length) { setStatus("Giá trị chưa hợp lệ."); return; }
    setPending({ context, version: writes.version });
    void request.current.run(signal => writeProperty(schema, context, record, metadata.key, value, writes.version, writes.adapter, signal), result => {
      setPending(null);
      if (result.status === "saved" && result.row.id === record.id && result.version.trim()) { writes.onSaved(result.row, result.version); onClose(); }
      else setStatus(result.status === "conflict" ? "Bản ghi đã thay đổi. Tải lại trước khi lưu." : result.status === "denied" ? "Không có quyền lưu." : "Không thể lưu giá trị.");
    }, () => { setPending(null); setStatus("Không thể lưu. Thử lại sau."); });
  };
  return <>{saving ? <p role="status">Đang lưu…</p> : <BoTypedEditor closeOnSave={false} field={{ ...selection.field, readonly: false }} value={projected ?? original} anchor={selection.anchor} onClose={onClose} onSave={save} />}{status ? <p role="alert">{status}</p> : null}</>;
}

// PAP-2372: opt-in direct fields, existing PropertyEditor unchanged.
export function DirectPropertyEditor<F extends readonly FieldSchema[]>({schema,context,record,writes,field}:{
  schema:ModuleSchema<F>;context:AuthorizationContext;record:ModuleRow<F>;writes:TddWrites<F>;field:BoField;
}) {
  const metadata=schema.fields.find(f=>f.key===field.key);
  const original=record[field.key as keyof ModuleRow<F>] as BoValue;
  const text=String(original??"");
  const [draft,setDraft]=useState({source:text,value:text});
  const [error,setError]=useState("");
  const [saving,setSaving]=useState(false);
  const pending=useRef<AbortController|null>(null);
  const cancelled=useRef(false);
  useEffect(()=>()=>{pending.current?.abort();},[]);
  const value=draft.source===text?draft.value:text;
  if(!metadata||!writes.directFields?.includes(field.key)||!writes.version.trim()||
     !allowsField(schema,context,field.key,"inlineEdit")||
     !["currency","number","select","boolean"].includes(metadata.type))return null;
  const commit=async(raw:string)=>{
    if(pending.current||!allowsField(schema,context,field.key,"inlineEdit"))return;
    let next:BoValue=raw;
    if(metadata.type==="number"||metadata.type==="currency"){
      if(!/^\d+$/.test(raw.trim())){setError("Giá trị chưa hợp lệ.");return;}
      next=Number(raw);
    }else if(metadata.type==="boolean"){
      if(raw!=="true"&&raw!=="false"){setError("Giá trị chưa hợp lệ.");return;}
      next=raw==="true";
    }
    if(fieldValueErrors(metadata,next).length){setError("Giá trị chưa hợp lệ.");return;}
    if(next===original){setError("");return;}
    const request=new AbortController();pending.current=request;setSaving(true);setError("");
    try{
      const result=await writeProperty(schema,context,record,field.key,next,writes.version,writes.adapter,request.signal);
      if(request.signal.aborted)return;
      if(result.status==="saved"){writes.onSaved(result.row,result.version);setError("");}
      else setError(result.status==="conflict"?"Bản ghi đã thay đổi. Tải lại trước khi lưu.":result.status==="denied"?"Không có quyền lưu.":"Không thể lưu giá trị.");
    }catch{if(!request.signal.aborted)setError("Không thể lưu. Thử lại sau.");}
    finally{if(pending.current===request){pending.current=null;if(!request.signal.aborted)setSaving(false);}}
  };
  const direct={className:"pds-direct-field","data-pds-appearance":"underline","aria-label":field.label,"aria-invalid":Boolean(error)||undefined,disabled:saving};
  return <span data-tdd-direct-field={field.key}>
    {metadata.type==="select"||metadata.type==="boolean"?
      <select {...direct} value={text} onChange={event=>void commit(event.target.value)}>
        {metadata.type==="boolean"?<><option value="true">Có</option><option value="false">Không</option></>:metadata.options?.map(option=><option key={option} value={option}>{option}</option>)}
      </select>:
      <input {...direct} inputMode="numeric" value={value} onChange={event=>{setDraft({source:text,value:event.target.value});setError("");}}
        onBlur={()=>{if(cancelled.current){cancelled.current=false;return;}if(value!==text)void commit(value);}}
        onKeyDown={event=>{if(event.key==="Enter"){event.preventDefault();event.currentTarget.blur();}else if(event.key==="Escape"){event.preventDefault();cancelled.current=true;setDraft({source:text,value:text});setError("");event.currentTarget.blur();}}}/>}
    {saving?<span role="status">Đang lưu…</span>:null}
    {error?<span role="alert" className="pds-field-error">{error}</span>:null}
  </span>;
}