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
test('inventory status: suggested from the lot; VWD can change it for units in the yard, logged; SMD only views', () => {
  const P = load(), scr = P.byId['VWD/inventory'], smd = P.byId['SMD/inventory'];
  assert.deepStrictEqual(P.INV_STATUSES, ['Released', 'Returned', 'Listed', 'Awarded', 'For Return']);
  const s = f => P.invStatusOf(Object.assign({ status: 'Not Sold' }, f));
  assert.deepStrictEqual([s({ release: '2026-10-01' }), s({ release: '2026-10-01', release_type: 'Return to Seller' }), s({ rts_cleared: '2026-10-01' }), s({ status: 'Sold' }), s({})],
    ['Released', 'Returned', 'For Return', 'Awarded', 'Listed']);
  const col = scr.cols.find(c => c.key === 'inv_status');
  assert.strictEqual(col.edit, 'select'); assert.deepStrictEqual(col.options, P.INV_STATUSES);
  assert.ok(scr.actions.includes('Update') && scr.buttons.some(b => b.act === 'save'), 'VWD can update');
  assert.ok(!smd.actions.includes('Update'), 'SMD only views');
  const r = scr.rows().find(x => x.inv_status === 'Listed'), before = P.S.log.length;
  assert.match(P.cellHtml(scr, r, col, true), /<select[^>]*data-key="inv_status"/);
  P.U(scr.id).edits[r.id] = { inv_status: 'For Return' }; P.applyEdits(scr);
  assert.strictEqual(scr.rows().find(x => x.id === r.id).inv_status, 'For Return', 'the VWD choice wins over the suggestion');
  assert.deepStrictEqual(P.S.log.slice(before).map(e => [e.module, e.screen, e.field, e.new]), [['VWD', 'Inventory', 'Inventory Status', 'For Return']]);
  const out = scr.rows().find(x => x.release);
  assert.ok(col.lockWhen(out) && ['Released', 'Returned'].includes(out.inv_status), 'a unit that left the yard follows its release record');
  assert.doesNotMatch(P.cellHtml(scr, out, col, true), /<select/);
  P.recordRelease(scr, scr.rows().find(x => x.id === r.id), { date: P.TODAY, to: 'SELLER', type: 'Return to Seller', items: [] });
  assert.strictEqual(scr.rows().find(x => x.id === r.id).inv_status, 'Returned', 'the release record overrides an earlier VWD choice');
});
test('SMD sees the same inventory; filters cover yard, status, inventory status, seller, location and latest auction', () => {
  const P = load(), v = P.byId['VWD/inventory'], s = P.byId['SMD/inventory'];
  assert.strictEqual(s.rows().length, v.rows().length);
  assert.deepStrictEqual(v.filters.map(f => f.key), ['yard', 'status', 'inv_status', 'seller', 'location', 'latest', 'plate']);
  assert.ok(v.rows().some(r => r.latest === 'In latest auction') && v.rows().some(r => r.latest === 'Not in latest auction'));
});
