const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness');
const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
test('latest auction is the last one started by the demo date', () => {
  assert.strictEqual(load().LATEST_AUCTION, '221');
});
test('every vehicle has an inferred Date of Entry 7 to 21 days before its auction', () => {
  const P = load();
  for (const v of P.D.vehicles) { const d = days(v.entry_date, P.D.auctions[String(v.auction)][0]); assert.ok(d >= 7 && d <= 21, `${v.id} ${d}`); }
});
test('inventory: in yard by default, days in yard, released vs returned', () => {
  const P = load(), scr = P.byId['VWD/inventory'], all = scr.rows();
  assert.strictEqual(scr.tag, 'Wish'); assert.strictEqual(P.U(scr.id).applied.yard, 'In yard');
  assert.strictEqual(all.length, P.D.vehicles.length);
  const out = all.find(r => r.release), inYard = all.find(r => !r.release);
  assert.strictEqual(inYard.days_in_yard, days(inYard.entry_date, P.TODAY)); assert.strictEqual(inYard.yard, 'In yard');
  assert.strictEqual(out.days_in_yard, days(out.entry_date, out.release)); assert.strictEqual(out.released_buyer, out.release); assert.strictEqual(out.returned_seller, null);
  const ns = all.find(r => r.status === 'Not Sold'); P.recordRelease(scr, ns, { date: P.TODAY, to: 'SELLER', type: 'Return to Seller', items: [] });
  const back = scr.rows().find(r => r.id === ns.id); assert.deepStrictEqual([back.returned_seller, back.released_buyer, back.yard], [P.TODAY, null, 'Out']);
});
test('SMD sees the same inventory; filters cover yard, status, seller, location and latest auction', () => {
  const P = load(), v = P.byId['VWD/inventory'], s = P.byId['SMD/inventory'];
  assert.strictEqual(s.rows().length, v.rows().length);
  assert.deepStrictEqual(v.filters.map(f => f.key), ['yard', 'status', 'seller', 'location', 'latest', 'plate']);
  assert.ok(v.rows().some(r => r.latest === 'In latest auction') && v.rows().some(r => r.latest === 'Not in latest auction'));
});
