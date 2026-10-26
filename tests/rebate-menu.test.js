const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness');
// JBAP feedback, 26 Oct 2026: Rebate Monitoring and Liability to Seller move to the Report menu; Rebate Payable is back in FAD (FAD records Rebate Paid); SMD has no Rebate menu
// (it reverses the user request of 20 Oct 2026, when SMD got a Rebate menu with Rebate Monitoring and Rebate Payable)
const deptMenu = (h, dept) => h.split(`id="grp-${dept}"`)[1].split('data-group=')[0];
const perDept = P => P.SCREENS.reduce((a, s) => Object.assign(a, { [s.dept]: (a[s.dept] || 0) + 1 }), {});
test('Report holds Rebate Monitoring (Download report kept) and Liability to Seller; FAD and SMD list neither, nor a Rebate group', () => {
  const P = load(), rm = P.byId['report/rebate-monitoring'], li = P.byId['report/liability-to-seller'];
  assert.ok(rm && rm.dept === 'Report' && rm.title === 'Rebate Monitoring' && li && li.dept === 'Report' && li.title === 'Liability to Seller');
  assert.strictEqual(rm.group, undefined); assert.strictEqual(P.groupOf(rm), null);
  assert.deepStrictEqual(rm.buttons.map(b => [b.act, b.view]), [['downloadRebate', true]], 'Download report moves with the screen');
  assert.deepStrictEqual(P.SCREENS.filter(s => s.dept === 'Report').map(s => s.id).slice(-3), ['report/cancellation-monitoring', 'report/rebate-monitoring', 'report/liability-to-seller'], 'in the Report menu after Cancellation Monitoring');
  const side = deptMenu(P.sideHtml('report/rebate-monitoring'), 'Report');
  assert.match(side, new RegExp(`<a class="mis is-active" href="#/report/rebate-monitoring" aria-current="page">Rebate Monitoring<span class="ptag mini new"[^>]*>New</span><span class="cnt">${rm.rows().length}</span></a>`), 'one entry with its own record count');
  assert.match(deptMenu(P.sideHtml(''), 'Report'), new RegExp(`href="#/report/liability-to-seller" >Liability to Seller<span class="ptag mini new"[^>]*>New</span><span class="cnt">${li.rows().length}</span></a>`));
  for (const d of ['FAD', 'SMD']) assert.doesNotMatch(deptMenu(P.sideHtml(''), d), />(Rebate Monitoring|Liability to Seller|Rebate)</, `no moved screen and no Rebate group in the ${d} menu`);
  assert.ok(!P.SCREENS.some(s => s.group === 'Rebate'), 'no Rebate group anywhere');
  const head = P.pageHead(rm);
  assert.match(head, /<h1>Rebate Monitoring<span class="ptag new"/); assert.doesNotMatch(head, /class="tabs"/); assert.match(head, /<span>Report<\/span>›<b>Rebate Monitoring<\/b>/);
  assert.match(P.dataCard(rm, 'x'), /data-act="downloadRebate"/);
  assert.match(P.pageHead(li), /<span>Report<\/span>›<b>Liability to Seller<\/b>/);
  const home = P.homeLayout();
  assert.match(home, /href="#\/report\/rebate-monitoring">Rebate Monitoring<span class="ptag mini new"/); assert.match(home, /href="#\/report\/liability-to-seller">Liability to Seller<span class="ptag mini new"/);
  assert.match(home, /href="#\/FAD\/rebate-payable">Rebate Payable<span class="ptag mini new"/); assert.doesNotMatch(home, /Rebate ›/);
});
test('screens per department: Report 7, FAD 14, SMD 9 (total 37, with the switch off and on)', () => {
  const P = load();
  assert.deepStrictEqual(perDept(P), { Customer: 1, Report: 7, FAD: 14, SMD: 9, VWD: 4, Settings: 1, LOG: 1 });
  assert.strictEqual(P.SCREENS.length, 37); assert.strictEqual(P.SCREENS.filter(P.shown).length, 37);
  P.setProposed(true); assert.strictEqual(P.SCREENS.filter(P.shown).length, 37);
});
test('Report › Rebate Monitoring is the live list of rebates: shared columns, totals, sort; Rebate Approved (President) read only', () => {
  const P = load(), rm = P.byId['report/rebate-monitoring'];
  assert.ok(rm.rows().length > 0 && rm.rows().every(r => r.rebate && r.status === 'Sold'));
  assert.deepStrictEqual(rm.cols.map(c => c.key), ['auction', 'lot', 'plate', 'model', 'seller', 'customer', 'min_bid', 'highest_offer', 'rebate', 'rebate_approved', 'com', 'rebate_revenue', 'rebate_paid']);
  assert.ok(!rm.cols.some(c => c.edit) && !rm.actions.includes('Update'), 'view only');
  assert.deepStrictEqual(rm.sort, ['auction_lot', 'desc']); assert.strictEqual(rm.totals(rm.rows()).plate, `${rm.rows().length} lots`);
  // live: a rebate recorded on a sold lot shows on the list at once
  const lot = P.sold().find(v => !v.rebate), n = rm.rows().length;
  P.S.veh.find(x => x.id === lot.id).rebate = 1234;
  assert.strictEqual(rm.rows().length, n + 1); assert.ok(rm.rows().some(r => r.id === lot.id)); assert.strictEqual(P.countOf(rm), n + 1);
});
test('FAD Rebate Payable (back from SMD): same rows, columns and checks; Rebate Paid saves and is logged under FAD', () => {
  const P = load(), scr = P.byId['FAD/rebate-payable'];
  assert.ok(scr && scr.dept === 'FAD' && scr.group === undefined && scr.title === 'Rebate Payable');
  assert.deepStrictEqual(scr.actions, ['View', 'Sort', 'Update']);
  assert.match(scr.rule, /status SOLD, a rebate, a Buyer Paid date, and a blank Rebate Paid date/);
  assert.deepStrictEqual(scr.cols.map(c => [c.label, c.key, !!c.edit]), [['Auction Date', 'adate', false], ['Lot', 'lot', false], ['Customer Name', 'customer', false], ['Rebate', 'rebate', false], ['Buyer Paid', 'buyer_paid', false], ['Rebate Paid', 'rebate_paid', true]]);
  assert.deepStrictEqual(scr.buttons.map(b => b.act), ['save']);
  const want = P.sold().filter(v => v.rebate && v.buyer_paid && !v.rebate_paid).map(v => v.id).sort();
  assert.ok(want.length > 0); assert.deepStrictEqual(scr.rows().map(r => r.id).sort(), want, 'sold lots with a rebate, a Buyer Paid date and no Rebate Paid');
  const fmt = x => x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  assert.deepStrictEqual(scr.totals(scr.rows()), { rebate: fmt(scr.rows().reduce((a, x) => a + x.rebate, 0)) }, 'totals row: the rebate sum');
  const r = scr.rows()[0], rows = scr.rows(), before = P.S.log.length;
  assert.match(scr.validate(r, { rebate_paid: '2999-01-01' }).rebate_paid, /after today/, 'not in the future');
  assert.match(scr.validate(r, { rebate_paid: '2000-01-01' }).rebate_paid, /before Buyer Paid/, 'not before Buyer Paid');
  assert.strictEqual(scr.validate(r, { rebate_paid: P.TODAY }).rebate_paid, null);
  P.U(scr.id).edits[r.id] = { rebate_paid: '2999-01-01' }; assert.strictEqual(P.validateEdits(scr).length, 1, 'a future date blocks Save');
  P.U(scr.id).edits[r.id] = { rebate_paid: P.TODAY }; assert.deepStrictEqual(P.validateEdits(scr), []);
  assert.strictEqual(P.applyEdits(scr), 1); assert.strictEqual(r._raw.rebate_paid, P.TODAY, 'Rebate Paid saved on the lot');
  assert.ok(!scr.rows().some(x => x.id === r.id) && scr.rows().length === rows.length - 1, 'the paid rebate leaves the list');
  assert.strictEqual(P.byId['report/rebate-monitoring'].rows().find(x => x.id === r.id).rebate_paid, P.TODAY, 'and shows as Date Remitted on Report › Rebate Monitoring');
  const logged = P.S.log.slice(before);
  assert.strictEqual(logged.length, 1); assert.deepStrictEqual([logged[0].module, logged[0].screen, logged[0].action, logged[0].field, logged[0].old, logged[0].new], ['FAD', 'Rebate Payable', 'Update', 'Rebate Paid', '', P.fmtDate(P.TODAY)]);
});
test('FAD Rebate Payable sits after Unreleased Unit in the FAD menu, with its count and New badge; Save changes logs a row under FAD', () => {
  const P = load(), scr = P.byId['FAD/rebate-payable'], ids = P.SCREENS.filter(s => s.dept === 'FAD').map(s => s.id);
  assert.strictEqual(ids[ids.indexOf('FAD/unreleased-unit') + 1], 'FAD/rebate-payable');
  assert.match(deptMenu(P.sideHtml('FAD/rebate-payable'), 'FAD'), new RegExp(`<a class="mis is-active" href="#/FAD/rebate-payable" aria-current="page">Rebate Payable<span class="ptag mini new"[^>]*>New</span><span class="cnt">${scr.rows().length}</span></a>`));
  const r = scr.rows()[0], before = P.S.log.length;
  P.U(scr.id).edits[r.id] = { rebate_paid: P.TODAY };
  assert.strictEqual(scr.savedNote, 'Paid rebates removed from the list.');
  P.applyEdits(scr);
  const row = P.S.log[P.S.log.length - 1]; assert.ok(P.S.log.length === before + 1 && row.module === 'FAD');
  P.U('log-activity').applied.module = 'FAD'; assert.ok(P.byId['log-activity'].rows().some(l => l.id === row.id && l.screen === 'Rebate Payable'), 'visible under the FAD module filter');
});
test('the old Rebate and Liability links open the new places and rewrite the address bar', () => {
  const P = load(), calls = [], had = 'history' in globalThis, prev = globalThis.history;
  const redirect = { 'FAD/rebate-monitoring': 'report/rebate-monitoring', 'SMD/rebate-monitoring': 'report/rebate-monitoring', 'SMD/rebate-payable': 'FAD/rebate-payable', 'FAD/liability-to-seller': 'report/liability-to-seller' };
  for (const [from, to] of Object.entries(redirect)) { assert.strictEqual(P.MOVED[from], to, from); assert.strictEqual(P.routeOf(from), to, from); }
  assert.strictEqual(P.MOVED['FAD/rebate-payable'], undefined, 'FAD Rebate Payable is a real screen again'); assert.strictEqual(P.routeOf('FAD/rebate-payable'), 'FAD/rebate-payable');
  globalThis.history = { replaceState: (...a) => calls.push(a) };
  try { P.location.hash = '#/SMD/rebate-payable'; assert.strictEqual(P.route(), 'FAD/rebate-payable'); assert.deepStrictEqual(calls, [[null, '', '#/FAD/rebate-payable']], 'the address bar shows the new link'); }
  finally { if (had) globalThis.history = prev; else delete globalThis.history; }
});
test('texts: SMD no longer lists Rebate screens; Home Report names rebates and liability; Rebate Paid is recorded by FAD again', () => {
  const P = load(), cards = P.homeLayout().split('<section class="hcard">'), sub = d => cards.find(h => h.includes(`<b>${d}</b>`)).match(/<p class="sub"[^>]*>([^<]*)<\/p>/)[1];
  const [legacy, live] = sub('SMD').split('Live data:');
  assert.match(legacy, /Legacy sample data: Pending Awarding, Unpaid, Seller Acknowledgement, For Dispatch\.\s*$/);
  assert.match(live, /Seller Awarding Acknowledgement, Unreleased Unit, Return to Seller, SMD Manager Approval\s*$/); assert.doesNotMatch(sub('SMD'), /Rebate/);
  assert.match(sub('Report'), /rebates/); assert.match(sub('Report'), /liability to sellers/);
  const saaf = P.byId['SMD/saaf'].rule;
  assert.match(saaf, /Pending Awarding, Unpaid, Seller Acknowledgement and For Dispatch in SMD still show the legacy sample/); assert.doesNotMatch(saaf, /Rebate/);
  const log = P.byId['log-activity']; assert.match(log.rule, /SMD entries come from Return to Seller clearances and approvals, the SAAF and Result Price \(saved rebates and cancelled sales\); FAD entries include Rebate Paid/); assert.doesNotMatch(log.rule, /SAAF and Rebate Paid/);
  P.U('log-activity').applied.module = 'SMD'; assert.doesNotMatch(log.emptyNote(), /Rebate Paid/); assert.match(log.emptyNote(), /Return to Seller[^]*SAAF/);
  for (const id of ['SMD/pending-awarding', 'SMD/unpaid', 'SMD/seller-acknowledgement', 'SMD/for-dispatch']) assert.ok(P.byId[id].rows().length > 0, `${id} is still the legacy sample`);
  assert.match(P.byId['FAD/rebate-payable'].rule, /FAD records Rebate Paid/); assert.match(P.byId['FAD/rebate-payable'].rule, /Report › Rebate Monitoring/);
  const src = ['app.js', 'reports.js', 'data-extra.js', 'index.html'].map(f => require('fs').readFileSync(require('path').join(__dirname, '..', f), 'utf8')).join('\n');
  assert.doesNotMatch(src, /SMD › Rebate|SMD Rebate|SMD records Rebate Paid|FAD › Rebate Monitoring|FAD Rebate Monitoring|FAD Liability|FAD › Liability/, 'no text still names the old places');
});
