// PAP-1772 · Synthetic owner-bound portfolio examples: two child profiles + adult MyTime contributor.
import type { PinerAppKey } from "./catalog";
import type { ProfileId } from "./profiles";
export type MediaType="photo"|"reel";
export type Visibility="private"|"community";
export type MediaPost={
 id:string;app:PinerAppKey;ownerId:ProfileId;type:MediaType;visual:"flower"|"landscape"|"ceramic"|"abstract"|"keys"|"studio"|"music"|"concert";
 title:string;date:string;caption:string;teacher:string;comment:string;visibility:Visibility;
 duration?:string;reactions:number;responses:readonly string[];
};
export const POSTS:readonly MediaPost[]=[
 {id:"a1",app:"hoi-hoa",ownerId:"an",type:"photo",visual:"flower",title:"Vườn hoa ngày nắng",date:"09/11",caption:"Hôm nay con thử phối ba sắc độ hồng trong cùng một bức tranh.",teacher:"Nhận xét giáo viên Mỹ thuật",comment:"Con phối màu có chủ đích hơn và đã tự tin chọn bố cục. Tuần tới mình cùng thử chiều sâu nhé!",visibility:"private",reactions:0,responses:[]},
 {id:"a2",app:"hoi-hoa",ownerId:"an",type:"reel",visual:"abstract",title:"Từ nét đầu tiên đến tác phẩm",date:"06/11",caption:"Một đoạn time-lapse minh họa quá trình sáng tạo.",teacher:"Nhận xét giáo viên Mỹ thuật",comment:"Con đã kiên nhẫn với các lớp màu và chủ động thử kỹ thuật mới.",visibility:"community",duration:"0:36",reactions:12,responses:["PH PINO · Thật nhiều màu sắc đẹp!","PH PINO · Ý tưởng thú vị quá!"]},
 {id:"a3",app:"hoi-hoa",ownerId:"binh",type:"photo",visual:"landscape",title:"Chiều trên ngọn đồi",date:"02/11",caption:"Bức tranh phong cảnh với đường chân trời và vùng sáng.",teacher:"Nhận xét giáo viên Mỹ thuật",comment:"Con biết chia mảng chính phụ và sử dụng màu ấm lạnh rõ hơn.",visibility:"private",reactions:0,responses:[]},
 {id:"a4",app:"hoi-hoa",ownerId:"binh",type:"photo",visual:"ceramic",title:"Bình hoa màu xanh",date:"28/10",caption:"Một bài thực hành về hình khối và họa tiết.",teacher:"Nhận xét giáo viên Mỹ thuật",comment:"Nét trang trí gọn và nhịp nhàng. Con đã phát triển dấu ấn riêng.",visibility:"community",reactions:9,responses:["PH PINO · Mình thích họa tiết này!"]},
 {id:"a5",app:"hoi-hoa",ownerId:"mai",type:"photo",visual:"ceramic",title:"Buổi hẹn acrylic MyTime",date:"25/10",caption:"Một góc workshop acrylic của học viên trưởng thành MyTime.",teacher:"Nhận xét hướng dẫn viên MyTime",comment:"Từng lớp màu được hoàn thiện rất nhẹ nhàng và có cá tính.",visibility:"community",reactions:6,responses:["PH PINO · Một buổi tối thật đẹp!"]},
 {id:"p1",app:"piano",ownerId:"an",type:"reel",visual:"concert",title:"Một đoạn nhạc đầu tiên",date:"09/11",caption:"Giai điệu biểu diễn được lưu lại thành kỷ niệm.",teacher:"Nhận xét giáo viên Piano",comment:"Con giữ nhịp đều hơn và đã chú ý chuyển động hai tay. Hãy tiếp tục luyện đoạn cuối.",visibility:"private",duration:"0:42",reactions:0,responses:[]},
 {id:"p2",app:"piano",ownerId:"binh",type:"photo",visual:"keys",title:"Góc luyện đàn của con",date:"06/11",caption:"Một khoảnh khắc tập trung với những phím đàn.",teacher:"Nhận xét giáo viên Piano",comment:"Tư thế ngồi và vị trí cổ tay tiến bộ rõ so với tháng trước.",visibility:"community",reactions:14,responses:["PH PINO · Cùng cố gắng nhé!","PH PINO · Một kỷ niệm rất đáng yêu."]},
 {id:"p3",app:"piano",ownerId:"an",type:"reel",visual:"music",title:"Bản nhạc dưới ánh chiều",date:"02/11",caption:"Trích đoạn luyện đàn trong tuần.",teacher:"Nhận xét giáo viên Piano",comment:"Phần chuyển nhịp đang mềm mại hơn; con nhớ nghe kỹ âm cuối.",visibility:"community",duration:"0:28",reactions:21,responses:["PH PINO · Nghe dịu dàng quá!"]},
 {id:"p4",app:"piano",ownerId:"binh",type:"photo",visual:"studio",title:"Những nốt nhạc đầu tiên",date:"28/10",caption:"Từng bước nhỏ trong hành trình âm nhạc.",teacher:"Nhận xét giáo viên Piano",comment:"Khả năng đọc nốt và tự sửa lỗi đã tốt hơn sau các buổi tập.",visibility:"private",reactions:0,responses:[]},
 {id:"p5",app:"piano",ownerId:"mai",type:"reel",visual:"concert",title:"Giai điệu MyTime cuối tuần",date:"24/10",caption:"Một đoạn Piano được học viên MyTime trưởng thành chọn chia sẻ.",teacher:"Nhận xét giáo viên MyTime Piano",comment:"Người chơi giữ được sự mềm mại và biểu cảm riêng trong giai điệu.",visibility:"community",duration:"0:31",reactions:7,responses:["PH PINO · Nghe ấm áp quá!"]}
];
export const postsFor=(app:PinerAppKey)=>POSTS.filter(p=>p.app===app);
