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
  assert.equal(auditActionLabel('Tạo lớp học'),'Tạo lớp học');
  assert.equal(auditActionLabel('Cập nhật học viên'),'Cập nhật học viên');
  assert.equal(auditActionLabel('registration.status_updated'),'Đổi trạng thái');
  assert.equal(auditActionLabel('student.intake.created'),'Tạo hồ sơ');
  assert.equal(auditActionLabel('UNRECOGNIZED_INTERNAL_CODE'),'Thao tác hồ sơ');
});
for (const action of ['Tạo học viên', 'Cập nhật học viên', 'Tạo lớp học', 'Cập nhật lớp học', 'Cập nhật bản ghi', 'Tạo Subscription', 'Kích hoạt Subscription', 'Thay thế Subscription', 'Hoàn tất Subscription', 'Huỷ Subscription', 'Tạo Mission', 'Cập nhật Mission', 'Giao nhiệm vụ', 'Cập nhật giao nhiệm vụ', 'Hủy giao nhiệm vụ']) {
  test(`history preserves admitted Core action label: ${action}`,()=>{
    assert.equal(auditActionLabel(action),action);
  });
}
test('history rejects unknown and malicious Mission labels and masks machine codes',()=>{
  for (const action of ['Xóa Mission', 'Giao nhiệm vụ khác', 'tạo Mission', 'Tạo Mission ', ' Tạo Mission', 'Tạo Mission<script>alert(1)</script>', '<img src=x onerror=alert(1)>', 'Giao nhiệm vụ\nprivate-actor@example.com', 'MISSION_INTERNAL_SECRET', '']) {
    assert.equal(auditActionLabel(action),'Thao tác hồ sơ');
  }
  assert.equal(auditActionLabel('mission.created'),'Tạo hồ sơ');
  assert.equal(auditActionLabel('mission.updated'),'Cập nhật thông tin');
  assert.equal(auditActionLabel('student_mission_assignment.assigned'),'Cập nhật phân công');
  assert.equal(auditActionLabel('mission.created<script>alert(1)</script>'),'Tạo hồ sơ');
});
test('column default visibility does not remove searchable fields or change BO defaults',()=>{
  const optional: BoField={key:'technical',label:'Internal key',type:'text',icon:'#',w:180,defaultVisible:false};
  const hidden=defaultTable([...fields,optional]);
  assert.deepEqual(hidden.visible,['name','capacity']);
  assert.deepEqual(hidden.order,['name','capacity','technical']);
  assert.deepEqual(defaultTable(fields).visible,['name','capacity']);
});
test('history preserves only exact admitted Mission Core action labels',()=>{
  for (const action of ['Tạo Mission','Cập nhật Mission','Giao nhiệm vụ','Cập nhật giao nhiệm vụ','Hủy giao nhiệm vụ']) {
    assert.equal(auditActionLabel(action),action);
  }
});
test('unknown and raw Mission actions retain localized fallbacks',()=>{
  for (const action of ['', 'UNRECOGNIZED_INTERNAL_CODE', 'Hoàn tất Mission', 'Tạo Mission khác', 'Giao nhiệm vụ: private-student-id']) {
    assert.equal(auditActionLabel(action),'Thao tác hồ sơ');
  }
  for (const action of ['Tạo Mission','Cập nhật Mission','Giao nhiệm vụ','Cập nhật giao nhiệm vụ','Hủy giao nhiệm vụ']) {
    for (const variant of [action.toLowerCase(), ` ${action}`, `${action} `]) {
      assert.equal(auditActionLabel(variant),'Thao tác hồ sơ');
    }
  }
  for (const [action, label] of [
    ['mission.created','Tạo hồ sơ'],
    ['mission.updated','Cập nhật thông tin'],
    ['mission.assignment.created','Tạo hồ sơ'],
    ['mission.assignment.updated','Cập nhật thông tin'],
    ['mission.assignment.cancelled','Cập nhật phân công'],
  ]) {
    assert.equal(auditActionLabel(action),label);
  }
});
