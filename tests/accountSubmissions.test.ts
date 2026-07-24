import assert from 'node:assert/strict';
import test from 'node:test';
import {
  firstPublicImage,
  normalizeSubmissionState,
  sortAccountSubmissions,
  summarizeAccountSubmissions,
} from '../api/accountSubmissions.js';

test('normalizes review statuses into four user-facing states', () => {
  assert.equal(normalizeSubmissionState('pending_owner'), 'pending');
  assert.equal(normalizeSubmissionState('needs_submission'), 'action');
  assert.equal(normalizeSubmissionState('resolved'), 'approved');
  assert.equal(normalizeSubmissionState('withdrawn'), 'closed');
});

test('summarizes and sorts mixed submission records', () => {
  const items = sortAccountSubmissions([
    { created_at: '2026-07-20T00:00:00Z', updated_at: null, state: 'approved' as const },
    { created_at: '2026-07-19T00:00:00Z', updated_at: '2026-07-21T00:00:00Z', state: 'action' as const },
    { created_at: '2026-07-18T00:00:00Z', updated_at: null, state: 'pending' as const },
  ]);

  assert.equal(items[0].state, 'action');
  assert.deepEqual(summarizeAccountSubmissions(items), {
    total: 3,
    pending: 1,
    approved: 1,
    action_required: 1,
    closed: 0,
  });
});

test('extracts the first real public image from nested file metadata', () => {
  assert.equal(firstPublicImage([], [{ name: '照片', url: '/uploads/example.jpg' }]), '/uploads/example.jpg');
  assert.equal(firstPublicImage({ files: [{ image_url: 'https://cdn.example.com/a.jpg' }] }), 'https://cdn.example.com/a.jpg');
  assert.equal(firstPublicImage({ url: 'javascript:alert(1)' }), null);
});
