// X (Twitter) listesini herkese açık bir Nitter örneğinin RSS'inden çeker, tw.json üretir.
// Liste ve örnekler aşağıdadır. Örnekler sırayla denenir; ilk çalışan kullanılır (örnek sahipleri komut dosyası trafiğini sevmez:
// bu yüzden yalnızca 15 dakikada bir ve tek istek, başarısızlıkta sıradaki örnek).
import fs from 'node:fs';
import path from 'node:path';

export const LIST = '2122284620062294403';
export const INSTANCES = ['nitter.cf', 'xitter.gq', 'teapawt.net', 'teapawt.org', 'nitter.netbub.com', 'nitter.mie.foundation', 'nitter.kareem.one', 'nitter.jaydenha.uk', 'nitter.mizuki.st', 'nitter.pp.ua'];
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const MAX = 40;
const PROF_TTL = 7 * 24 * 3600e3;

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
function mediaOf(src0) {
  const src = unent(src0);
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
// Açıklamadaki tüm görseller (en çok 4, yinelenenler atılır).
export function picsOf(html) {
  const out = [];
  for (const m of String(html).matchAll(/<img[^>]+src="([^"]+)"/gi)) {
    const u = mediaOf(m[1]);
    if (u && !out.includes(u)) out.push(u);
    if (out.length >= 4) break;
  }
  return out;
}
export const picOf = (html) => picsOf(html)[0] || '';
// Alıntı tweet: Nitter açıklamasında <blockquote><b>Ad (@kullanıcı)</b> … <a href=".../kullanıcı/status/ID#m"> … </blockquote>.
export function quoteOf(descHtml) {
  const m = String(descHtml).match(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/i);
  if (!m) return { q: null, rest: String(descHtml) };
  const rest = String(descHtml).replace(m[0], '');
  const inner = m[1];
  const link = (inner.match(/href="[^"]*?\/(\w{1,15})\/status\/(\d{6,})/) || []);
  const head = strip((inner.match(/<b>([\s\S]*?)<\/b>/) || [])[1] || '');
  const hm = head.match(/^(.*?)\s*\(@(\w{1,15})\)\s*$/);
  const user = hm ? hm[2] : link[1] || (head.match(/@(\w{1,15})/) || [])[1] || '';
  const body = inner.replace(/<b>[\s\S]*?<\/b>/i, '').replace(/<a\b[\s\S]*?<\/a>/gi, '').replace(/<img[^>]*>/gi, '');
  const text = noTco(unent(body.replace(/<\/p>\s*<p>/gi, '\n\n').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')));
  const imgs = picsOf(inner);
  if (!user || (!text && !imgs.length)) return { q: null, rest };
  const q = { u: '@' + user, n: (hm ? hm[1] : '').trim().slice(0, 60), t: text.slice(0, 600) };
  if (link[2]) q.l = 'https://x.com/' + link[1] + '/status/' + link[2];
  if (imgs[0]) q.img = imgs[0];
  return { q, rest };
}

// Tweet metnindeki kısaltılmış bağlantılar (t.co, bazı Nitter örneklerinde "örnek/t.co/…") okunmayı bozar: silinir.
// Satır sonları korunur (okuma penceresinde paragraflar görünsün); boşluklar tek boşluğa iner, en çok bir boş satır kalır.
export const norm = (t) => String(t).replace(/[ \t\u00a0]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
export const noTco = (t) => norm(String(t).replace(/[ \t]*https?:\/\/(?:[\w.-]+\/)?t\.co\/\w+/g, ''));
// Nitter RSS başlığı uzun tweet'leri "…" ile keser; tam metin açıklamadaki ilk <p> bloğundadır.
export function fullText(descHtml) {
  const m = String(descHtml).match(/^\s*<p>([\s\S]*?)<\/p>/);
  return m ? noTco(unent(m[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''))) : '';
}

// Profil: kullanıcının RSS'inden görünen ad ("Ad / @kullanıcı") ve profil resmi; yalnızca X'in profil resmi adresi kabul edilir.
export function profileOf(xml) {
  const head = String(xml).split('<item>')[0];
  const title = tag(head.replace(/<image>[\s\S]*?<\/image>/, ''), 'title'), m = title.match(/^(.+?)\s+\/\s+@\w+$/);
  const url = tag((head.match(/<image>([\s\S]*?)<\/image>/) || [])[1] || '', 'url');
  const a = url.match(/^https:\/\/pbs\.twimg\.com\/(profile_images\/[\w./-]+?)(?:_400x400|_bigger|_normal)?(\.\w+)$/);
  const n = m ? m[1].trim().slice(0, 60) : '';
  return n || a ? { n, a: a ? 'https://pbs.twimg.com/' + a[1] + '_bigger' + a[2] : '' } : null;
}

export function parse(xml) {
  const out = [];
  for (const b of String(xml).split('<item>').slice(1)) {
    const block = b.split('</item>')[0];
    const link = tag(block, 'link'), id = tag(block, 'guid').match(/\d{6,}/)?.[0] || link.match(/status\/(\d+)/)?.[1];
    const user = (tag(block, 'dc:creator') || link.match(/\/([^/]+)\/status\//)?.[1] || '').replace(/^@/, '');
    const when = Date.parse(tag(block, 'pubDate'));
    let text = norm(tag(block, 'title')), kind = 'tweet';
    if (/^RT by @\w+:\s*/.test(text)) { kind = 'rt'; text = text.replace(/^RT by @\w+:\s*/, ''); }
    else if (/^RT @\w+ \(by @\w+\):\s*/.test(text)) { kind = 'rt'; text = text.replace(/^RT @\w+ \(by @\w+\):\s*/, ''); }
    else if (/^R to @\w+:\s*/.test(text)) { kind = 'reply'; text = text.replace(/^R to @\w+:\s*/, ''); }
    text = noTco(text);
    const desc = tag(block, 'description');
    if (/(…|\.\.\.)$/.test(text)) {   // kesilmiş başlık: açıklamadaki tam metin başlığın başlangıcıyla örtüşüyorsa o kullanılır
      const full = fullText(desc), sq = (x) => x.replace(/\s+/g, ' ');
      if (full && sq(full).startsWith(sq(text.replace(/(…|\.\.\.)$/, '')).slice(0, 30))) text = full;
    }
    const { q, rest } = quoteOf(desc), imgs = picsOf(rest), img = imgs[0] || '';
    if (!id || !/^\w{1,15}$/.test(user) || !(when > 0) || (!text && !img && !q)) continue;   // yalnızca bağlantıdan oluşan ve görseli olmayan tweet atlanır
    const it = { id, u: '@' + user, k: kind, t: text.slice(0, 1500), d: new Date(when).toISOString(), l: 'https://x.com/' + user + '/status/' + id };
    if (img) it.img = img;
    if (imgs.length > 1) it.imgs = imgs;
    if (q) it.q = q;
    out.push(it);
  }
  return out.sort((a, b) => Date.parse(b.d) - Date.parse(a.d)).slice(0, MAX);
}

// Video: Nitter RSS yalnızca küçük resmi verir (amplify_video_thumb vb.). Oynatılabilir mp4 adresi X'in herkese açık tweet-result
// uç noktasından alınır (Actions'tan çalışır; tarayıcıdan çağrılmaz). En yüksek bitrate ≤ 1,5 Mbps olan mp4 seçilir, yoksa en düşük.
export const isVideoThumb = (u) => /^https:\/\/pbs\.twimg\.com\/(amplify_video_thumb|ext_tw_video_thumb|tweet_video_thumb)\//.test(u || '');
export function pickMp4(j) {
  const vs = ((j && j.mediaDetails) || []).flatMap((m) => (m.video_info && m.video_info.variants) || [])
    .filter((v) => v.content_type === 'video/mp4' && /^https:\/\/video\.twimg\.com\/[\w./-]+\.mp4(\?[\w=&.-]*)?$/.test(v.url || ''));
  if (!vs.length) return '';
  const ok = vs.filter((v) => (v.bitrate || 0) <= 1.5e6).sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
  return (ok[0] || vs.sort((a, b) => (a.bitrate || 0) - (b.bitrate || 0))[0]).url;
}
// Profil (ad + profil resmi) yedeği: aynı tweet-result yanıtındaki "user" alanı. Nitter'ın kullanıcı sayfaları sık 403/429 verdiğinden asıl yol budur.
export function profileFromSyn(j) {
  const u = j && j.user;
  if (!u) return null;
  const n = String(u.name || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  const m = String(u.profile_image_url_https || '').match(/^https:\/\/pbs\.twimg\.com\/(profile_images\/[\w./-]+?)(?:_400x400|_bigger|_normal)?(\.\w+)$/);
  return n || m ? { n, a: m ? 'https://pbs.twimg.com/' + m[1] + '_bigger' + m[2] : '' } : null;
}
async function synJson(id) {
  const token = ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');
  const r = await fetch('https://cdn.syndication.twimg.com/tweet-result?id=' + id + '&lang=tr&token=' + token, { headers: { 'user-agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
async function videoOf(id) {
  return pickMp4(await synJson(id));
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
    // Profiller (ad + profil resmi): önceki tw.json'dan taşınır; eksik ya da 7 günden eski olanlar, çalışan örnekten bir seferde en çok 8 tane yenilenir.
    let prev = {}; const prevVid = {};
    try { const r = await fetch('https://raw.githubusercontent.com/' + (process.env.GITHUB_REPOSITORY || 'alibeypremium/alibaba-veri') + '/veri-tw/tw.json', { signal: AbortSignal.timeout(10000) }); if (r.ok) { const pj = await r.json(); prev = pj.p || {}; for (const x of pj.items || []) if (x.vid) prevVid[x.id] = x.vid; } } catch {}
    const handles = [...new Set(items.map((i) => i.u.slice(1)))], p = {};
    for (const h of handles) if (prev[h]) p[h] = prev[h];
    const need = handles.filter((h) => !p[h] || Date.now() - (p[h].t || 0) > PROF_TTL).slice(0, 8);
    for (const h of need) {
      let pr = null;
      // 1) X'in tweet-result yanıtı (kullanıcının en yeni tweet'i üzerinden); 2) Nitter kullanıcı RSS'i (çalışan örneklerden sırayla)
      const tid = (items.find((i) => i.u.slice(1) === h) || {}).id;
      if (tid) { try { pr = profileFromSyn(await synJson(tid)); } catch (e) { console.log('tw profil (syn) hata', h, e.message); } }
      for (const host of pr ? [] : used) {
        try {
          const r = await fetch('https://' + host + '/' + h + '/rss', { headers: { 'user-agent': UA, accept: 'application/rss+xml,text/xml;q=0.9,*/*;q=0.8' }, signal: AbortSignal.timeout(15000) });
          pr = r.ok ? profileOf(await r.text()) : null;
          if (pr) break;
        } catch (e) { console.log('tw profil hata', h, host, e.message); }
      }
      if (pr) { p[h] = { ...pr, t: Date.now() }; console.log('tw profil', h, pr.n); } else console.log('tw profil alınamadı', h);
      await new Promise((ok) => setTimeout(ok, 500));
    }
    // Video adresleri: önceki çalışmadan taşınır, yeni video tweet'leri için bir seferde en çok 12 arama.
    let looked = 0;
    for (const it of items) {
      if (!isVideoThumb(it.img)) continue;
      if (prevVid[it.id]) { it.vid = prevVid[it.id]; continue; }
      if (looked >= 12) continue;
      looked++;
      try { const v = await videoOf(it.id); if (v) { it.vid = v; console.log('tw video', it.id); } } catch (e) { console.log('tw video hata', it.id, e.message); }
      await new Promise((ok) => setTimeout(ok, 300));
    }
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify({ t: Date.now(), url: 'https://x.com/i/lists/' + LIST, name: title, src: used.join(','), p, items }));
    console.log('tw yazıldı', items.length, 'tweet, en yeni', items[0].d);
    process.exit(0);
  }
  console.error('Hiçbir Nitter örneği çalışmadı: ' + errs.join(' | '));
  process.exit(1);   // eski tw.json dalda kalır (üzerine yazılmaz)
}
