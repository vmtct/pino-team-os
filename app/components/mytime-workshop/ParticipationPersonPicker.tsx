"use client";
/** PAP-2242 M1. Host supplies canonical Person results; no synthetic identities. */
import {useMemo,useState} from "react";

export type ParticipationPersonOption = {
  personId: string;
  fullName: string;
  age: number | null;
  phoneLast4: string | null;
};

export function personParticipationLabel(person: ParticipationPersonOption): string {
  const suffix = person.phoneLast4 && /^[0-9]{4}$/.test(person.phoneLast4) ? person.phoneLast4 : "—";
  return `${person.fullName} - ${person.age === null ? "—" : `${person.age}t`} - ${suffix}`;
}

export function ParticipationPersonPicker({people,selectedId,onSelect,disabled=false}:{
  people: readonly ParticipationPersonOption[];
  selectedId: string;
  onSelect: (personId:string)=>void;
  disabled?: boolean;
}) {
  const [search,setSearch]=useState("");
  const options=useMemo(()=>people.filter(p=>personParticipationLabel(p).toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi"))),[people,search]);
  const unavailable=disabled||people.length===0;
  return <>
    <input className="edit-input" aria-label="Tìm Person" id="participation-person-search" type="search" value={search} onChange={event=>setSearch(event.target.value)} disabled={unavailable} placeholder="Tên, tuổi hoặc 4 số cuối điện thoại"/>
    <select className="edit-input" aria-label="Person" id="participation-person-select" value={selectedId} onChange={event=>onSelect(event.target.value)} disabled={unavailable} required>
      <option value="">Chọn Person</option>
      {options.map(p=><option key={p.personId} value={p.personId}>{personParticipationLabel(p)}</option>)}
    </select>
    {!people.length?<span role="status">Danh sách Person chưa được kết nối trong M1.</span>:!options.length?<span role="status">Không tìm thấy Person phù hợp.</span>:null}
  </>;
}
