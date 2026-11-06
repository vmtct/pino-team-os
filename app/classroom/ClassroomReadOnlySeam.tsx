"use client";
import {useState} from "react";
import {TosShell} from "../components/tos-shell/TosShell";
import {TosVNextClassroom} from "../components/tos-vnext/TosVNextClassroom";

/** PAP-945: independent classroom mount; no six-app workstation or Diary writer. */
export default function ClassroomReadOnlySeam({centerId,localDate}:{centerId:string;localDate:string}){
 const [,setDetailOpen]=useState(false);
 return <TosShell title="Lớp học" theme="classroom" footerItems={[]}>
  <TosVNextClassroom centerId={centerId} localDate={localDate} onDetailChange={setDetailOpen} readOnly/>
 </TosShell>;
}
