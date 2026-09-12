import test from 'node:test';
import assert from 'node:assert/strict';
import { demoDossiers, demoEvents, filterDossiers } from '../src/communityDemo.ts';

test('encyclopedia has independent people, stores, scripts and roles', () => {
  assert.deepEqual(new Set(demoDossiers.map(item=>item.kind)),new Set(['DM','店家','剧本','角色']));
  assert.equal(demoDossiers.filter(item=>item.provider).length,2);
  assert.equal(demoDossiers.find(item=>item.kind==='店家').provider,undefined);
});
test('all directory relationships and event links resolve', () => {
  const ids=new Set(demoDossiers.map(item=>item.id));
  assert.equal(ids.size,demoDossiers.length);
  for (const item of demoDossiers) for (const related of item.related) assert.ok(ids.has(related));
  for (const event of demoEvents) if(event.dossier) assert.ok(ids.has(event.dossier));
});
test('search trims input and intersects the chosen category', () => {
  assert.equal(filterDossiers('  林川  ','DM')[0].id,'lin');
  assert.equal(filterDossiers('林川','店家').length,0);
  assert.equal(filterDossiers('西安','全部').length,3);
  assert.equal(filterDossiers('不存在的档案','全部').length,0);
  assert.equal(filterDossiers('','全部').length,5);
});
test('reputation is an independent red black white event stream with responses', () => {
  assert.deepEqual(new Set(demoEvents.map(item=>item.kind)),new Set(['红榜','黑榜','白榜']));
  for(const event of demoEvents) {
    assert.ok(event.summary.includes('虚构'));
    assert.ok(event.response.length>0);
    assert.equal('priceFen' in event,false);
    assert.equal('deposit' in event,false);
  }
  assert.ok(demoEvents.find(item=>item.kind==='黑榜').subject.includes('虚构对象'));
});
