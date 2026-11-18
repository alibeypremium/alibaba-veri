import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed } from '../.github/scripts/feeds.mjs';

test('feeds: RSS ve Atom ayrıştırılır (başlık, bağlantı, tarih ISO, kategori, özet, görsel)', () => {
  const rss = `<rss xmlns:media="m" xmlns:content="c" xmlns:dc="d"><channel>
    <item><title><![CDATA[Yeni &amp; telefon geldi]]></title><link>https://a.example/1</link><pubDate>Mon, 16 Nov 2026 10:00:00 GMT</pubDate>
      <category>Teknoloji</category><category>Oyun</category>
      <description><![CDATA[<p>Bu haberin özeti yeterince uzun olsun diye biraz daha yazı ekliyoruz burada.</p><img src="https://a.example/i.jpg">]]></description></item>
    <item><title>Görselli</title><link>https://a.example/2</link><media:thumbnail url="https://a.example/t.jpg"/><description>kısa</description></item>
    <item><title>Bağlantısız</title></item>
    <item><title>Kötü bağlantı</title><link>javascript:alert(1)</link></item>
  </channel></rss>`;
  const a = parseFeed(rss);
  assert.equal(a.length, 2);
  assert.equal(a[0].title, 'Yeni & telefon geldi');
  assert.equal(a[0].link, 'https://a.example/1');
  assert.equal(a[0].date, '2026-11-16T10:00:00.000Z');
  assert.deepEqual(a[0].cats, ['Teknoloji', 'Oyun']);
  assert.match(a[0].sum, /^Bu haberin özeti/);
  assert.equal(a[0].img, 'https://a.example/i.jpg');
  assert.equal(a[1].img, 'https://a.example/t.jpg');
  assert.equal(a[1].sum, '', 'kısa özet boş bırakılır');
  const atom = `<feed><entry><title>Atom haberi</title><link href="https://b.example/x"/><updated>2026-11-16T09:00:00Z</updated><summary>Atom özeti de yeterince uzun olsun diye burada biraz daha metin var.</summary></entry></feed>`;
  const b = parseFeed(atom);
  assert.equal(b[0].link, 'https://b.example/x');
  assert.equal(b[0].date, '2026-11-16T09:00:00.000Z');
});
