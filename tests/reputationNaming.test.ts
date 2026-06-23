import assert from 'node:assert/strict';
import test from 'node:test';
import { cityReputationTitle } from '../src/lib/reputationNaming.js';

test('formats city reputation titles around concrete city names', () => {
  assert.equal(cityReputationTitle('北京'), '北京口碑');
  assert.equal(cityReputationTitle('上海'), '上海口碑');
  assert.equal(cityReputationTitle('保定'), '保定口碑');
});

test('falls back to generic city reputation title for collection states', () => {
  assert.equal(cityReputationTitle(''), '城市口碑');
  assert.equal(cityReputationTitle(null), '城市口碑');
  assert.equal(cityReputationTitle('all'), '城市口碑');
  assert.equal(cityReputationTitle('preferred'), '城市口碑');
  assert.equal(cityReputationTitle('全部城市'), '城市口碑');
  assert.equal(cityReputationTitle('我的城市'), '城市口碑');
});
