import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseItems, compact, norm } from '../.github/scripts/art.mjs';

test('art.mjs: besleme listesi news.js\'ten okunur, RSS bağlantıları ve sade metin çıkar', () => {
  const urls = JSON.parse(fs.readFileSync(new URL('../config/feeds.json', import.meta.url), 'utf8'));
  assert.ok(urls.length >= 15 && urls.every((u) => /^https?:/.test(u)));
  assert.deepEqual(parseItems('<rss><channel><item><link>https://a.com/x/</link></item><item><guid>https://b.com/y</guid></item></channel></rss>'), ['https://a.com/x/', 'https://b.com/y']);
  const c = compact('<html><head><meta property="og:title" content="Başlık"></head><body><nav><p>menü</p></nav><article><p>' + 'a'.repeat(300) + '</p></article><script>x</script></body></html>');
  assert.match(c, /og:title" content="Başlık"/);
  assert.match(c, /<p>a{300}<\/p>/);
  assert.doesNotMatch(c, /menü|script/);
  assert.equal(compact('<html><body><p>kısa</p></body></html>'), '');
  assert.equal(norm('https://www.a.com/x/#h'), 'a.com/x');
});
