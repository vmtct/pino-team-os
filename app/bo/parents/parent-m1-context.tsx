"use client";
/** PAP-2387 / SCH-PARENTS-GUARDIANS: explicit isolated presentation only. */
import {createContext,useContext,useState,type ReactNode} from "react";
import {createParentFixture,PARENT_MOCK_SEED} from "./parent-m1-fixture";
type Fixture=ReturnType<typeof createParentFixture>;
const Context=createContext<Fixture|null>(null);
const Grants=createContext<ReadonlySet<string>|null>(null);
const localGrants=new Set(["identity.parent.create","identity.parent.edit"]);
export function ParentM1Provider({children}:{children:ReactNode}){
  const [fixture]=useState(createParentFixture);
  const q=new URLSearchParams(location.search);
  if(self.origin!=="null"||location.pathname!=="/bo/parents"||!["http://desktop-isrdren:8800","http://desktop-isrdren.tail3ee007.ts.net:8800"].includes(location.origin)||[...q.keys()].some(k=>k!=="record")||q.getAll("record").length>1||(q.has("record")&&q.get("record")!==PARENT_MOCK_SEED))throw Error("Local Parent review only");
  return <Context.Provider value={fixture}><Grants.Provider value={localGrants}>{children}</Grants.Provider></Context.Provider>;
}
export const useParentM1=()=>useContext(Context);
export const useParentM1Grants=()=>useContext(Grants);
