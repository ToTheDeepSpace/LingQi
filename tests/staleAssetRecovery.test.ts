import assert from 'node:assert/strict';
import test from 'node:test';
import { isStaleAssetError } from '../src/lib/staleAssetRecovery.js';

test('recognizes stale deployment chunk errors', () => {
  assert.equal(isStaleAssetError(new Error('Failed to fetch dynamically imported module: /assets/OldPage.js')), true);
  assert.equal(isStaleAssetError(new Error('ChunkLoadError: Loading chunk 42 failed')), true);
  assert.equal(isStaleAssetError(new Error('Unable to preload CSS for /assets/OldPage.css')), true);
});

test('does not reload for ordinary application errors', () => {
  assert.equal(isStaleAssetError(new Error('Cannot read properties of undefined')), false);
});
