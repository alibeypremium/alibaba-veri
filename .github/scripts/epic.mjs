// Epic Games Store indirimleri (TR fiyatı): epic.json üretir.
//   epic.json : { t, d: [{n, u, i, j, o, p, x}] }   n=ad, u=mağaza bağlantısı, i=geniş görsel, j=dikey görsel, o=eski fiyat (₺), p=yeni fiyat (₺), x=indirim %
// Kullanım: node .github/scripts/epic.mjs out
import fs from 'node:fs';
import path from 'node:path';

const Q = 'query s($allowCountries:String,$category:String,$count:Int,$country:String!,$locale:String,$sortBy:String,$sortDir:String,$start:Int,$onSale:Boolean,$freeGame:Boolean){Catalog{searchStore(allowCountries:$allowCountries,category:$category,count:$count,country:$country,locale:$locale,sortBy:$sortBy,sortDir:$sortDir,start:$start,onSale:$onSale,freeGame:$freeGame){elements{title id productSlug urlSlug offerMappings{pageSlug pageType} catalogNs{mappings(pageType:"productHome"){pageSlug pageType}} keyImages{type url} price(country:$country){totalPrice{discountPrice originalPrice discount currencyCode}}} paging{count total}}}}';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

const slugOf = (e) => {
  const s = ((e.offerMappings || [])[0] || {}).pageSlug || (((e.catalogNs || {}).mappings || [])[0] || {}).pageSlug || e.productSlug || e.urlSlug || '';
  return String(s).replace(/\/home$/, '');
};
const img = (e, ...types) => { for (const t of types) { const k = (e.keyImages || []).find((x) => x.type === t); if (k && /^https:\/\//.test(k.url)) return k.url; } return ''; };

export function toRow(e) {
  const t = e && e.price && e.price.totalPrice;
  if (!t || !t.originalPrice || !(t.discountPrice >= 0) || t.discountPrice >= t.originalPrice) return null;
  const slug = slugOf(e);
  if (!slug) return null;
  return {
    n: e.title,
    u: 'https://store.epicgames.com/tr/p/' + slug,
    i: img(e, 'OfferImageWide', 'DieselStoreFrontWide', 'Thumbnail'),
    j: img(e, 'OfferImageTall', 'DieselStoreFrontTall', 'Thumbnail'),
    o: t.originalPrice / 100,
    p: t.discountPrice / 100,
    x: Math.round((100 * (t.originalPrice - t.discountPrice)) / t.originalPrice),
  };
}

async function page(start, count, onSale = true, sort = ['currentPrice', 'DESC']) {
  const r = await fetch('https://store.epicgames.com/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': UA, accept: 'application/json', origin: 'https://store.epicgames.com', referer: 'https://store.epicgames.com/tr/browse' },
    body: JSON.stringify({ query: Q, variables: { allowCountries: 'TR', category: 'games/edition/base|bundles/games|editors', count, country: 'TR', locale: 'tr', sortBy: sort[0], sortDir: sort[1], start, onSale: onSale ? true : null, freeGame: null } }),
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  const s = j.data && j.data.Catalog && j.data.Catalog.searchStore;
  if (!s) throw new Error('beklenmeyen yanıt: ' + JSON.stringify(j).slice(0, 200));
  return s;
}

const PAGE = 40;   // Epic sayfa başına en fazla 40 öğe döndürür (count daha büyük olsa da); adım bu olmalı
const CDN = 'https://cdn1.epicgames.com/';
/** Arama için kısa satır: [mağaza yolu, ad, yatay görsel (CDN öneki atılmış), eski ₺, yeni ₺] */
export function toAll(e) {
  const t = e && e.price && e.price.totalPrice, slug = slugOf(e);
  if (!t || !slug || !e.title) return null;
  const im = img(e, 'OfferImageWide', 'DieselStoreFrontWide', 'Thumbnail');
  return [slug, e.title, im.startsWith(CDN) ? im.slice(CDN.length) : im, t.originalPrice / 100, t.discountPrice / 100];
}

async function catalog(outFile) {
  const first = await page(0, PAGE, false, ['title', 'ASC']);
  const total = (first.paging && first.paging.total) || 0, rows = new Map();
  const take = (s) => { for (const e of s.elements) { const r = toAll(e); if (r && !rows.has(r[0])) rows.set(r[0], r); } };
  take(first);
  const starts = []; for (let st = PAGE; st < Math.min(total, 20000); st += PAGE) starts.push(st);
  const got = new Map(); let i = 0;
  await Promise.all([0, 1, 2].map(async () => { while (i < starts.length) { const st = starts[i++]; try { got.set(st, await page(st, PAGE, false, ['title', 'ASC'])); } catch (e) { console.log('::warning::katalog sayfa ' + st + ': ' + e.message); } } }));
  starts.forEach((st) => got.has(st) && take(got.get(st)));
  console.log('Epic katalog:', rows.size, '(toplam', total + ')');
  if (rows.size < 2000) { console.log('::warning::Epic kataloğu eksik; epic-all.json güncellenmedi'); return; }
  fs.writeFileSync(outFile, JSON.stringify({ t: Date.now(), g: [...rows.values()] }));
}

async function main() {
  const outFile = path.join(process.argv[2] || 'out', 'epic.json');
  const rows = new Map();
  const first = await page(0, PAGE);
  const total = (first.paging && first.paging.total) || first.elements.length;
  const take = (s) => { for (const e of s.elements) { const r = toRow(e); if (r && !rows.has(r.u)) rows.set(r.u, r); } };
  take(first);
  for (let st = PAGE; st < Math.min(total, 2000); st += PAGE) take(await page(st, PAGE));
  const d = [...rows.values()].sort((a, b) => b.x - a.x || b.p - a.p);
  console.log('Epic indirim:', d.length, '(toplam', total + ')');
  if (d.length < 20) throw new Error('çok az sonuç (' + d.length + '), epic.json güncellenmedi');
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify({ t: Date.now(), d }));
  try { await catalog(path.join(path.dirname(outFile), 'epic-all.json')); } catch (e) { console.log('::warning::katalog: ' + e.message); }
}

if (process.argv[1] && process.argv[1].endsWith('epic.mjs')) main().catch((e) => { console.log('::warning::' + e.message); process.exit(0); });
