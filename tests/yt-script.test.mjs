import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { channelOf, liveOf } from '../.github/scripts/yt.mjs';

test('yt.mjs: tv.js\'teki embed kimlikleri okunur, kanal ve canlı yayın sayfadan ayıklanır', () => {
  const ids = JSON.parse(fs.readFileSync(new URL('../config/tv-embeds.json', import.meta.url), 'utf8'));
  assert.ok(ids.length >= 7 && ids.includes('pqq5c6k70kk') && ids.every((i) => i.length === 11));
  assert.equal(channelOf('x"channelId":"UCaO-M1dXacMwtyg0Pvovk4w"y'), 'UCaO-M1dXacMwtyg0Pvovk4w');
  assert.equal(liveOf('<link rel="canonical" href="https://www.youtube.com/watch?v=abcdefghijk"> "isLiveNow":true'), 'abcdefghijk');
  assert.equal(liveOf('<link rel="canonical" href="https://www.youtube.com/watch?v=abcdefghijk"> "isLiveNow":false'), '');
  assert.equal(liveOf('"currentVideoEndpoint":{"commandMetadata":{"webCommandMetadata":{"url":"/watch?v=abcdefghijk"}}} "isLive":true'), 'abcdefghijk');
  assert.equal(liveOf('"currentVideoEndpoint":{"commandMetadata":{"webCommandMetadata":{"url":"/watch?v=abcdefghijk"}}} "isLive":false "isLive":true'), '');
  assert.equal(liveOf('{"videoDetails":{"videoId":"abcdefghijk","isLiveContent":true}}'), '');
  assert.equal(liveOf('<link rel="canonical" href="https://www.youtube.com/channel/UCaO-M1dXacMwtyg0Pvovk4w">'), '');
});
