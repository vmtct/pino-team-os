"use client";
/** PAP-1523: reusable synthetic presentation only; not a runtime admission or auth mechanism. */
import {TddPreferencePolicy} from "@/app/components/workspace-renderer/Record";
import {HoPersonDirectory,type PersonRow} from "./HoPersonDirectory";
import {HoPersonSupportPreview} from "./HoPersonSupportPreview";
import {createSupportPreviewPerson} from "./person-support-preview";

export function HoPersonSupportFixture(){
  const row:PersonRow=createSupportPreviewPerson();
  return <TddPreferencePolicy.Provider value="ephemeral"><HoPersonDirectory rows={[row]} renderSupportPreview={person=><HoPersonSupportPreview key={person.id} personId={person.id} personName={person.name}/>}/></TddPreferencePolicy.Provider>;
}