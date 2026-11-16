// Haber makalelerinin metnini önceden çeker, art.json üretir (okuma modu + AI Özet için: vekil beklemeden anında açılır).
// Kaynak listesi config/feeds.json'dan okunur (ana sitedeki public/js/news.js TECH_FEEDS ile aynı tutulmalı).
import * as cheerio from 'cheerio';
import fs from 'node:fs';
import path from 'node:path';

const PER = 6, CAP = 14000, UA = 'Mozilla/5.0 (compatible; AliBabaTerminal-art)';
export const norm = u => String(u || '').replace(/^https?:\/\/(www\.)?/i, '').replace(/#.*$/, '').replace(/\/$/, '');

export function parseItems(xml) {
  const $ = cheerio.load(xml, { xmlMode: true });
  const out = [];
  $('item').each((_, el) => {
    const l = $(el).find('link').first().text().trim() || $(el).find('guid').first().text().trim();
    if (/^https?:\/\//.test(l)) out.push(l);
  });
  return out;
}
// Makalenin sade hali: og:title/og:image + en çok paragraf içeren kutunun p/h2/h3/li öğeleri (istemcideki rdFromHtml bunu okur).
export function compact(html) {
  const $ = cheerio.load(html);
  const meta = p => $(`meta[property="${p}"]`).attr('content') || '';
  const title = meta('og:title') || $('h1').first().text().trim() || $('title').text().trim();
  const img = meta('og:image');
  $('script,style,noscript,nav,aside,footer,form,iframe,svg,button').remove();
  const score = el => $(el).find('p').toArray().reduce((n, p) => { const L = $(p).text().trim().length; return n + (L > 40 ? L : 0); }, 0);
  const box = $('article,[itemprop=articleBody],main,.content,.article,body').toArray().map(e => [score(e), e]).sort((x, y) => y[0] - x[0])[0];
  if (!box || box[0] < 200) return '';
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  let out = '<meta property="og:title" content="' + esc(title).replace(/"/g, '&quot;') + '">';
  if (/^https?:/i.test(img)) out += '<meta property="og:image" content="' + esc(img).replace(/"/g, '&quot;') + '">';
  out += '<article>';
  for (const el of $(box[1]).find('p,h2,h3,li').toArray()) {
    const t = $(el).text().replace(/\s+/g, ' ').trim();
    if (!t) continue;
    const n = el.tagName.toLowerCase();
    out += `<${n}>${esc(t)}</${n}>`;
    if (out.length > CAP) break;
  }
  return out + '</article>';
}
async function get(u, ms = 12000) {
  const r = await fetch(u, { headers: { 'user-agent': UA, 'accept-language': 'tr' }, signal: AbortSignal.timeout(ms), redirect: 'follow' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.text();
}
async function pool(list, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < list.length) { const x = list[i++]; try { await fn(x); } catch (e) { console.error(String(x).slice(0, 70) + ': ' + e.message); } } }));
}

if (process.argv[1] && process.argv[1].endsWith('art.mjs')) {
  const outFile = process.argv[2] || 'art.json';
  const feeds = JSON.parse(fs.readFileSync(new URL('../../config/feeds.json', import.meta.url), 'utf8'));
  const links = new Set();
  await pool(feeds, 6, async f => { for (const l of parseItems(await get(f)).slice(0, PER)) links.add(l); });
  const a = {};
  await pool([...links], 8, async l => { const c = compact(await get(l)); if (c) a[norm(l)] = c; });
  if (!Object.keys(a).length) { console.error('hiç makale alınamadı'); process.exit(1); }
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify({ t: Date.now(), a }));
  console.log('tamam:', Object.keys(a).length + '/' + links.size, 'makale,', (fs.statSync(outFile).size / 1024 | 0) + ' KB');
}
