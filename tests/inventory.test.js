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
  const P = load(), scr = P.byId['report/inventory-monitoring'], all = scr.rows(), lots = all.filter(r => r.id.startsWith('V'));
  assert.strictEqual(scr.tag, 'Wish'); assert.strictEqual(P.U(scr.id).applied.yard, 'In yard');
  assert.strictEqual(lots.length, P.D.vehicles.length);
  const out = lots.find(r => r.release), inYard = lots.find(r => !r.release);
  assert.strictEqual(inYard.days_in_yard, days(inYard.entry_date, P.TODAY)); assert.strictEqual(inYard.yard, 'In yard');
  assert.strictEqual(out.days_in_yard, days(out.entry_date, out.release)); assert.strictEqual(out.released_buyer, out.release); assert.strictEqual(out.returned_seller, null);
  const ns = lots.find(r => r.status === 'Not Sold'); P.recordRelease(P.byId['VWD/for-return-to-seller'], ns, { date: P.TODAY, to: 'SELLER', type: 'Return to Seller', items: [] });
  const back = scr.rows().find(r => r.id === ns.id); assert.deepStrictEqual([back.returned_seller, back.released_buyer, back.yard], [P.TODAY, null, 'Out']);
});
test('statuses: Listed (auction not ended) and Not Listed replace the old set; yard and inspection units', () => {
  const P = load(), scr = P.byId['report/inventory-monitoring'], rows = scr.rows();
  assert.deepStrictEqual(P.INV_STATUSES, ['Listed', 'Not Listed', 'Awarded', 'For Release', 'For Return', 'Released', 'Returned']);
  const s = f => P.invStatusOf(Object.assign({ status: 'Not Sold', auction: 221 }, f));
  assert.deepStrictEqual([s({}), s({ next_auction: 222 }), s({ auction: 222 }), s({ status: 'Sold' }), s({ status: 'Sold', dispatch: '2026-10-01' }), s({ rts_cleared: '2026-10-01' })],
    ['Not Listed', 'Listed', 'Listed', 'Awarded', 'For Release', 'For Return']);
  assert.strictEqual(rows.length, P.V().length + 57 + 3);
  const y = rows.filter(r => r.id.startsWith('Y')), n = rows.filter(r => r.id.startsWith('N'));
  assert.deepStrictEqual([y.filter(r => r.inv_status === 'Listed').length, y.filter(r => r.inv_status === 'For Return').length], [43, 14]);
  assert.ok(n.every(r => r.inv_status === 'Not Listed' && r.yard === 'In yard'));
  assert.ok(y.every(r => r.yard === 'In yard' && r.status === '' && P.SELLER[r.seller]), 'yard units: no auction status, seller code resolved');
  assert.strictEqual(new Set(rows.map(r => r.id)).size, rows.length);
});
test('Report › Inventory Monitoring: view only, New, filters without Latest auction; SMD and VWD inventory gone', () => {
  const P = load(), scr = P.byId['report/inventory-monitoring'];
  assert.ok(scr.isNew); assert.deepStrictEqual(scr.actions, ['View', 'Filter', 'Sort']); assert.ok(!scr.cols.some(c => c.edit));
  assert.deepStrictEqual(scr.filters.map(f => f.key), ['yard', 'status', 'inv_status', 'seller', 'parking', 'plate']);
  assert.deepStrictEqual(scr.filters.find(f => f.key === 'parking').options(), ['OPEN PARKING', 'STEEL PARKING', 'IMET PARKING', 'Not recorded']);
  assert.ok(scr.cols.some(c => c.key === 'first_auction') && scr.cols.some(c => c.key === 'listing_end'));
  assert.strictEqual(P.byId['VWD/inventory'], undefined); assert.strictEqual(P.byId['SMD/inventory'], undefined);
  for (const id of ['VWD/inventory', 'SMD/inventory', 'VWD/auction-monitoring']) assert.strictEqual(P.routeOf(id), 'report/inventory-monitoring', id);
});
test('Inventory Monitoring rows: listing columns, parking filter (multi-select, Not recorded), totals, no negative days', () => {
  const P = load(), scr = P.byId['report/inventory-monitoring'], rows = scr.rows(), end = a => P.D.auctions[String(a)][1];
  const relisted = rows.find(r => r.id === 'V066'), plain = rows.find(r => r.id.startsWith('V') && !r.next_auction);
  assert.deepStrictEqual([relisted.first_auction, relisted.listing_end], [relisted.auction, end(222)], 'a relisted unit ends with the relisting');
  assert.deepStrictEqual([plain.first_auction, plain.listing_end], [plain.auction, end(plain.auction)]);
  assert.ok(rows.filter(r => !r.id.startsWith('V')).every(r => r.first_auction === null && r.listing_end === null), 'units that are not lots have no auction columns');
  assert.ok(rows.every(r => r.days_in_yard === null || r.days_in_yard >= 0), 'a unit that entered after the demo date shows 0 days, not a negative number');
  assert.ok(rows.some(r => r.id.startsWith('Y') && r.entry_date > P.TODAY));
  const ui = P.U(scr.id), pick = vals => { ui.applied = { parking: vals }; return P.applyFilters(scr, rows); };
  assert.ok(rows.some(r => !r.parking), 'some lots have no parking location');
  assert.deepStrictEqual(pick(['Not recorded']).map(r => r.id), rows.filter(r => !r.parking).map(r => r.id));
  assert.strictEqual(pick(['OPEN PARKING', 'IMET PARKING']).length, rows.filter(r => ['OPEN PARKING', 'IMET PARKING'].includes(r.parking)).length);
  assert.strictEqual(pick([]).length, rows.length, 'no pick = all');
  const t = scr.totals(rows), counts = P.INV_STATUSES.map(s => rows.filter(r => r.inv_status === s).length);
  assert.strictEqual(t.plate, rows.length + ' units'); assert.strictEqual(counts.reduce((a, b) => a + b, 0), rows.length);
  assert.strictEqual(t.model, P.INV_STATUSES.map((s, i) => s + ' ' + counts[i]).filter(x => !x.endsWith(' 0')).join(' \u00b7 '));
});
test('Inventory Monitoring: New marks only on the two new columns; blank Auction Status is an empty cell', () => {
  const P = load(), scr = P.byId['report/inventory-monitoring'], rows = scr.rows();
  assert.deepStrictEqual(scr.cols.filter(c => c.isNew).map(c => c.key), ['first_auction', 'listing_end']);
  const col = scr.cols.find(c => c.key === 'status'), yard = rows.find(r => r.id.startsWith('Y')), lot = rows.find(r => r.id.startsWith('V'));
  assert.strictEqual(P.cellHtml(scr, yard, col, false), '<td class="c"></td>');
  assert.match(P.cellHtml(scr, lot, col, false), /<span class="st /);
  assert.strictEqual(P.D.yardUnits.length, 57); assert.ok(P.D.yardUnits.every(u => u.plate && u.entry_date && ['LISTED', 'FOR RETURN'].includes(u.file_status)));
});
