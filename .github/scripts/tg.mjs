// Telegram kanallarını çeker, tg.json üretir. Kanal / kategori eklemek için aşağıdaki listeyi düzenle.
import * as cheerio from 'cheerio';
import fs from 'node:fs';
import path from 'node:path';

const CATS = [['haber', 'Haber'], ['alisveris', 'Alışveriş']];
const DIRECT = ['alisveris'];   // bu kategorilerde tıklama mesajdaki ilk dış bağlantıya gider
const CHANNELS = [
  { k: 'bosuna', u: 'bosuna_tiklamayin_haber', name: 'Boşuna Tıklamayın', cat: 'haber' },
  { k: 'sdk',    u: 'sondakika_haberr0',       name: 'Son Dakika',        cat: 'haber' },
  { k: 'ninja',  u: 'ninjanewstr',             name: 'Ninja News',        cat: 'haber' },
  { k: 'firsat', u: 'firsattayfa',             name: 'Fırsat Tayfa',      cat: 'alisveris' },
];

// Telegram CDN'indeki mp4 (örn. https://cdn4.telesco.pe/file/<ad>.mp4?token=...); başka adres kabul edilmez.
export const vidOf = (u) => /^https:\/\/[\w.-]*(?:telesco\.pe|cdn-telegram\.org)\/file\/[\w.-]+\.mp4(?:\?[\w=&.%-]*)?$/.test(String(u || '')) ? String(u) : '';

export function parse(html, c) {
  const $ = cheerio.load(html);
  const out = [];
  $('.tgme_widget_message[data-post]').each((_, el) => {
    const m = $(el), post = m.attr('data-post') || '';
    if (!/^\w+\/\d+$/.test(post)) return;
    const te = m.find('.tgme_widget_message_text.js-message_text').first();
    let title = '', ext = '';
    if (te.length) {
      te.find('br').replaceWith(' ');
      title = te.text().replace(/\s+/g, ' ').trim();
      te.find('a[href]').each((_, a) => {
        if (ext) return;
        const h = $(a).attr('href') || '';
        let u; try { u = new URL(h); } catch { return; }
        if (!/^https?:$/.test(u.protocol)) return;
        if (/(^|\.)(t\.me|telegram\.(me|org)|telegra\.ph)$/i.test(u.hostname)) return;
        ext = u.href;
      });
    }
    // Görseller: albümdeki tüm fotoğraflar (en çok 4), video kapağı; hiçbiri yoksa bağlantı önizlemesi. Arka plan resmi olarak verilir.
    const bg = (n) => { const mm = ($(n).attr('style') || '').match(/url\(\s*['"]?([^'")]+)/); return mm && /^https:\/\//.test(mm[1]) ? mm[1] : ''; };
    const imgs = [];
    m.find('.tgme_widget_message_photo_wrap, .tgme_widget_message_video_thumb').each((_, n) => { const u = bg(n); if (u && !imgs.includes(u) && imgs.length < 4) imgs.push(u); });
    if (!imgs.length) m.find('.link_preview_image, .link_preview_right_image').each((_, n) => { const u = bg(n); if (u && !imgs.length) imgs.push(u); });
    const img = imgs[0] || '';
    // Video: mesajdaki ilk oynatılabilir mp4 (yalnızca Telegram CDN'i). Önce bulanık olmayan, yoksa herhangi biri.
    let vid = '';
    const vs = m.find('video[src]').toArray().sort((a, b) => /blured/.test($(a).attr('class') || '') - /blured/.test($(b).attr('class') || ''));
    for (const v of vs) { const u = vidOf($(v).attr('src')); if (u) { vid = u; break; } }
    out.push({
      title: (title || 'Medya mesajı').slice(0, 400),
      link: 'https://t.me/' + post,
      ext,
      img,
      ...(imgs.length > 1 ? { imgs } : {}),
      ...(vid ? { vid } : {}),
      cat: c.cat,
      date: m.find('.tgme_widget_message_date time').attr('datetime') || '',
      source: c.name,
      ch: c.k,
    });
  });
  return out.slice(-40).reverse();   // en yeni başta
}

async function get(c) {
  const fx = process.env.TG_FIXTURE;
  if (fx) return fs.readFileSync(path.join(fx, c.u + '.html'), 'utf8');
  const r = await fetch('https://t.me/s/' + c.u, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; tg-feed)' } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.text();
}

if (process.argv[1] && process.argv[1].endsWith('tg.mjs')) {
  const outFile = process.argv[2] || 'tg.json';
  const ch = [];
  for (const c of CHANNELS) {
    try {
      let items = [];
      for (let i = 0; i < 2 && !items.length; i++) items = parse(await get(c), c);
      if (items.length) ch.push({ k: c.k, items }); else console.error(c.u + ': 0 mesaj');
    } catch (e) { console.error(c.u + ': ' + e.message); }
  }
  if (!ch.length) { console.error('hiçbir kanal alınamadı'); process.exit(1); }
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify({ t: Date.now(), cfg: { cats: CATS, direct: DIRECT, ch: CHANNELS.map(({ k, u, name, cat }) => ({ k, u, name, cat })) }, ch }));
  console.log('tamam:', ch.map(x => x.k + '=' + x.items.length).join(' '));
}
