import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../.github/scripts/hw.mjs';

const IMG = (n) => `<img src="https://orangetrackdiecast.com/wp-content/uploads/2026/05/${n}.jpg?w=300" srcset="x" alt="">`;
const HTML = `<html><body><header><h1 class="logo">ORANGE TRACK</h1></header><article>
<h1>2026 Hot Wheels MASTER LIST</h1>
<h2>Premium</h2>
<h1>Boulevard</h1>
<table><tr><th>#</th><th>Casting</th><th>Image</th></tr>
<tr><td>158</td><td><strong>Aston Martin DBS</strong></td><td>${IMG('a')}</td></tr>
<tr><td>159</td><td><strong><a href="https://collabs.shop/xvsapi">’89 Mercedes-Benz 560 SEC AMG</a></strong></td><td>${IMG('merc')}</td></tr>
<tr><td>160</td><td><strong>BMW M3 GTR</strong></td><td>${IMG('bmw')}</td></tr></table>
<h1>Car Culture</h1><h3>Power Trip (R)</h3>
<table><tr><td>1/5</td><td><strong>BMW M3 E46</strong></td><td>${IMG('e46')}</td></tr></table>
<h1>Car Culture 2-Packs</h1><h3>Mix 1</h3>
<div class="wp-block-media-text"><figure class="wp-block-media-text__media">${IMG('pack')}</figure><div class="wp-block-media-text__content"><h4>German Performance</h4><p>JRN77</p><ul><li><strong>Mercedes-Benz 500 E</strong></li><li><strong>’91 BMW M5</strong></li><li><strong>Ford Focus</strong></li></ul></div></div>
<h2>Mattel Creations / Ultra Premium</h2>
<h1>HWC / RLC</h1>
<table><tr><th>Casting</th><th>Color</th><th>Sale Date</th><th>Image</th></tr>
<tr><td><strong>’95 BMW M3<br></strong><em>2027 RLC Membership</em></td><td><em>Aqua*</em></td><td></td><td></td></tr></table>
<h1>Exclusives</h1><table><tr><td>BONE SHAKER</td><td>x</td></tr><tr><td><a href="https://creations.mattel.com/products/x">Mercedes-AMG GT R*</a></td><td>y</td></tr></table>
</article></body></html>`;

test('hw: yalnızca Mercedes-Benz ve BMW; ad, bağlantı, görsel (sorgusuz), kategori, seri', () => {
  const r = parse(HTML);
  assert.deepEqual(r.map((x) => x.n), ['’89 Mercedes-Benz 560 SEC AMG', 'BMW M3 GTR', 'BMW M3 E46', 'Mercedes-Benz 500 E', '’91 BMW M5', '’95 BMW M3', 'Mercedes-AMG GT R']);
  assert.deepEqual(r[0], { n: '’89 Mercedes-Benz 560 SEC AMG', u: '', i: 'https://orangetrackdiecast.com/wp-content/uploads/2026/05/merc.jpg', c: 'Premium', s: 'Boulevard' });
  assert.equal(r[1].u, '');
  assert.equal(r[6].u, 'https://creations.mattel.com/products/x', 'collabs.shop dışındaki bağlantı korunur');
  assert.equal(r[2].s, 'Car Culture · Power Trip', 'seri harfi (R) atılır, alt seri eklenir');
  assert.equal(r[3].s, 'Car Culture 2-Packs · German Performance');
  assert.equal(r[3].i, 'https://orangetrackdiecast.com/wp-content/uploads/2026/05/pack.jpg', 'paket görseli');
  assert.equal(r[5].c, 'Ultra Premium', '"A / B" kategorisinde son bölüm');
  assert.equal(r[5].i, '', 'görseli olmayan satır da listelenir');
  assert.ok(!r.some((x) => /Ford|Aston|BONE/.test(x.n)));
});
