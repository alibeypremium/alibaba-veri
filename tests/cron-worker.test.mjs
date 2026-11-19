import { test } from 'node:test';
import assert from 'node:assert/strict';
import { due } from '../cron-worker/worker.js';

test('cron-worker: her 5 dk tg; art ve yt 10 dk; ps ve hw 6 saatte; kurul günde bir', () => {
  const at = (h, m) => new Date(Date.UTC(2026, 10, 16, h, m));
  assert.deepEqual(due(at(7, 5)), ['tg.yml']);
  assert.deepEqual(due(at(7, 10)), ['tg.yml', 'art.yml', 'yt.yml']);
  assert.deepEqual(due(at(7, 15)), ['tg.yml']);
  assert.deepEqual(due(at(6, 0)), ['tg.yml', 'art.yml', 'yt.yml', 'ps.yml']);
  assert.deepEqual(due(at(7, 0)).includes('hw.yml') || due(at(1, 0)).includes('hw.yml'), true);
  assert.deepEqual(due(at(7, 0)), ['tg.yml', 'art.yml', 'yt.yml', 'hw.yml']);
  assert.deepEqual(due(at(3, 40)), ['tg.yml', 'art.yml', 'yt.yml', 'kurul.yml']);
});
