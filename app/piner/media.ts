// PAP-1772 · Synthetic owner-bound portfolio examples: two child profiles + adult MyTime contributor.
import type { PinerAppKey } from "./catalog";
import type { ProfileId } from "./profiles";
export type MediaType="photo"|"reel";
export type Visibility="private"|"community";
export type MediaComment={id:string;author:string;body:string;role:"teacher"|"parent"};
export type MediaPost={
 id:string;app:PinerAppKey;ownerId:ProfileId;systemKind?:"news"|"event";type:MediaType;visual:"flower"|"landscape"|"ceramic"|"abstract"|"keys"|"studio"|"music"|"concert";
 title:string;date:string;caption:string;comments:readonly MediaComment[];visibility:Visibility;
 duration?:string;reactions:number;
};
export const POSTS:readonly MediaPost[]=[
 // PAP-1817 · Synthetic dedicated system posts; never attribute child media to PINO Piano.
 {id:"sys-event",app:"piano",ownerId:"pino-piano",systemKind:"event",type:"photo",visual:"concert",title:"PINO Piano · Ngày hội giai điệu",date:"10/11",caption:"Lịch biểu diễn cuối tuần tại PINO House. Cùng đón xem những giai điệu từ các lớp Piano!",comments:[],visibility:"community",reactions:5},
 {id:"sys-news",app:"piano",ownerId:"pino-piano",systemKind:"news",type:"photo",visual:"music",title:"Tin từ PINO Piano",date:"08/11",caption:"Tuần này các bạn sẽ có thêm thử thách nhịp điệu mới trong hành trình học Piano.",comments:[],visibility:"community",reactions:3},
 {id:"a1",app:"hoi-hoa",ownerId:"an",type:"photo",visual:"flower",title:"Vườn hoa ngày nắng",date:"09/11",caption:"Hôm nay con thử phối ba sắc độ hồng trong cùng một bức tranh.",comments:[{"id":"a1-teacher","author":"Cô Trang","body":"Con phối màu có chủ đích hơn và đã tự tin chọn bố cục. Tuần tới mình cùng thử chiều sâu nhé!","role":"teacher"}],visibility:"private",reactions:0},
 {id:"a2",app:"hoi-hoa",ownerId:"an",type:"reel",visual:"abstract",title:"Từ nét đầu tiên đến tác phẩm",date:"06/11",caption:"Một đoạn time-lapse minh họa quá trình sáng tạo.",comments:[{"id":"a2-teacher","author":"Cô Trang","body":"Con đã kiên nhẫn với các lớp màu và chủ động thử kỹ thuật mới.","role":"teacher"},{"id":"a2-parent-1","author":"PH PINO","body":"Thật nhiều màu sắc đẹp!","role":"parent"},{"id":"a2-parent-2","author":"PH PINO","body":"Ý tưởng thú vị quá!","role":"parent"}],visibility:"community",duration:"0:36",reactions:12},
 {id:"a3",app:"hoi-hoa",ownerId:"binh",type:"photo",visual:"landscape",title:"Chiều trên ngọn đồi",date:"02/11",caption:"Bức tranh phong cảnh với đường chân trời và vùng sáng.",comments:[{"id":"a3-teacher","author":"Cô Trang","body":"Con biết chia mảng chính phụ và sử dụng màu ấm lạnh rõ hơn.","role":"teacher"}],visibility:"private",reactions:0},
 {id:"a4",app:"hoi-hoa",ownerId:"binh",type:"photo",visual:"ceramic",title:"Bình hoa màu xanh",date:"28/10",caption:"Một bài thực hành về hình khối và họa tiết.",comments:[{"id":"a4-teacher","author":"Cô Trang","body":"Nét trang trí gọn và nhịp nhàng. Con đã phát triển dấu ấn riêng.","role":"teacher"},{"id":"a4-parent-1","author":"PH PINO","body":"Mình thích họa tiết này!","role":"parent"}],visibility:"community",reactions:9},
 {id:"a5",app:"hoi-hoa",ownerId:"mai",type:"photo",visual:"ceramic",title:"Buổi hẹn acrylic MyTime",date:"25/10",caption:"Một góc workshop acrylic của học viên trưởng thành MyTime.",comments:[{"id":"a5-teacher","author":"Cô Hương","body":"Từng lớp màu được hoàn thiện rất nhẹ nhàng và có cá tính.","role":"teacher"},{"id":"a5-parent-1","author":"Bạn MyTime","body":"Một buổi tối thật đẹp!","role":"parent"}],visibility:"community",reactions:6},
 {id:"p1",app:"piano",ownerId:"an",type:"reel",visual:"concert",title:"Một đoạn nhạc đầu tiên",date:"09/11",caption:"Giai điệu biểu diễn được lưu lại thành kỷ niệm.",comments:[{"id":"p1-teacher","author":"Cô Linh","body":"Con giữ nhịp đều hơn và đã chú ý chuyển động hai tay. Hãy tiếp tục luyện đoạn cuối.","role":"teacher"}],visibility:"private",duration:"0:42",reactions:0},
 {id:"p2",app:"piano",ownerId:"binh",type:"photo",visual:"keys",title:"Góc luyện đàn của con",date:"06/11",caption:"Một khoảnh khắc tập trung với những phím đàn.",comments:[{"id":"p2-teacher","author":"Cô Linh","body":"Tư thế ngồi và vị trí cổ tay tiến bộ rõ so với tháng trước.","role":"teacher"},{"id":"p2-parent-1","author":"PH PINO","body":"Cùng cố gắng nhé!","role":"parent"},{"id":"p2-parent-2","author":"PH PINO","body":"Một kỷ niệm rất đáng yêu.","role":"parent"}],visibility:"community",reactions:14},
 {id:"p3",app:"piano",ownerId:"an",type:"reel",visual:"music",title:"Bản nhạc dưới ánh chiều",date:"02/11",caption:"Trích đoạn luyện đàn trong tuần.",comments:[{"id":"p3-teacher","author":"Cô Linh","body":"Phần chuyển nhịp đang mềm mại hơn; con nhớ nghe kỹ âm cuối.","role":"teacher"},{"id":"p3-parent-1","author":"PH PINO","body":"Nghe dịu dàng quá!","role":"parent"}],visibility:"community",duration:"0:28",reactions:21},
 {id:"p4",app:"piano",ownerId:"binh",type:"photo",visual:"studio",title:"Những nốt nhạc đầu tiên",date:"28/10",caption:"Từng bước nhỏ trong hành trình âm nhạc.",comments:[{"id":"p4-teacher","author":"Cô Linh","body":"Khả năng đọc nốt và tự sửa lỗi đã tốt hơn sau các buổi tập.","role":"teacher"}],visibility:"private",reactions:0},
 {id:"p5",app:"piano",ownerId:"mai",type:"reel",visual:"concert",title:"Giai điệu MyTime cuối tuần",date:"24/10",caption:"Một đoạn Piano được học viên MyTime trưởng thành chọn chia sẻ.",comments:[{"id":"p5-teacher","author":"Cô Hương","body":"Người chơi giữ được sự mềm mại và biểu cảm riêng trong giai điệu.","role":"teacher"},{"id":"p5-parent-1","author":"Bạn MyTime","body":"Nghe ấm áp quá!","role":"parent"}],visibility:"community",duration:"0:31",reactions:7}
];
export const postsFor=(app:PinerAppKey)=>POSTS.filter(p=>p.app===app);

/* PAP-1797 · Fictional carousel frames and actual synthetic MP4 clips for local UX only.
 * Every frame is generated SVG; videos are generated motion graphics, not student footage. */
export const PHOTO_CAROUSELS: Readonly<Record<string,readonly MediaPost["visual"][]>>={
 a1:["flower","ceramic","abstract"],
 a3:["landscape","flower","ceramic"],
 a4:["ceramic","abstract","flower"],
 a5:["ceramic","flower","landscape"],
 p2:["keys","studio","music"],
 p4:["studio","keys","concert"],
};
export const syntheticReelSrc=(post:MediaPost):string=>
 post.app==="piano"?"/piner/media/piano-demo.mp4":"/piner/media/art-demo.mp4";
