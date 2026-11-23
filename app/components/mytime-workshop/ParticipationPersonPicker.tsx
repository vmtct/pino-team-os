"use client";
/** PAP-2242 M1. Host supplies canonical Person candidates; local review may pass explicit preview-only fixtures. */
import {useMemo,useState,type KeyboardEvent as ReactKeyboardEvent} from "react";

import {availableParticipationPeople,personParticipationLabel,type ParticipationPersonOption} from "./ParticipationPersonOptions";
export {availableParticipationPeople,personParticipationLabel};
export type {ParticipationPersonOption};

export function ParticipationPersonPicker({people,participantPersonIds=[],selectedId,onSelect,disabled=false,required=false}:{
  people: readonly ParticipationPersonOption[];
  participantPersonIds?: readonly string[];
  selectedId: string;
  onSelect: (personId:string)=>void;
  disabled?: boolean;
  required?: boolean;
}) {
  const [search,setSearch]=useState("");
  const [open,setOpen]=useState(false);
  const [active,setActive]=useState(0);
  const options=useMemo(
    ()=>availableParticipationPeople(people,participantPersonIds,search),
    [people,participantPersonIds,search],
  );
  const allEligible=useMemo(
    ()=>availableParticipationPeople(people,participantPersonIds),
    [people,participantPersonIds],
  );
  const selected=people.find(person=>person.personId===selectedId)??null;
  const unavailable=disabled||people.length===0;

  function choose(person:ParticipationPersonOption) {
    onSelect(person.personId);
    setSearch("");
    setActive(0);
    setOpen(false);
  }
  function handleKeyDown(event:ReactKeyboardEvent<HTMLInputElement>) {
    if(event.key==="ArrowDown") {
      event.preventDefault();
      if(!open) {setOpen(true);setActive(0);}
      else setActive(index=>Math.min(index+1,Math.max(0,options.length-1)));
    } else if(event.key==="ArrowUp") {
      event.preventDefault();
      if(!open) {setOpen(true);setActive(Math.max(0,options.length-1));}
      else setActive(index=>Math.max(0,index-1));
    } else if(event.key==="Enter"&&open&&options[active]) {
      event.preventDefault();
      choose(options[active]);
    } else if(event.key==="Escape") {
      if(open) {
        event.preventDefault();
        event.stopPropagation();
        event.nativeEvent.stopImmediatePropagation();
      }
      setOpen(false);
    }
  }

  return <div className="grid w-full min-w-0 gap-1" onBlur={event=>{
    const target=event.relatedTarget;
    if(!(target instanceof Node)||!event.currentTarget.contains(target))setOpen(false);
  }}>
    <input
      id="participation-person-search"
      className="edit-input"
      aria-label="Person"
      aria-required={required||undefined}
      aria-invalid={Boolean(required&&search&&!selectedId)||undefined}
      role="combobox"
      aria-autocomplete="list"
      aria-expanded={open&&!unavailable}
      aria-controls="participation-person-options"
      aria-activedescendant={open&&options[active]?"participation-person-option-"+active:undefined}
      type="search"
      autoComplete="off"
      value={search||(selected?personParticipationLabel(selected):"")}
      onChange={event=>{
        setSearch(event.target.value);
        if(selectedId)onSelect("");
        setActive(0);
        setOpen(true);
      }}
      onFocus={()=>{if(!unavailable)setOpen(true);}}
      onClick={()=>{if(!unavailable)setOpen(true);}}
      onKeyDown={handleKeyDown}
      disabled={unavailable}
      placeholder="Nhập để tìm kiếm người"
    />
    {people.length===0?<span role="status">Danh sách Person chưa được kết nối trong M1.</span>:null}
    {open&&!unavailable?<div className="grid max-h-60 w-full min-w-0 gap-1 overflow-y-auto" id="participation-person-options" role="listbox" aria-label="Person chưa tham gia Workshop">
      {options.length?options.map((person,index)=><button
        key={person.personId}
        id={"participation-person-option-"+index}
        className="secondary-btn w-full min-w-0 justify-start text-left"
        type="button"
        role="option"
        tabIndex={-1}
        aria-selected={person.personId===selectedId}
        data-active={index===active||undefined}
        onMouseDown={event=>event.preventDefault()}
        onMouseEnter={()=>setActive(index)}
        onClick={()=>choose(person)}
      >{personParticipationLabel(person)}</button>):<p role="status">
        {allEligible.length===0?"Không còn Person mới cho Workshop này.":"Không tìm thấy Person phù hợp."}
      </p>}
    </div>:null}
  </div>;
}
