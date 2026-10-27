const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness');
// JBAP feedback of 19 Oct 2026 (round 3): Report > Inventory Summary (Q70) and Report > Cancellation Monitoring (Q69)
const grp = (html, d) => html.split(`id="grp-${d}"`)[1].split('</div>')[0];
test('Inventory Summary: units in the yard per seller and status; parking narrows the count', () => {
  const P = load(), scr = P.byId['report/inventory-summary'], inYard = P.inventoryRows().filter(r => r.yard === 'In yard');
  assert.ok(!scr.isNew, 'the 19 Oct New mark is gone'); assert.deepStrictEqual(scr.cols.map(c => c.key), ['seller', 'in_yard', 'listed', 'not_listed', 'awarded', 'for_release', 'for_return']);
  const rows = scr.rows(); assert.strictEqual(rows.reduce((a, r) => a + r.in_yard, 0), inYard.length);
  for (const r of rows) assert.strictEqual(r.in_yard, r.listed + r.not_listed + r.awarded + r.for_release + r.for_return, r.seller);
  P.U(scr.id).applied = { parking: ['IMET PARKING'] };
  assert.strictEqual(scr.rows().reduce((a, r) => a + r.in_yard, 0), inYard.filter(r => r.parking === 'IMET PARKING').length);
});
test('Cancellation Monitoring report: every cancellation; old links open it', () => {
  const P = load(), scr = P.byId['report/cancellation-monitoring'];
  assert.ok(!scr.isNew, 'the 19 Oct New mark is gone'); assert.strictEqual(scr.rows().length, P.CX().length); assert.deepStrictEqual(scr.actions, ['View', 'Filter', 'Sort']);
  assert.strictEqual(P.byId['FAD/cancellation-entry'], undefined, 'Cancellation Entry is gone (JBAP, 26 Oct 2026)');
  for (const id of ['FAD/cancellation-monitoring', 'SMD/cancellation-monitoring', 'FAD/cancellation-entry']) assert.strictEqual(P.routeOf(id), 'report/cancellation-monitoring');
});

