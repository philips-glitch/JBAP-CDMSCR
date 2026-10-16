const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { load } = require('./harness');
const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
test('latest auction is the last one started by the demo date', () => {
  assert.strictEqual(load().LATEST_AUCTION, '221');
});
test('Date of Entry: JBAP\'s parking inventory file where the plate matches, else inferred 7 to 21 days before the auction', () => {
  const P = load(), raw = {}; new Function('window', fs.readFileSync(path.join(__dirname, '..', 'data.js'), 'utf8'))(raw);
  const fromFile = new Set(raw.MOCK_DATA.vehicles.filter(v => v.entry_date).map(v => v.id));
  assert.ok(fromFile.size >= 150, `${fromFile.size} lots dated from the file`);
  for (const v of P.D.vehicles) {
    const a = P.D.auctions[String(v.auction)];
    if (fromFile.has(v.id)) assert.ok(v.entry_date <= a[1], `${v.id} entered before its auction ended`);
    else { const d = days(v.entry_date, a[0]); assert.ok(d >= 7 && d <= 21, `${v.id} ${d}`); }
  }
  assert.ok(P.D.vehicles.filter(v => v.parking).length >= 150 && P.D.vehicles.filter(v => v.logistics).length >= 150);
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
test('inventory status is calculated, view only; For Release = dispatched, not released', () => {
  const P = load(), scr = P.byId['VWD/inventory'], smd = P.byId['SMD/inventory'];
  assert.deepStrictEqual(P.INV_STATUSES, ['Listed', 'Awarded', 'For Release', 'For Return', 'Released', 'Returned']);
  const s = f => P.invStatusOf(Object.assign({ status: 'Not Sold' }, f));
  assert.deepStrictEqual([s({ release: '2026-10-01' }), s({ release: '2026-10-01', release_type: 'Return to Seller' }), s({ rts_cleared: '2026-10-01' }), s({ status: 'Sold', dispatch: '2026-10-01' }), s({ status: 'Sold' }), s({})],
    ['Released', 'Returned', 'For Return', 'For Release', 'Awarded', 'Listed']);
  for (const x of [scr, smd]) { assert.deepStrictEqual(x.actions, ['View', 'Filter', 'Sort'], x.id); assert.ok(!x.cols.some(c => c.edit), x.id); assert.ok(!(x.buttons || []).length, x.id); }
  assert.ok(scr.rows().every(r => r.inv_status === P.invStatusOf(r))); assert.ok(scr.rows().some(r => r.inv_status === 'For Release'));
  const v = P.S.veh.find(x => x.status === 'Sold' && !x.dispatch && !x.release); v.inv_status = 'For Return';
  assert.strictEqual(P.enrichV(v).inv_status, 'Awarded', 'a stored manual status no longer counts');
});
test('VWD Inventory Monitoring and SMD Inventory: the parking inventory file\'s columns and filters', () => {
  const P = load(), v = P.byId['VWD/inventory'], s = P.byId['SMD/inventory'];
  assert.strictEqual(v.title, 'Inventory Monitoring'); assert.strictEqual(s.title, 'Inventory');
  assert.deepStrictEqual(v.cols.map(c => c.key), ['entry_date', 'vcn', 'plate', 'cs_no', 'model', 'color', 'year', 'seller', 'logistics', 'origin_wh', 'parking', 'transfer_date', 'status', 'inv_status', 'released_buyer', 'returned_seller', 'rts_wh', 'days_in_yard']);
  assert.deepStrictEqual(s.cols.map(c => c.key), v.cols.map(c => c.key)); assert.strictEqual(s.rows().length, v.rows().length);
  assert.deepStrictEqual(v.filters.map(f => f.key), ['yard', 'status', 'inv_status', 'seller', 'parking', 'latest', 'plate']);
  assert.ok(v.filters.find(f => f.key === 'parking').options().length >= 2);
  assert.ok(v.rows().some(r => r.latest === 'In latest auction') && v.rows().some(r => r.latest === 'Not in latest auction'));
});
