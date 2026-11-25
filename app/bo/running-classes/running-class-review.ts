/** PLT-DELIVERY / PAP-1037 / PAP-2225: isolated in-memory M1 command boundary. */
import type {BoRecord} from "@/lib/bo-registration";
import {initialClassDraft,type ClassCatalog,type ClassCreate} from "./running-class-draft";
import {projectClassRow,projectClassProperties,validateClassEdit,RUNNING_CLASS_MOCK_ID,type ClassRecord,type ClassEditCommand} from "./running-class-presentation";
export type RunningClassReview = {
  catalog: ClassCatalog;
  selectedCenterId: string;
  centerToday: string;
  fixtureId: string;
  list: () => BoRecord[];
  find: (id:string) => ClassRecord | undefined;
  properties: (id:string) => BoRecord;
  create: (command:ClassCreate) => BoRecord;
  edit: (command:ClassEditCommand) => BoRecord;
};
export function createRunningClassReview():RunningClassReview {
  const centerId="RC-MOCK-CENTER";
  const catalog:ClassCatalog={
    centers:[{id:centerId,displayName:"Cần Thơ · Mẫu",status:"ACTIVE"}],
    paths:[{id:"RC-MOCK-PATH",displayName:"Piano Nghệ Thuật",status:"ACTIVE"},{id:"RC-MOCK-PATH-ART",displayName:"Mỹ thuật sáng tạo",status:"ACTIVE"}],
    spaces:[{id:"RC-MOCK-ROOM",centerId,displayName:"Piano Studio",status:"ACTIVE"},{id:"RC-MOCK-ROOM-ART",centerId,displayName:"Art Studio",status:"ACTIVE"}]
  };
  const seed:ClassRecord={...initialClassDraft(centerId),id:RUNNING_CLASS_MOCK_ID,version:1,status:"INACTIVE",
    operationalName:"Piano · Thứ hai",pathProgramId:"RC-MOCK-PATH",learningSpaceId:"RC-MOCK-ROOM",weekdayIso:1,
    windowStartsLocal:"18:00",windowEndsLocal:"19:30",optimalConcurrentCapacity:8,hardConcurrentCapacity:10};
  const records=new Map<string,ClassRecord>([[seed.id,seed]]);
  let next=2;
  const find=(id:string)=>records.get(id);
  const mustFind=(id:string)=>{const record=find(id);if(!record)throw Error("Không tìm thấy lớp mẫu.");return record;};
  return {catalog,selectedCenterId:centerId,centerToday:new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Ho_Chi_Minh"}).format(new Date()),fixtureId:seed.id,
    list:()=>[...records.values()].map(r=>projectClassRow(r,catalog)),find,
    properties:id=>projectClassProperties(mustFind(id),catalog),
    create(command){const id="RUNNING-CLASS-MOCK-"+String(next++).padStart(3,"0");
      const record:ClassRecord={...command,id,version:1,status:"INACTIVE"};records.set(id,record);return projectClassRow(record,catalog);},
    edit(command){const current=mustFind(command.id);if(current.version!==command.expectedVersion)throw Error("Lớp mẫu đã thay đổi. Mở lại chi tiết.");
      const result=validateClassEdit(current,{...current,...command.changes},catalog);if(!result.ok)throw Error(result.message);
      const record:ClassRecord={...current,...result.command.changes,version:current.version+1};records.set(record.id,record);return projectClassRow(record,catalog);}
  };
}
