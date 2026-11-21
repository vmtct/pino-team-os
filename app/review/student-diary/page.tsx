"use client";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import "@/public/bo-authority-source/bo-scoped.css";
import {useContext,useEffect} from "react";
import {BoRegistrationWorkspace,type BoWorkspaceSource} from "@/app/bo/components/registration/BoRegistrationWorkspace";
import {BoFullDetail} from "@/app/bo/components/registration/BoFullDetail";
import {TddHostMenu} from "@/app/components/workspace-adapters/SurfaceWorkspace";
import type {BoRecord} from "@/lib/bo-registration";
import school from "@/public/bo-authority-source/school-adapters.js";

const source:BoWorkspaceSource={...school,ephemeral:true,readOnly:true,scopeLabel:()=>"",load:async()=>[]};
const student:BoRecord={id:"qa-student",name:"Học viên QA",paths:"Piano",birthYear:null,status:"Đang học",houseMember:null};

function ReviewContent(){
  const menu=useContext(TddHostMenu);
  return <BoFullDetail
    module={school.modules.students} moduleKey="students" record={student}
    onBack={()=>window.location.assign("/bo?module=students")}
    mobileMenu={menu("student-detail-menu")} reviewOnly initialTab="Diary"
  />;
}

export default function Preview(){
  useEffect(()=>{
    document.documentElement.dataset.boUiAuthority="v25";
    return()=>{delete document.documentElement.dataset.boUiAuthority;};
  },[]);
  return <>
    <link rel="stylesheet" href="/bo-legacy-foundation.css" />
    <BoRegistrationWorkspace source={source} currentUser={{displayName:"PINO QA"}} moduleKey="students" content={<ReviewContent/>} />
  </>;
}