test('Inventory Summary: one row per seller with Not recorded for units without one; every status counted against the Inventory Monitoring rows', () => {
  const P = load(), scr = P.byId['report/inventory-summary'], inYard = P.inventoryRows().filter(r => r.yard === 'In yard'), rows = scr.rows();
  assert.strictEqual(scr.dept, 'Report'); assert.deepStrictEqual(scr.actions, ['View', 'Filter', 'Sort']);
  const sellers = [...new Set(inYard.map(r => r.seller || 'Not recorded'))].sort();
  assert.deepStrictEqual(rows.map(r => r.seller).sort(), sellers, 'one row per seller, the seller-less units grouped as Not recorded');
  const none = rows.find(r => r.seller === 'Not recorded'); assert.ok(none && none.in_yard > 0, 'Not recorded row');
  assert.strictEqual(none.in_yard, inYard.filter(r => !r.seller).length);
  for (const r of rows) {
    const u = inYard.filter(x => (x.seller || 'Not recorded') === r.seller), n = s => u.filter(x => x.inv_status === s).length;
    assert.deepStrictEqual([r.in_yard, r.listed, r.not_listed, r.awarded, r.for_release, r.for_return], [u.length, n('Listed'), n('Not Listed'), n('Awarded'), n('For Release'), n('For Return')], r.seller);
  }
  assert.ok(rows.every(r => r.id === r.seller), 'a row id is the seller (the table keys its rows on it)');
  assert.deepStrictEqual(scr.sort, ['seller', 'asc']);
  const t = scr.totals(rows), sum = k => rows.reduce((a, r) => a + r[k], 0);
  assert.strictEqual(t.seller, 'Total');
  for (const k of ['in_yard', 'listed', 'not_listed', 'awarded', 'for_release', 'for_return']) assert.strictEqual(t[k], sum(k).toLocaleString('en-US'), k);
});
test('Inventory Summary Parking filter: multi-select narrows the count, works with the generic filter code, Reset clears it', () => {
  const P = load(), scr = P.byId['report/inventory-summary'], ui = P.U(scr.id), inYard = P.inventoryRows().filter(r => r.yard === 'In yard');
  const f = scr.filters.find(x => x.key === 'parking');
  assert.strictEqual(f.type, 'select'); assert.deepStrictEqual(f.options(), ['OPEN PARKING', 'STEEL PARKING', 'IMET PARKING', 'Not recorded']);
  const total = () => scr.rows().reduce((a, r) => a + r.in_yard, 0), shown = () => P.applyFilters(scr, scr.rows()).reduce((a, r) => a + r.in_yard, 0);
  assert.strictEqual(shown(), inYard.length, 'no pick: every unit in the yard');
  ui.applied = { parking: ['IMET PARKING', 'Not recorded'] };
  const want = inYard.filter(r => ['IMET PARKING', undefined, ''].includes(r.parking) || !r.parking).length;
  assert.strictEqual(total(), want, 'two picks add up (a unit without a parking location counts as Not recorded)'); assert.strictEqual(shown(), want, 'the generic filter keeps every aggregate row');
  ui.applied = { parking: ['STEEL PARKING'] }; assert.strictEqual(total(), inYard.filter(r => r.parking === 'STEEL PARKING').length);
  assert.ok(scr.rows().every(r => r.in_yard > 0), 'sellers with no unit in that parking drop out');
  ui.applied = { parking: 'OPEN PARKING' }; assert.strictEqual(total(), inYard.filter(r => r.parking === 'OPEN PARKING').length, 'a plain string counts as one pick');
  ui.filters = { parking: ['IMET PARKING'] }; ui.applied = { parking: ['IMET PARKING'] };
  try { P.ACTIONS.resetFilter(scr); } catch (e) { /* DOM stub: render() throws after the state is reset */ }
  assert.deepStrictEqual([ui.filters, ui.applied], [{}, {}]); assert.strictEqual(total(), inYard.length, 'Reset: every unit again');
  assert.match(P.dataCard(scr, scr.title), /<tfoot><tr><td[^>]*>Total<\/td>/, 'the Total row sits under the table');
});
test('Inventory Summary table: Total row, integer cells, no empty state while units are in the yard', () => {
  const P = load(), scr = P.byId['report/inventory-summary'], html = P.dataCard(scr, scr.title);
  assert.match(html, /<tfoot>/); assert.match(html, />Total<\/td>/); assert.doesNotMatch(html, /No records to show/);
  const inYard = P.inventoryRows().filter(r => r.yard === 'In yard').length;
  assert.ok(html.includes(`>${inYard.toLocaleString('en-US')}</td>`), 'the In Yard total shows');
  for (const h of ['Seller', 'In Yard', 'Listed', 'Not Listed', 'Awarded', 'For Release', 'For Return']) assert.ok(html.includes(`<span>${h}</span>`), h);
  assert.match(html, /aria-label="Inventory Summary"/);
});

