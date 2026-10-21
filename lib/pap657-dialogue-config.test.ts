import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDialogueConfig} from './pap657-dialogue-config';
const good={revision:1,durationMs:5000,proximityPx:90,maxTvBubbles:3,maxZoneBubbles:1,pool:[['Xin chào','Chào bạn']]};
test('valid published dialogue config is copied',()=>{const parsed=parseDialogueConfig(good);assert.equal(parsed?.revision,1);assert.equal(parsed?.pool.length,1);assert.notEqual(parsed?.pool,good.pool);});
test('reject invalid caps, injected text, duration and malformed pools',()=>{
 for(const candidate of [{...good,maxTvBubbles:4},{...good,maxZoneBubbles:2},{...good,durationMs:30000},{...good,revision:0},{...good,pool:[['<script>','B']]},{...good,pool:[['only one']]},{...good,proximityPx:-1}])assert.equal(parseDialogueConfig(candidate),null);
});
