import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const source=readFileSync(resolve(process.cwd(),'app/components/tos-vnext/TosVNextTraining.tsx'),'utf8');

test('PAP-946 training retains V8 progress and certificates navigation',()=>{
 assert.match(source,/type Tab="progress"\|"certificates"/);
 assert.doesNotMatch(source,/Phát triển kỹ năng/);
 assert.match(source,/Giờ đã làm tối thiểu:/);
 assert.match(source,/Chứng Nhận/);
 assert.match(source,/TosVNextBottomNav/);
});

test('PAP-946 training avoids fabricated enrollment and certificate truth',()=>{
 assert.match(source,/tosTrainingV5Api\.registrations\(\)/);
 assert.match(source,/workforceTraining\.self\(\)/);
 assert.match(source,/Chờ tích hợp thao tác đăng ký Core V5/);
 assert.match(source,/<TosVNextButton disabled title="Chờ tích hợp thao tác đăng ký Core V5">Đăng ký<\/TosVNextButton>/);
 assert.match(source,/TRAINING_V5_WRITE_ADMITTED/);
});