/* PAP-879: synthetic UI-only module configuration; never a Core/domain adapter. */
(function(root) {
  'use strict';
  const identity = label => [{key:'name',label,type:'text',icon:'Aa',w:235},{key:'id',label:'ID',type:'id',icon:'#',w:145,readonly:true}];
  const status = {key:'status',label:'Trạng thái',type:'select',icon:'▣',w:135,options:['Đang học','Cần xử lý','Hoàn thành']};
  const students = ['Bảo Trân','An Nhiên','Nguyễn Phúc Minh','Lâm Xuân Thảo','Vương Quỳnh Chi','Trần Quốc Thái','Di Băng','Phạm Quốc Toàn'];
  const programs = ['Artchitect','PianoHouse','Little Piner Art','Little Piner Piano','Chroma Sea','Pinoria CAMP'];
  const classes = ['Artchitect · Mon Studio','PianoHouse · Wed','Little Piner Art · Fri','Artchitect · Sat Workshop','PianoHouse · Tue Studio'];
  const adapters = {
    students: {key:'students',label:'Học viên',group:'SCHOOL',fields:[...identity('Học viên'),status,
      {key:'program',label:'Path',type:'relation',icon:'↗',options:programs,w:172},
      {key:'age',label:'Tuổi',type:'number',icon:'#',w:113},
      {key:'sessions',label:'Buổi còn lại',type:'number',icon:'#',w:145}],
      rows:students.map((name,i)=>({name,id:'PINO-STU-'+String(i+1).padStart(4,'0'),status:status.options[i%3],program:programs[i%programs.length],age:5+i,sessions:3*(i+1),approved:i%3===0}))},
    classes: {key:'classes',label:'Classes',group:'SCHOOL',fields:[...identity('Running Class'),
      {key:'program',label:'Chương trình',type:'relation',icon:'↗',options:programs,w:172},
      {key:'schedule',label:'Lịch',type:'text',icon:'◷',w:182},
      {key:'capacity',label:'Sức chứa',type:'number',icon:'#',w:113},
      {key:'teacher',label:'Giáo viên',type:'person',icon:'♙',options:['Hằng Nguyễn','Vy Trần','Trang Lê'],w:162},status],
      rows:classes.map((name,i)=>({name,id:'PINO-CLA-'+String(i+1).padStart(4,'0'),program:programs[i%programs.length],schedule:['Thứ 2 · 18:00','Thứ 4 · 18:00','Thứ 6 · 18:00'][i%3],capacity:8+i,teacher:['Hằng Nguyễn','Vy Trần','Trang Lê'][i%3],status:status.options[i%3],approved:i%3===0}))}
  };
  root.PinoBOPilotAdapters = Object.freeze(adapters);
  if(typeof module==='object'&&module.exports)module.exports=adapters;
})(typeof globalThis==='object'?globalThis:this);
