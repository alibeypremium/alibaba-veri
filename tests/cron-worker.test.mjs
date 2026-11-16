import { test } from 'node:test';
import assert from 'node:assert/strict';
import { due } from '../cron-worker/worker.js';

test('cron-worker: her 5 dk tg; art 10, yt 15 dk; ps 6 saatte; kurul günde bir', () => {
  const at = (h, m) => new Date(Date.UTC(2026, 10, 16, h, m));
  assert.deepEqual(due(at(7, 5)), ['tg.yml']);
  assert.deepEqual(due(at(7, 10)), ['tg.yml', 'art.yml']);
  assert.deepEqual(due(at(7, 15)), ['tg.yml', 'yt.yml']);
  assert.deepEqual(due(at(7, 0)), ['tg.yml', 'art.yml', 'yt.yml']);
  assert.deepEqual(due(at(6, 0)), ['tg.yml', 'art.yml', 'yt.yml', 'ps.yml']);
  assert.deepEqual(due(at(3, 40)), ['tg.yml', 'art.yml', 'kurul.yml']);
});
