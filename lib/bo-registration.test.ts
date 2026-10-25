import test from "node:test";
import assert from "node:assert/strict";
import { auditActionLabel, defaultTable, editorPosition, tableRows, type BoField, type BoRecord } from "./bo-registration";
const fields: BoField[] = [{key:'name',label:'Tên',type:'text',icon:'Aa',w:235},{key:'capacity',label:'Sức chứa',type:'number',icon:'#',w:113}];
const rows: BoRecord[] = [{id:'a',name:'Lớp Nhạc',capacity:12},{id:'b',name:'Lớp Vẽ',capacity:3},{id:'c',name:'Workshop',capacity:null}];
test('Vietnamese search, typed range, OR and numeric sort retain canonical records',()=>{
  const initial=defaultTable(fields);
  assert.deepEqual(tableRows(rows,fields,{...initial,search:'nhac'}).map(r=>r.id),['a']);
  const rule={field:'capacity',op:'between',value:'2',second:'10'};
  assert.deepEqual(tableRows(rows,fields,{...initial,rules:[rule]}).map(r=>r.id),['b']);
  assert.deepEqual(tableRows(rows,fields,{...initial,rules:[rule,{field:'name',op:'eq',value:'Workshop',second:''}],logic:'OR'}).map(r=>r.id),['b','c']);
  assert.deepEqual(tableRows(rows,fields,{...initial,sort:'capacity',desc:true}).map(r=>r.id),['a','b','c']);
  assert.equal(rows[0].capacity,12);
});
test('unknown field fails closed and empty numeric values never match a range',()=>{
  const rule={field:'missing',op:'eq',value:'x',second:''};
  assert.deepEqual(tableRows(rows,fields,{...defaultTable(fields),rules:[rule]}),[]);
  assert.deepEqual(tableRows(rows,fields,{...defaultTable(fields),rules:[{...rule,field:'capacity',op:'gte',value:'0'}]}).map(r=>r.id),['a','b']);
});
test('typed editor stays over anchor and clamps against each edge',()=>{
  assert.deepEqual(editorPosition({left:130,top:120},{width:288,height:180},{width:1440,height:1000}),{left:130,top:120,maxHeight:984});
  assert.deepEqual(editorPosition({left:350,top:950},{width:288,height:180},{width:390,height:1000}),{left:94,top:812,maxHeight:984});
});
test('history action labels are Vietnamese and never reveal raw event codes',()=>{
  assert.equal(auditActionLabel('registration.status_updated'),'Đổi trạng thái');
  assert.equal(auditActionLabel('student.intake.created'),'Tạo hồ sơ');
  assert.equal(auditActionLabel('UNRECOGNIZED_INTERNAL_CODE'),'Thao tác hồ sơ');
});
