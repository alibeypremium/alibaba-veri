// X (Twitter) listesini herkese açık bir Nitter örneğinin RSS'inden çeker, tw.json üretir.
// Liste ve örnekler aşağıdadır. Örnekler sırayla denenir; ilk çalışan kullanılır (örnek sahipleri komut dosyası trafiğini sevmez:
// bu yüzden yalnızca 15 dakikada bir ve tek istek, başarısızlıkta sıradaki örnek).
import fs from 'node:fs';
import path from 'node:path';

export const LIST = '2122284620062294403';
export const INSTANCES = ['nitter.netbub.com', 'nitter.mie.foundation', 'nitter.kareem.one', 'nitter.jaydenha.uk', 'nitter.mizuki.st', 'nitter.pp.ua'];
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const MAX = 40;

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export const unent = (s) => String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); try { return String.fromCodePoint(n); } catch { return m; } }
  return ENT[e.toLowerCase()] ?? m;
});
const tag = (block, name) => {
  const m = block.match(new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + name + '>'));
  if (!m) return '';
  const c = m[1].trim().match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return c ? c[1] : unent(m[1]);
};
const strip = (h) => unent(String(h).replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

// Görsel: Nitter bazı örneklerde doğrudan pbs.twimg.com adresi verir, bazılarında kendi /pic/ vekil adresini. İkisi de X'in görsel adresine çevrilir;
// yalnızca bilinen medya yolları kabul edilir (avatar, rastgele site yok).
const MEDIA = /^(media|ext_tw_video_thumb|amplify_video_thumb|tweet_video_thumb|card_img)\/[\w./-]+$/;
export function picOf(html) {
  const m = String(html).match(/<img[^>]+src="([^"]+)"/i);
  if (!m) return '';
  const src = unent(m[1]);
  let p;
  const d = src.match(/^https:\/\/pbs\.twimg\.com\/([^?#]+)/);
  if (d) p = d[1];
  else {
    const i = src.indexOf('/pic/');
    if (i < 0) return '';
    p = src.slice(i + 5).split('?')[0].replace(/^orig\//, '');
    try { p = decodeURIComponent(p); } catch { return ''; }
    p = p.split('?')[0];
  }
  return MEDIA.test(p) ? 'https://pbs.twimg.com/' + p : '';
}

export function parse(xml) {
  const out = [];
  for (const b of String(xml).split('<item>').slice(1)) {
    const block = b.split('</item>')[0];
    const link = tag(block, 'link'), id = tag(block, 'guid').match(/\d{6,}/)?.[0] || link.match(/status\/(\d+)/)?.[1];
    const user = (tag(block, 'dc:creator') || link.match(/\/([^/]+)\/status\//)?.[1] || '').replace(/^@/, '');
    const when = Date.parse(tag(block, 'pubDate'));
    let text = tag(block, 'title').replace(/\s+/g, ' ').trim(), kind = 'tweet';
    if (/^RT by @\w+:\s*/.test(text)) { kind = 'rt'; text = text.replace(/^RT by @\w+:\s*/, ''); }
    else if (/^R to @\w+:\s*/.test(text)) { kind = 'reply'; text = text.replace(/^R to @\w+:\s*/, ''); }
    if (!id || !/^\w{1,15}$/.test(user) || !(when > 0) || !text) continue;
    const it = { id, u: '@' + user, k: kind, t: text.slice(0, 700), d: new Date(when).toISOString(), l: 'https://x.com/' + user + '/status/' + id };
    const img = picOf(tag(block, 'description'));
    if (img) it.img = img;
    out.push(it);
  }
  return out.sort((a, b) => Date.parse(b.d) - Date.parse(a.d)).slice(0, MAX);
}

async function get(host) {
  const r = await fetch('https://' + host + '/i/lists/' + LIST + '/rss', { headers: { 'user-agent': UA, accept: 'application/rss+xml,text/xml;q=0.9,*/*;q=0.8' }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const x = await r.text();
  if (!/<rss[\s>]/.test(x)) throw new Error('RSS değil');
  const items = parse(x);
  if (!items.length) throw new Error('boş');
  return { items, title: tag(x.split('<item>')[0], 'title') };
}

if (process.argv[1] && process.argv[1].endsWith('tw.mjs')) {
  const outFile = process.argv[2] || 'out/tw.json', errs = [];
  // Bazı Nitter örnekleri bayat akış verir (X oturumları kısıtlanınca). İlk çalışan değil, en taze akış seçilir:
  // örnekler sırayla denenir, en yeni tweet FRESH süreden yeniyse durulur; değilse hepsi denenip tweet'ler birleştirilir.
  const FRESH = 15 * 60e3, got = new Map(), used = [];
  let title = '';
  for (const h of INSTANCES) {
    try {
      const r = await get(h);
      title = title || r.title; used.push(h);
      for (const it of r.items) if (!got.has(it.id)) got.set(it.id, it);
      const newest = Date.parse(r.items[0].d);
      console.log('tw ok', h, r.items.length, 'tweet, en yeni', r.items[0].d);
      if (Date.now() - newest < FRESH) break;
    } catch (e) { errs.push(h + ': ' + e.message); console.log('tw hata', h, e.message); }
  }
  if (got.size) {
    const items = [...got.values()].sort((a, b) => Date.parse(b.d) - Date.parse(a.d)).slice(0, MAX);
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify({ t: Date.now(), url: 'https://x.com/i/lists/' + LIST, name: title, src: used.join(','), items }));
    console.log('tw yazıldı', items.length, 'tweet, en yeni', items[0].d);
    process.exit(0);
  }
  console.error('Hiçbir Nitter örneği çalışmadı: ' + errs.join(' | '));
  process.exit(1);   // eski tw.json dalda kalır (üzerine yazılmaz)
}
