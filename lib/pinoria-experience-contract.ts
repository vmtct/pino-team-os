export type PinoriaExperienceStageId=
  |"quick-choice"
  |"session"
  |"rewards"
  |"companion"
  |"ritual"
  |"ambient-house";

export const PINORIA_EXPERIENCE_STAGES:ReadonlyArray<{id:PinoriaExperienceStageId;label:string;eyebrow:string}>=[
  {id:"quick-choice",label:"Quick Choice",eyebrow:"CHỌN NHANH"},
  {id:"session",label:"Session",eyebrow:"BUỔI HÔM NAY"},
  {id:"rewards",label:"Rewards",eyebrow:"ĐIỀU MÌNH NHẬN ĐƯỢC"},
  {id:"companion",label:"Companion",eyebrow:"BẠN ĐỒNG HÀNH"},
  {id:"ritual",label:"Ritual",eyebrow:"NGHI THỨC"},
  {id:"ambient-house",label:"Ambient House",eyebrow:"PINO HOUSE"},
]as const;

export type PresentationTag="fixture"|"projection";

export interface PinoriaExperienceScene{
  learner:{id:string;displayName:string;avatarText:string};
  arrival:{state:"arrived";note:string};
  quickChoice:{prompt:string;options:Array<{id:string;title:string;note:string}>};
  session:{title:string;focus:string;facilitatorCue:string};
  rewards:{headline:string;items:Array<{id:string;label:string;note:string;tag:PresentationTag}>};
  companion:{name:string;mood:string;message:string;tag:PresentationTag};
  ritual:{title:string;prompt:string;reveal:string;tag:PresentationTag};
  ambientHouse:{headline:string;weather:string;presenceNote:string;tag:PresentationTag};
}

export type PinoriaExperienceLoadResult=
  |{state:"ready";scene:PinoriaExperienceScene;source:"fixture"|"core-projection"}
  |{state:"unavailable";reason:string};

/**
 * Presentation boundary only. A future Core adapter may project canonical facts
 * into this shape, but this layer must never create Visit, Attendance,
 * Participation, reward-ledger, companion, ritual-inventory or world-state truth.
 */
export interface PinoriaExperienceSource{load():Promise<PinoriaExperienceLoadResult>}

export const PINORIA_EXPERIENCE_FIXTURE:PinoriaExperienceScene={
  learner:{id:"fixture-learner-an",displayName:"An",avatarText:"A"},
  arrival:{state:"arrived",note:"Arrival đã xảy ra trước experience flow; màn này không tạo hoặc replay Visit."},
  quickChoice:{
    prompt:"An muốn bắt đầu buổi hôm nay theo cách nào?",
    options:[
      {id:"continue",title:"Tiếp tục điều đang làm",note:"Quay lại focus gần nhất."},
      {id:"new",title:"Thử một điều mới",note:"Một gợi ý khác trong House."},
      {id:"wander",title:"Chỉ khám phá House",note:"Không cần tạo thêm learning truth."},
    ],
  },
  session:{
    title:"Piano House · buổi sáng tạo",
    focus:"Giữ nhịp đều khi phối hợp hai tay",
    facilitatorCue:"Presentation cue cho staff; Attendance/Participation vẫn thuộc Core và không được suy ra từ màn này.",
  },
  rewards:{
    headline:"Một chút năng lượng mang về",
    items:[
      {id:"energy",label:"Energy +10",note:"Minh hoạ presentation; chưa nối ledger.",tag:"fixture"},
      {id:"seed",label:"1 Seed",note:"Minh hoạ presentation; không phải số dư canonical.",tag:"fixture"},
    ],
  },
  companion:{name:"Mori",mood:"Tò mò",message:"Mori nhớ khoảnh khắc An vừa kiên trì thêm một chút.",tag:"fixture"},
  ritual:{title:"Khép lại buổi hôm nay",prompt:"An muốn giữ lại điều gì?",reveal:"Một dấu sáng mới xuất hiện trong House.",tag:"fixture"},
  ambientHouse:{headline:"House đang dịu lại",weather:"Ánh chiều · yên tĩnh",presenceNote:"World state chỉ là scene trình bày; không phải event/state ledger.",tag:"fixture"},
};

export const fixturePinoriaExperienceSource:PinoriaExperienceSource={
  async load(){return{state:"ready",scene:PINORIA_EXPERIENCE_FIXTURE,source:"fixture"};},
};
