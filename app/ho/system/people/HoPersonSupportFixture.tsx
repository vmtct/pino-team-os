"use client";
/** PAP-1523: reusable synthetic presentation only; not a runtime admission or auth mechanism. */
import {BoRegistrationWorkspace,type BoWorkspaceSource} from "@/app/bo/components/registration/BoRegistrationWorkspace";
import {hoModules} from "@/lib/ho-system";
import {TddPreferencePolicy} from "@/app/components/workspace-renderer/Record";
import {HoPersonDirectory,type PersonRow} from "./HoPersonDirectory";
import {HoPersonSupportPreview} from "./HoPersonSupportPreview";
import {createSupportPreviewPerson} from "./person-support-preview";

export function HoPersonSupportFixture(){
  const row:PersonRow=createSupportPreviewPerson();
  return <TddPreferencePolicy.Provider value="ephemeral"><HoPersonDirectory rows={[row]} renderSupportPreview={person=><HoPersonSupportPreview key={person.id} personId={person.id} personName={person.name}/>}/></TddPreferencePolicy.Provider>;
}
const source:BoWorkspaceSource={surface:"ho",readOnly:true,ephemeral:true,modules:hoModules,routeForModule:key=>key==="people"?"/ho/system/people":"#unavailable",scopeLabel:()=>"",load:async()=>{throw Error("No live transport");}};
/** Same isolated shell on local and admitted staging; never consumes the live Person reader. */
export function HoPersonSupportFixtureWorkspace(){
 return <TddPreferencePolicy.Provider value="ephemeral"><BoRegistrationWorkspace source={source} moduleKey="people" currentUser={{displayName:"QA Synthetic"}} content={<HoPersonSupportFixture/>}/></TddPreferencePolicy.Provider>;
}