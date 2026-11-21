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
  return <div className="space-y-2">
    <label htmlFor="participation-person-search">Tìm Person</label>
    <input id="participation-person-search" type="search" value={search} onChange={event=>setSearch(event.target.value)} disabled={disabled} placeholder="Tên, tuổi hoặc 4 số cuối điện thoại"/>
    <label htmlFor="participation-person-select">Person</label>
    <select id="participation-person-select" value={selectedId} onChange={event=>onSelect(event.target.value)} disabled={disabled} required>
      <option value="">Chọn Person</option>
      {options.map(p=><option key={p.personId} value={p.personId}>{personParticipationLabel(p)}</option>)}
    </select>
    {!options.length ? <p role="status">Không tìm thấy Person phù hợp.</p> : null}
  </div>;
}
