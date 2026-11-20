import { test } from 'node:test';
import assert from 'node:assert/strict';
import { due } from '../cron-worker/worker.js';

test('cron-worker: her 5 dk tg; art ve yt 10 dk; ps 6, hw 12 saatte; kurul günde bir', () => {
  const at = (h, m) => new Date(Date.UTC(2026, 10, 16, h, m));
  assert.deepEqual(due(at(7, 5)), ['tg.yml']);
  assert.deepEqual(due(at(7, 10)), ['tg.yml', 'art.yml', 'yt.yml']);
  assert.deepEqual(due(at(7, 15)), ['tg.yml']);
  assert.deepEqual(due(at(6, 0)), ['tg.yml', 'art.yml', 'yt.yml', 'ps.yml']);
  assert.deepEqual(due(at(1, 0)), ['tg.yml', 'art.yml', 'yt.yml', 'hw.yml']);
  assert.ok(due(at(13, 0)).includes('hw.yml'));
  assert.ok(!due(at(7, 0)).includes('hw.yml'), 'hw 6. saatte çalışmaz');
  assert.deepEqual(due(at(7, 0)), ['tg.yml', 'art.yml', 'yt.yml']);
  assert.deepEqual(due(at(2, 0)), ['tg.yml', 'art.yml', 'yt.yml', 'epic.yml']);
  assert.ok(due(at(8, 0)).includes('epic.yml') && due(at(20, 0)).includes('epic.yml'));
  assert.ok(!due(at(5, 0)).includes('epic.yml'));
  assert.deepEqual(due(at(3, 40)), ['tg.yml', 'art.yml', 'yt.yml', 'kurul.yml']);
});
