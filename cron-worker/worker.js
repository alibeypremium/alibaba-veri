// Cloudflare Worker: alibaba-veri iş akışlarını zamanında tetikler (GitHub'ın kendi zamanlayıcısı yeni repoda başlamadığı için).
// Cloudflare'de tek bir Cron Trigger yeterli: "*/5 * * * *". Gizli değişken: GH_TOKEN (yalnızca bu repoya "Actions: Read and write" izinli token).
const REPO = 'alibeypremium/alibaba-veri';

/** Verilen UTC zamanında çalıştırılacak iş akışı dosyaları (5 dakikalık dilimler). */
export function due(d) {
  const m = d.getUTCMinutes(), h = d.getUTCHours(), out = ['tg.yml'];
  if (m % 10 < 5) out.push('art.yml');             // ~10 dk
  if (m % 10 < 5) out.push('yt.yml');              // ~15 dk
  if (h % 6 === 0 && m < 5) out.push('ps.yml');    // 6 saatte bir
  if (h % 12 === 1 && m < 5) out.push('hw.yml');   // 12 saatte bir (Hot Wheels listesi)
  if (h % 6 === 2 && m < 5) out.push('epic.yml');   // 6 saatte bir (Epic indirimleri)
  if (h === 3 && m >= 40 && m < 45) out.push('kurul.yml');   // günde bir (03:40 UTC)
  return out;
}

async function dispatch(token, file) {
  const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${file}/dispatches`, {
    method: 'POST',
    headers: { authorization: 'Bearer ' + token, accept: 'application/vnd.github+json', 'user-agent': 'veri-tetik', 'x-github-api-version': '2022-11-28', 'content-type': 'application/json' },
    body: JSON.stringify({ ref: 'main' }),
  });
  if (r.status !== 204) console.log(file, 'HATA', r.status, (await r.text()).slice(0, 200));
  return r.status === 204;
}

export default {
  async scheduled(event, env) {
    if (!env.GH_TOKEN) { console.log('GH_TOKEN tanımlı değil'); return; }
    const files = due(new Date(event.scheduledTime));
    const res = await Promise.all(files.map((f) => dispatch(env.GH_TOKEN, f)));
    console.log(files.map((f, i) => f + (res[i] ? ' ok' : ' HATA')).join(', '));
  },
  async fetch() { return new Response('veri-tetik çalışıyor', { headers: { 'content-type': 'text/plain; charset=utf-8' } }); },
};
