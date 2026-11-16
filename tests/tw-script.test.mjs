import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parse, picOf, unent, noTco, profileOf, LIST, INSTANCES } from '../.github/scripts/tw.mjs';

const xml = fs.readFileSync(new URL('./fixtures/tw-list.rss', import.meta.url), 'utf8');

test('tw: RSS ayrıştırılır, yeniden eskiye sıralanır, bozuk kayıt atlanır', () => {
  const it = parse(xml);
  assert.equal(it.length, 3);
  assert.deepEqual(it.map((x) => x.id), ['2122269243089793343', '2122290933093851163', '2122228173530083786']);   // 12:00, 11:29, 10:00
  assert.ok(Date.parse(it[0].d) >= Date.parse(it[1].d) && Date.parse(it[1].d) >= Date.parse(it[2].d));
});

test('tw: varlıklar çözülür; RT/yanıt ön ekleri türe çevrilir; bağlantı x.com\'a çevrilir; görsel pbs.twimg.com olur', () => {
  const by = Object.fromEntries(parse(xml).map((x) => [x.id, x]));
  const a = by['2122290933093851163'];
  assert.equal(a.t, 'SON DAKİKA: Gemi battı & 12 mürettebat kayıp (İHA)');
  assert.equal(a.u, '@pusholder');
  assert.equal(a.k, 'tweet');
  assert.equal(a.l, 'https://x.com/pusholder/status/2122290933093851163');
  assert.equal(a.d, '2026-11-16T11:29:23.000Z');
  assert.equal(a.img, 'https://pbs.twimg.com/media/Gabc123.jpg');
  const rt = by['2122228173530083786'];
  assert.deepEqual([rt.k, rt.t], ['rt', 'Türkiye neden daha az otomobil üretiyor?']);
  const rp = by['2122269243089793343'];
  assert.deepEqual([rp.k, rp.t], ['reply', 'Yazılımı buradan indirebilirsiniz https://gitlab.com/x/y']);
  assert.equal(rp.img, undefined);
});

test('tw: picOf yalnızca bilinen X görsel yollarını kabul eder', () => {
  assert.equal(picOf('<img src="https://n.example/pic/media%2FAB_c-1.png%3Fname%3Dsmall">'), 'https://pbs.twimg.com/media/AB_c-1.png');
  assert.equal(picOf('<img src="https://n.example/pic/ext_tw_video_thumb%2F1%2Fpu%2Fimg%2Fx.jpg">'), 'https://pbs.twimg.com/ext_tw_video_thumb/1/pu/img/x.jpg');
  assert.equal(picOf('<img src="https://pbs.twimg.com/media/AbC_1-x.jpg?format=jpg&amp;name=small">'), 'https://pbs.twimg.com/media/AbC_1-x.jpg');
  assert.equal(picOf('<img src="https://pbs.twimg.com/profile_images/1/a.jpg">'), '', 'avatar kabul edilmez');
  assert.equal(picOf('<img src="https://n.example/pic/evil%2F..%2Fx.jpg">'), '');
  assert.equal(picOf('<img src="https://baska.example/x.jpg">'), '');
  assert.equal(picOf('metin'), '');
});

test('tw: varlık çözücü ve ayarlar', () => {
  assert.equal(unent('a &amp; b &lt;c&gt; &#39;d&#39; &#x131;'), "a & b <c> 'd' ı");
  assert.equal(LIST, '2122284620062294403');
  assert.ok(INSTANCES.length >= 3 && INSTANCES.every((h) => /^[\w.-]+$/.test(h)));
});

test('tw: t.co bağlantıları (örnek adresiyle yeniden yazılmış olanlar dahil) metinden silinir; yalnızca bağlantılı ve görselsiz tweet atlanır', () => {
  assert.equal(noTco('Haber metni https://t.co/AbC123xyz'), 'Haber metni');
  assert.equal(noTco('Önce https://xitter.gq/t.co/n4hQIhEt97 sonra devam'), 'Önce sonra devam');
  assert.equal(noTco('Başka bağlantı https://gitlab.com/x/y kalır'), 'Başka bağlantı https://gitlab.com/x/y kalır');
  const item = (id, title, img) => '<item><title>' + title + '</title><dc:creator>@a</dc:creator><description><![CDATA[<p>x</p>' + (img ? '<img src="' + img + '">' : '') + ']]></description><pubDate>Mon, 16 Nov 2026 12:00:00 GMT</pubDate><guid>' + id + '</guid><link>https://x.test/a/status/' + id + '</link></item>';
  const out = parse('<rss><channel>' + item('2122000000000000001', 'https://t.co/aaaa', 'https://pbs.twimg.com/media/Zz.jpg') + item('2122000000000000002', 'https://t.co/bbbb', '') + item('2122000000000000003', 'Metin https://t.co/cccc', '') + '</channel></rss>');
  assert.deepEqual(out.map((x) => [x.id.slice(-1), x.t]), [['1', ''], ['3', 'Metin']]);
});

test('tw: kullanıcı RSS\'inden görünen ad ve profil resmi alınır; yalnızca X profil resmi adresi kabul edilir', () => {
  const rss = (title, url) => '<rss><channel><title>' + title + '</title><link>x</link><image><title>' + title + '</title><link>x</link><url>' + url + '</url></image><item><title>t</title></item></channel></rss>';
  assert.deepEqual(profileOf(rss('Boşuna Tıklama / @bosunatiklama', 'https://pbs.twimg.com/profile_images/1882143207280029696/vEb6yfNF_400x400.jpg')), { n: 'Boşuna Tıklama', a: 'https://pbs.twimg.com/profile_images/1882143207280029696/vEb6yfNF_bigger.jpg' });
  assert.deepEqual(profileOf(rss('Ad &amp; Soyad / @x', 'https://evil.example/a.jpg')), { n: 'Ad & Soyad', a: '' });
  assert.equal(profileOf('<rss><channel></channel></rss>'), null);
});
