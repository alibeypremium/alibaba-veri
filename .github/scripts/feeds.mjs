// Haber beslemelerini (config/feeds.json) sunucuda çeker, tek dosyada toplar: feeds.json → veri-feeds dalı.
// Site önce bunu okur (vekil/rss2json beklemeden, CORS sorunu olmadan); alınamazsa eski yola düşer.
import * as cheerio from 'cheerio';
import fs from 'node:fs';
import path from 'node:path';

const PER = 30, UA = 'Mozilla/5.0 (compatible; AliBabaTerminal-feeds)';
const strip = (h) => cheerio.load('<p>' + String(h || '').replace(/<[^>]*>/g, ' ') + '</p>').text().replace(/\s+/g, ' ').trim();
const sum = (h) => { const s = strip(h); return s.length >= 40 ? s.slice(0, 360) : ''; };
const http = (u) => /^https?:\/\//i.test(u || '') ? u : '';

export function parseFeed(xml) {
  const $ = cheerio.load(xml, { xmlMode: true });
  const out = [];
  $('item,entry').slice(0, PER).each((_, el) => {
    const e = $(el), g = (t) => e.find(t).first().text().trim();
    const link = http(g('link')) || http(e.find('link').first().attr('href')) || http(g('guid'));
    const raw = e.find('content\\:encoded').first().text() + ' ' + (g('description') || g('summary') || g('content'));
    const enc = e.find('enclosure[type^="image"]').first().attr('url') || '';
    const img = http(e.find('media\\:thumbnail').first().attr('url') || e.find('media\\:content').first().attr('url') || enc || (raw.match(/<img[^>]+src=["']([^"']+)/i) || [])[1] || '');
    const date = g('pubDate') || g('dc\\:date') || g('published') || g('updated');
    const cats = e.find('category').toArray().map((c) => $(c).text().trim() || $(c).attr('term') || '').filter(Boolean).slice(0, 6);
    const title = strip(g('title'));
    if (!title || !link) return;
    out.push({ title, link, date: Date.parse(date) ? new Date(date).toISOString() : '', cats, sum: sum(raw), img });
  });
  return out;
}
async function get(u) {
  const r = await fetch(u, { headers: { 'user-agent': UA, 'accept-language': 'tr', accept: 'application/rss+xml,application/xml;q=0.9,*/*;q=0.8' }, signal: AbortSignal.timeout(15000), redirect: 'follow' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.text();
}
async function pool(list, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < list.length) { const x = list[i++]; try { await fn(x); } catch (e) { console.error(String(x).slice(0, 70) + ': ' + e.message); } } }));
}

if (process.argv[1] && process.argv[1].endsWith('feeds.mjs')) {
  const outFile = process.argv[2] || 'feeds.json';
  const urls = JSON.parse(fs.readFileSync(new URL('../../config/feeds.json', import.meta.url), 'utf8'));
  const f = {};
  await pool(urls, 6, async (u) => {
    const it = parseFeed(await get(u));
    // Bazı kaynaklar (ör. CNN Türk) yerel saati "GMT" diye yazar → tarihler gelecekte görünür; böyle bir besleme 3 saat geri alınır.
    const newest = Math.max(0, ...it.map((x) => Date.parse(x.date) || 0));
    if (newest > Date.now() + 30 * 60e3 && newest < Date.now() + 4 * 3600e3) for (const x of it) if (x.date) x.date = new Date(Date.parse(x.date) - 3 * 3600e3).toISOString();
    if (it.length) f[u] = it;
  });
  if (!Object.keys(f).length) { console.error('hiç besleme alınamadı'); process.exit(1); }
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify({ t: Date.now(), f }));
  console.log(Object.keys(f).length + '/' + urls.length + ' besleme');
}
