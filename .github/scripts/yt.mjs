// TV sekmesindeki embed: kanallarının o anki canlı yayın video kimliğini bulur, yt.json üretir.
// Kanallar config/tv-embeds.json'dan okunur (ana sitedeki public/js/tv.js embed:'...' kimlikleriyle aynı tutulmalı). Kanal kimliği (UC…) bir kez bulunup yt.json içinde saklanır.
import fs from 'node:fs';
import path from 'node:path';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const ID = /^[\w-]{11}$/;

export function channelOf(html) { const m = String(html).match(/"(?:externalChannelId|channelId)":"(UC[\w-]{22})"/); return m ? m[1] : ''; }
// Canlı mı ve hangi video? /channel/UC…/live sayfasında currentVideoEndpoint o anki videoyu, ilk "isLive" alanı canlı olup olmadığını verir
// (canonical adresi JS ile dolduğu için güvenilmez).
export function liveOf(html) {
  const h = String(html);
  const m = h.match(/"currentVideoEndpoint":.{0,400}?"url":"\/watch\?v=([\w-]{11})/);
  if (m) { const f = h.match(/"isLive":(true|false)/); return f && f[1] === 'true' ? m[1] : ''; }
  const c = h.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/);
  return c && /"isLiveNow":true|"isLive":true/.test(h) ? c[1] : '';
}
async function page(u) {
  const r = await fetch(u, { headers: { 'user-agent': UA, 'accept-language': 'tr-TR,tr;q=0.9', cookie: 'CONSENT=YES+cb; SOCS=CAI' }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.text();
}

if (process.argv[1] && process.argv[1].endsWith('yt.mjs')) {
  const outFile = process.argv[2] || 'yt.json';
  const embeds = JSON.parse(fs.readFileSync(new URL('../../config/tv-embeds.json', import.meta.url), 'utf8'));
  let prev = { ch: {} };
  try { const r = await fetch('https://raw.githubusercontent.com/' + (process.env.GITHUB_REPOSITORY || 'alibeypremium/alibaba-terminal') + '/veri-yt/yt.json', { signal: AbortSignal.timeout(10000) }); if (r.ok) prev = await r.json(); } catch {}
  const v = {}, ch = { ...(prev.ch || {}) };
  for (const base of embeds) {
    try {
      if (!ch[base]) { ch[base] = channelOf(await page('https://www.youtube.com/watch?v=' + base)); }
      let id = '';
      if (ch[base]) { const h = await page('https://www.youtube.com/channel/' + ch[base] + '/live'); id = liveOf(h); }
      if (id && ID.test(id)) v[base] = id;
      console.log(base, ch[base] || '?', '→', v[base] || 'canlı yayın bulunamadı (sabit kimlik kullanılır)');
    } catch (e) { console.error(base + ': ' + e.message); }
  }
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify({ t: Date.now(), v, ch }));
}
