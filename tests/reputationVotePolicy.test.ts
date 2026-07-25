import assert from 'node:assert/strict';
import test from 'node:test';
import {
  reputationVoteBlockReason,
  reputationVoteChannel,
  reputationVoteIdentityKind,
} from '../api/reputationVotePolicy.js';

test('口碑票只接受已验证手机号或微信 UnionID', () => {
  assert.equal(reputationVoteIdentityKind({ phone: '15800000000', phone_verified_at: '2026-07-26T00:00:00Z' }), 'phone');
  assert.equal(reputationVoteIdentityKind({ wechat_unionid: 'union-id' }), 'wechat_unionid');
  assert.equal(reputationVoteIdentityKind({ phone: '15800000000', phone_verified_at: null }), null);
  assert.match(reputationVoteBlockReason({ phone: null, phone_verified_at: null, wechat_unionid: null }), /验证手机号/);
  assert.equal(reputationVoteBlockReason({ wechat_unionid: 'union-id' }), '');
});

test('同意反对共用立场通道，欢乐使用独立通道', () => {
  assert.equal(reputationVoteChannel('like'), 'stance');
  assert.equal(reputationVoteChannel('dislike'), 'stance');
  assert.equal(reputationVoteChannel('joy'), 'joy');
});
