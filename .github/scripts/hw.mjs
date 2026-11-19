// Hot Wheels (Mercedes-Benz ve BMW) listesi: orangetrackdiecast.com "master list" sayfalarından hw.json üretir.
//   hw.json : { t, y: { "2027": [{n, u, i, c, s}], "2026": [...] } }   n=ad, u=bağlantı (varsa), i=görsel, c=kategori (Premium…), s=seri
// Kullanım: node .github/scripts/hw.mjs out
// Marka süzgecini değiştirmek için BRAND'i, yıl eklemek için YEARS'ı düzenle.
import * as cheerio from 'cheerio';
import fs from 'node:fs';
import path from 'node:path';

export const YEARS = ['2027', '2026'];
export const BRAND = /\b(mercedes|bmw)\b/i;
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const src = (y) => 'https://orangetrackdiecast.com/' + y + '-hot-wheels-master-list-of-all-lines/';

const sp = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const cleanSub = (s) => sp(s).replace(/\s*\(\s*[A-Z]\s*\)\s*$/, '').replace(/\*+$/, '').trim();   // "Power Trip (R)" → "Power Trip"
const catOf = (s) => sp(s).split('/').pop().trim();                                              // "Mattel Creations / Ultra Premium" → "Ultra Premium"
const imgOf = ($, el) => {
  const im = $(el).find('img').first(), s = im.attr('src') || im.attr('data-orig-file') || '';
  return /^https:\/\/orangetrackdiecast\.com\/wp-content\/uploads\//.test(s) ? s.split('?')[0] : '';
};
const linkOf = ($, el) => {
  const h = $(el).find('a[href]').first().attr('href') || '';
  return /^https?:\/\//.test(h) ? h : '';
};

export function parse(html) {
  const $ = cheerio.load(html);
  const out = [], seen = new Set();
  let cat = '', line = '', sub = '';
  const add = (n, u, i, c, s) => {
    n = sp(n).replace(/\*+$/, '').trim();
    if (!n || !BRAND.test(n)) return;
    const k = n + '|' + s;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ n, u, i, c, s });
  };
  $('article').first().find('h1,h2,h3,table,.wp-block-media-text').each((_, el) => {
    const t = el.tagName;
    if (t === 'h2') { cat = catOf($(el).text()); line = ''; sub = ''; return; }
    if (t === 'h1') { const x = sp($(el).text()); if (!/master list/i.test(x)) { line = x; sub = ''; } return; }
    if (t === 'h3') { sub = cleanSub($(el).text()); return; }
    if (t === 'table') {
      const rows = $(el).find('tr').toArray();
      if (!rows.length) return;
      const cells = (r) => $(r).children('th,td').toArray();
      const head = cells(rows[0]).map((c) => sp($(c).text()));
      const hasHead = head.some((x) => /^(#|casting|product)$/i.test(x));
      let ci = head.findIndex((x) => /^(casting|product)$/i.test(x));
      if (ci < 0) ci = head.findIndex((x) => x && !/^\d+(\/\d+)?$/.test(x));
      for (const r of rows.slice(hasHead ? 1 : 0)) {
        const c = cells(r)[ci];
        if (!c) continue;
        add($(c).find('strong').first().text() || $(c).find('a').first().text() || $(c).text(), linkOf($, c), imgOf($, r), cat, [line, sub].filter(Boolean).join(' · '));
      }
      return;
    }
    // Paket blokları (2'li, takım taşıyıcı, display set): resim solda, başlık + araç listesi sağda
    const title = sp($(el).find('h4').first().text());
    const s = [line, title].filter(Boolean).join(' · ');
    $(el).find('li').each((__, li) => add($(li).text(), linkOf($, li), imgOf($, el), cat, s));
  });
  return out;
}

// collabs.shop kısa bağlantıları ürün kalkınca ana sayfaya düşer; yönlendirmesi ana sayfada biten bağlantılar atılır (u = '').
export const isHome = (finalUrl) => { try { const p = new URL(finalUrl); return p.pathname.replace(/\/+$/, '') === ''; } catch { return false; } };
async function vet(list, prev) {
  const old = new Map((prev || []).map((x) => [x.n + '|' + x.s, x.u]));
  let n = 0;
  for (const x of list) {
    if (!/^https:\/\/collabs\.shop\//.test(x.u)) continue;
    try {
      const r = await fetch(x.u, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(15000), redirect: 'follow' });
      const home = isHome(r.url);
      console.log('bağlantı', x.u, '→', r.url, r.status, home ? 'ANA SAYFA, atıldı' : 'tamam');
      if (home || !r.ok) x.u = ''; else n++;
    } catch (e) {
      console.log('bağlantı', x.u, 'denenemedi', e.message);
      if (old.has(x.n + '|' + x.s) && old.get(x.n + '|' + x.s) === '') x.u = '';   // daha önce atılmıştı, belirsizken geri getirme
    }
  }
  return n;
}

async function get(u) {
  const r = await fetch(u, { headers: { 'user-agent': UA, 'accept-language': 'en' }, signal: AbortSignal.timeout(40000), redirect: 'follow' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.text();
}

if (process.argv[1] && process.argv[1].endsWith('hw.mjs')) {
  const outFile = path.join(process.argv[2] || 'out', 'hw.json');
  let prev = {};
  try { prev = JSON.parse(fs.readFileSync(outFile, 'utf8')).y || {}; } catch {}
  const y = {};
  for (const yr of YEARS) {
    try {
      const list = parse(await get(src(yr)));
      if (!list.length) throw new Error('hiç araç bulunamadı');
      await vet(list, prev[yr]);
      y[yr] = list;
      console.log(yr + ': ' + list.length + ' araç');
    } catch (e) {
      console.error(yr + ': ' + e.message);
      if (prev[yr]) y[yr] = prev[yr];   // başarısız olan yıl eski veriyle kalsın
    }
  }
  if (!Object.keys(y).length) { console.error('veri alınamadı'); process.exit(1); }
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify({ t: Date.now(), y }));
}