test('Cancellation Monitoring columns, sort, filters and totals', () => {
  const P = load(), scr = P.byId['report/cancellation-monitoring'], rows = scr.rows();
  assert.strictEqual(scr.dept, 'Report');
  assert.deepStrictEqual(scr.cols.map(c => c.label), ['Auction No.', 'Lot', 'Customer Name', 'Buyer ID', 'Plate Number', 'Seller', 'Date Cancelled', 'Waived?', 'Justification', 'Penalty', 'Billing Date', 'Date Paid', 'Cancellation Fee Remitted']);
  assert.deepStrictEqual(scr.cols.map(c => c.key), ['auction', 'lot', 'customer', 'cid', 'plate', 'seller', 'dcancel', 'waived', 'just', 'penalty', 'bill_date', 'paid_date', 'remitted']);
  assert.ok(rows.length && scr.cols.every(c => rows.some(r => c.key in r)), 'every column key is a field the cancellation rows carry');
  assert.deepStrictEqual(scr.sort, ['auction', 'desc']);   // opens latest auction first (user request, 27 Oct 2026)
  assert.deepStrictEqual(scr.filters.map(f => f.key), ['auction', 'customer', 'plate', 'seller', 'waived']);
  const t = scr.totals(rows); assert.strictEqual(t.customer, `${rows.length} cancellations`);
  assert.strictEqual(t.penalty, P.CX().reduce((a, r) => a + r.penalty, 0).toLocaleString('en-US', { minimumFractionDigits: 2 }));
  assert.strictEqual(rows.length, P.CX().length, 'every cancellation');
});
test('Cancellation Monitoring filters: Waived and Seller are multi-select, Customer / Buyer ID searches both', () => {
  const P = load(), scr = P.byId['report/cancellation-monitoring'], rows = scr.rows(), ui = P.U(scr.id);
  const pick = a => { ui.applied = a; return P.applyFilters(scr, rows); };
  const yes = pick({ waived: ['Yes'] }), no = pick({ waived: ['No'] });
  assert.ok(yes.length && yes.every(r => r.waived)); assert.ok(no.length && no.every(r => !r.waived)); assert.strictEqual(pick({ waived: ['Yes', 'No'] }).length, rows.length);
  assert.strictEqual(pick({ waived: 'Yes' }).length, yes.length, 'a plain string still counts as one pick');
  const c = rows[0]; assert.ok(pick({ customer: c.cid }).every(r => r.cid === c.cid) && pick({ customer: c.cid }).length >= 1, 'Buyer ID');
  assert.ok(pick({ customer: c.customer.slice(0, 6) }).some(r => r.id === c.id), 'customer name');
  assert.ok(pick({ plate: c.plate.toLowerCase() }).some(r => r.id === c.id), 'plate');
  const a = pick({ auction: String(c.auction) }); assert.ok(a.some(r => r.id === c.id) && a.every(r => r.auction === c.auction), 'Auction No.'); assert.strictEqual(pick({ auction: '22' }).length, 0, 'Auction No. is an exact match');
  const opts = scr.filters.find(f => f.key === 'seller').options();
  assert.deepStrictEqual(opts, [...Object.keys(P.SELLER).sort(), 'Not recorded'], 'codes first, Not recorded last');
  const sellers = [...new Set(rows.map(r => r.seller).filter(Boolean))]; assert.ok(sellers.length >= 2, 'at least two sellers in the data to pick');
  const two = pick({ seller: sellers.slice(0, 2) }); assert.deepStrictEqual(two.map(r => r.id), rows.filter(r => sellers.slice(0, 2).includes(r.seller)).map(r => r.id));
  assert.deepStrictEqual(pick({ seller: ['Not recorded'] }).map(r => r.id), rows.filter(r => !r.seller).map(r => r.id), 'cancellations whose seller is unknown');
  assert.ok(rows.filter(r => !r.seller).length > 0 && pick({ seller: ['Not recorded', sellers[0]] }).length === rows.filter(r => !r.seller || r.seller === sellers[0]).length);
  assert.strictEqual(pick({}).length, rows.length);
});
test('Cancellation Monitoring: latest auction first, table shows the penalty total, no row buttons', () => {
  const P = load(), scr = P.byId['report/cancellation-monitoring'], ui = P.U(scr.id);
  assert.deepStrictEqual(ui.sort, ['auction', 'desc']);   // opens latest auction first (user request, 27 Oct 2026)
  const html = P.dataCard(scr, scr.title);
  assert.match(html, /<tfoot>/); assert.ok(html.includes(`${scr.rows().length} cancellations`)); assert.doesNotMatch(html, /data-act=/, 'view only: no buttons');
  for (const h of ['Auction No.', 'Buyer ID', 'Seller', 'Waived?', 'Penalty', 'Cancellation Fee Remitted']) assert.ok(html.includes(`<span>${h}</span>`), h);
  const aus = P.sortRows(scr, P.applyFilters(scr, scr.rows())).map(r => r.auction).filter(a => a != null && a !== '').map(Number); assert.ok(aus.length > 1 && aus.every((a, i) => i === 0 || aus[i - 1] >= a), 'Auction No., latest first');
});
test('Cancellation Monitoring and Inventory Summary: listed under Report in the sidebar and on Home, switch on or off (no New mark since 26 Oct 2026)', () => {
  const P = load();
  for (const on of [false, true]) {
    P.setProposed(on);
    const side = P.sideHtml(''), home = P.homeLayout(), card = home.split('<section class="hcard">').find(c => c.includes('<b>Report</b>'));
    for (const id of ['report/inventory-summary', 'report/cancellation-monitoring']) {
      const s = P.byId[id], n = s.rows().length.toLocaleString();
      assert.match(grp(side, 'Report'), new RegExp(`href="#/${id}"[^>]*>${s.title}<span class="cnt">${n}</span>`), `${id} sidebar, switch ${on}`);
      assert.match(card, new RegExp(`href="#/${id}">${s.title}<span class="cnt">${n}</span>`), `${id} Home, switch ${on}`);
    }
    for (const d of ['FAD', 'SMD']) assert.doesNotMatch(grp(side, d), /Cancellation Monitoring/, `${d} sidebar has no Cancellation Monitoring`);
    const sub = card.match(/<p class="sub"[^>]*>([^<]*)<\/p>/)[1];
    for (const w of ['Inventory', 'cancellation']) assert.match(sub, new RegExp(w, 'i'), `Report card subtitle mentions ${w}: ${sub}`);
  }
});
test('Cancellation Monitoring and Inventory Summary: page head is Home > Report > title; old links open the new screen', () => {
  const P = load();
  for (const id of ['report/inventory-summary', 'report/cancellation-monitoring']) assert.match(P.pageHead(P.byId[id]), new RegExp(`Home</a>›<span>Report</span>›<b>${P.byId[id].title}</b>`), id);
  assert.strictEqual(P.MOVED['FAD/cancellation-monitoring'], 'report/cancellation-monitoring'); assert.strictEqual(P.MOVED['SMD/cancellation-monitoring'], 'report/cancellation-monitoring');
  assert.strictEqual(P.routeOf('report/inventory-summary'), 'report/inventory-summary');
  const all = P.SCREENS.map(s => s.id); assert.strictEqual(new Set(all).size, all.length, 'screen ids are unique');
});
test('Inventory Summary agrees with Inventory Monitoring: every seller x status x parking pick equals the rows that screen returns through its own filters', () => {
  const P = load(), sum = P.byId['report/inventory-summary'], inv = P.byId['report/inventory-monitoring'], all = inv.rows();
  const sellers = inv.filters.find(f => f.key === 'seller').options(), statuses = { Listed: 'listed', 'Not Listed': 'not_listed', Awarded: 'awarded', 'For Release': 'for_release', 'For Return': 'for_return' };
  const monitoring = (pick, seller, status) => { P.U(inv.id).applied = Object.assign({ yard: ['In yard'] }, seller ? { seller: [seller] } : {}, status ? { inv_status: [status] } : {}, pick.length ? { parking: pick } : {}); return P.applyFilters(inv, all).length; };
  let compared = 0;
  for (const pick of [[], ['OPEN PARKING'], ['STEEL PARKING'], ['IMET PARKING'], ['Not recorded'], ['IMET PARKING', 'Not recorded'], ['OPEN PARKING', 'STEEL PARKING', 'IMET PARKING', 'Not recorded']]) {
    P.U(sum.id).applied = pick.length ? { parking: pick } : {};
    const rows = sum.rows(), by = Object.fromEntries(rows.map(r => [r.seller, r]));
    assert.strictEqual(rows.reduce((a, r) => a + r.in_yard, 0), monitoring(pick), `units, parking ${pick}`);
    for (const seller of sellers) {
      assert.strictEqual(by[seller]?.in_yard ?? 0, monitoring(pick, seller), `${seller} in yard, parking ${pick}`); compared++;
      for (const [status, key] of Object.entries(statuses)) { assert.strictEqual(by[seller]?.[key] ?? 0, monitoring(pick, seller, status), `${seller} ${status}, parking ${pick}`); compared++; }
    }
    assert.deepStrictEqual(Object.keys(by).filter(k => !sellers.includes(k)), [], 'no seller row Inventory Monitoring cannot filter on');
  }
  assert.ok(compared > 300, 'a real comparison: ' + compared);
});
test('menu counts do not follow the Parking pick of Inventory Summary (sidebar, Home), switch on or off', () => {
  const P = load(), scr = P.byId['report/inventory-summary'], whole = scr.rows().length;
  P.U(scr.id).applied = { parking: ['IMET PARKING', 'Not recorded'] };
  assert.ok(scr.rows().length < whole, 'the pick narrows the table');
  for (const on of [false, true]) {
    P.setProposed(on);
    const side = grp(P.sideHtml(''), 'Report'), card = P.homeLayout().split('<section class="hcard">').find(c => c.includes('<b>Report</b>'));
    assert.match(side, new RegExp(`href="#/report/inventory-summary"[^>]*>Inventory Summary<span class="cnt">${whole}</span>`), `sidebar, switch ${on}`);
    assert.match(card, new RegExp(`href="#/report/inventory-summary">Inventory Summary<span class="cnt">${whole}</span>`), `Home, switch ${on}`);
  }
  assert.strictEqual(P.countOf(scr), whole); assert.strictEqual(P.countOf(P.byId['report/cancellation-monitoring']), P.CX().length, 'other screens count their rows');
});
