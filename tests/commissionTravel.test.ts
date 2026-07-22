import assert from 'node:assert/strict';
import test from 'node:test';
import { canApplyToCommission, commissionCityMatch } from '../api/commissionTravel.js';

test('matches local profiles before expedition profiles', () => {
  assert.equal(commissionCityMatch({ city: '保定', available_cities: ['北京'] }, '保定'), 'local');
  assert.equal(commissionCityMatch({ city: '北京', available_cities: ['保定'] }, '保定'), 'expedition');
  assert.equal(commissionCityMatch({ city: '北京', available_cities: ['上海'] }, '保定'), null);
});

test('local applicants can apply whether or not expedition is accepted', () => {
  assert.equal(canApplyToCommission({ city: '保定' }, { city: '保定', accept_expedition: false }), true);
});

test('remote applicants need both poster consent and declared service city', () => {
  const remoteProfile = { city: '北京', available_cities: ['保定'] };
  assert.equal(canApplyToCommission(remoteProfile, { city: '保定', accept_expedition: false }), false);
  assert.equal(canApplyToCommission(remoteProfile, { city: '保定', accept_expedition: true }), true);
  assert.equal(canApplyToCommission({ city: '北京', available_cities: ['上海'] }, { city: '保定', accept_expedition: true }), false);
});

test('legacy commissions without a city remain applicable', () => {
  assert.equal(canApplyToCommission({ city: '北京' }, { city: null, accept_expedition: false }), true);
});
