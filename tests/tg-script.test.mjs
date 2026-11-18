import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, vidOf } from '../.github/scripts/tg.mjs';

const C = { k: 'x', name: 'Deneme', cat: 'haber' };
const msg = (id, inner) => `<div class="tgme_widget_message" data-post="kanal/${id}"><div class="tgme_widget_message_text js-message_text">Haber ${id}</div>${inner}<a class="tgme_widget_message_date"><time datetime="2026-11-18T08:00:00+00:00"></time></a></div>`;
const ph = (u) => `<a class="tgme_widget_message_photo_wrap" style="width:100px;background-image:url('${u}')"></a>`;

test('tg: albümdeki tüm fotoğraflar (en çok 4) imgs olarak, ilk görsel img olarak gelir', () => {
  const html = msg(1, '<div class="tgme_widget_message_grouped_wrap">' + [1, 2, 3, 4, 5].map((i) => ph('https://cdn4.telesco.pe/file/p' + i + '.jpg')).join('') + '</div>') + msg(2, ph('https://cdn4.telesco.pe/file/tek.jpg'));
  const [b, a] = parse(html, C).sort((x, y) => x.link.localeCompare(y.link)).reverse();   // 2, 1
  const alb = [a, b].find((x) => x.link.endsWith('/1')), one = [a, b].find((x) => x.link.endsWith('/2'));
  assert.equal(alb.imgs.length, 4);
  assert.equal(alb.img, 'https://cdn4.telesco.pe/file/p1.jpg');
  assert.equal(one.imgs, undefined, 'tek görselde imgs yok');
  assert.equal(one.img, 'https://cdn4.telesco.pe/file/tek.jpg');
});

test('tg: video (bulanık olmayan mp4 tercih edilir), kapak görseli; yabancı adres yok sayılır', () => {
  const thumb = '<a class="tgme_widget_message_video_thumb" style="background-image:url(\'https://cdn4.telesco.pe/file/kapak.jpg\')"></a>';
  const html = msg(1, '<video src="https://cdn4.telesco.pe/file/blur.mp4?token=a-b_c" class="tgme_widget_message_video blured js-message_video_blured"></video><video src="https://cdn4.telesco.pe/file/asil.mp4?token=x-y_z" class="tgme_widget_message_video js-message_video"></video>' + thumb) +
    msg(2, '<video src="https://evil.example/x.mp4" class="js-message_video"></video>' + thumb);
  const r = parse(html, C);
  const v = r.find((x) => x.link.endsWith('/1')), e = r.find((x) => x.link.endsWith('/2'));
  assert.equal(v.vid, 'https://cdn4.telesco.pe/file/asil.mp4?token=x-y_z');
  assert.equal(v.img, 'https://cdn4.telesco.pe/file/kapak.jpg');
  assert.equal(e.vid, undefined);
  assert.equal(vidOf('https://cdn-telegram.org/file/a.mp4'), 'https://cdn-telegram.org/file/a.mp4');
  assert.equal(vidOf('http://cdn4.telesco.pe/file/a.mp4'), '');
});

test('tg: yalnızca bağlantı önizlemesi varsa onun görseli kullanılır', () => {
  const html = msg(1, '<a class="link_preview_image" style="background-image:url(\'https://cdn4.telesco.pe/file/lp.jpg\')"></a>');
  assert.equal(parse(html, C)[0].img, 'https://cdn4.telesco.pe/file/lp.jpg');
});
