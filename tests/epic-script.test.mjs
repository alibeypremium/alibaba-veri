import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toRow, toAll } from '../.github/scripts/epic.mjs';

const el = (o = {}) => ({ title: 'Oyun', offerMappings: [{ pageSlug: 'oyun-abc' }], keyImages: [{ type: 'OfferImageWide', url: 'https://cdn1.epicgames.com/w.jpg' }, { type: 'OfferImageTall', url: 'https://cdn1.epicgames.com/t.jpg' }],
  price: { totalPrice: { originalPrice: 100000, discountPrice: 25000, discount: 75000 } }, ...o });

test('epic: indirimli satır dönüşümü', () => {
  assert.deepEqual(toRow(el()), { n: 'Oyun', u: 'https://store.epicgames.com/tr/p/oyun-abc', i: 'https://cdn1.epicgames.com/w.jpg', j: 'https://cdn1.epicgames.com/t.jpg', o: 1000, p: 250, x: 75 });
});
test('epic: indirimsiz ya da slug’sız satır elenir; /home soneki atılır', () => {
  assert.equal(toRow(el({ price: { totalPrice: { originalPrice: 100, discountPrice: 100 } } })), null);
  assert.equal(toRow(el({ offerMappings: [], productSlug: '' })), null);
  assert.equal(toRow(el({ offerMappings: [], productSlug: 'crimson-desert/home' })).u, 'https://store.epicgames.com/tr/p/crimson-desert');
});

test('epic: katalog satırı kısa biçimde (CDN öneki atılır, indirimsiz de girer)', () => {
  assert.deepEqual(toAll(el({ price: { totalPrice: { originalPrice: 5000, discountPrice: 5000 } } })), ['oyun-abc', 'Oyun', 'w.jpg'.replace('w.jpg', 'w.jpg'), 50, 50].map((v, i) => (i === 2 ? 'w.jpg' : v)));
  assert.equal(toAll(el({ offerMappings: [], productSlug: '' })), null);
});
