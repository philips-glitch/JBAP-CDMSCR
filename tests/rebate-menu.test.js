const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness');
// User request, 20 Oct 2026: Rebate Payable moves to SMD; FAD keeps only Rebate Monitoring; SMD gets the menu "Rebate" with the tabs Rebate Monitoring and Rebate Payable
const deptMenu = (h, dept) => h.split(`id="grp-${dept}"`)[1].split('data-group=')[0];
const perDept = P => P.SCREENS.reduce((a, s) => Object.assign(a, { [s.dept]: (a[s.dept] || 0) + 1 }), {});
test('FAD has Rebate Monitoring as a plain menu entry: no Rebate Payable, no Rebate group, Download report kept, no New badge', () => {
  const P = load(), fad = P.byId['FAD/rebate-monitoring'];
  assert.ok(fad && fad.dept === 'FAD' && fad.title === 'Rebate Monitoring');
  assert.strictEqual(P.byId['FAD/rebate-payable'], undefined, 'FAD has no Rebate Payable');
  assert.ok(!P.SCREENS.some(s => s.dept === 'FAD' && (s.group === 'Rebate' || /Rebate Payable/.test(s.title))), 'no Rebate group, no Rebate Payable in FAD');
  assert.strictEqual(fad.group, undefined); assert.strictEqual(P.groupOf(fad), null);
  assert.deepStrictEqual(fad.buttons.map(b => [b.act, b.view]), [['downloadRebate', true]], 'Download report stays on FAD');
  assert.ok(!fad.isNew, 'the FAD screen itself is unchanged: no badge');
  const side = deptMenu(P.sideHtml('FAD/rebate-monitoring'), 'FAD');
  assert.match(side, new RegExp(`<a class="mis is-active" href="#/FAD/rebate-monitoring" aria-current="page">Rebate Monitoring<span class="cnt">${fad.rows().length}</span></a>`), 'one entry with its own record count');
  assert.doesNotMatch(side, /Rebate Payable|>Rebate</, 'no Rebate Payable and no Rebate group entry in the FAD menu');
  const head = P.pageHead(fad);
  assert.match(head, /<h1>Rebate Monitoring<\/h1>/); assert.doesNotMatch(head, /class="tabs"/); assert.match(head, /<span>FAD<\/span>›<b>Rebate Monitoring<\/b>/);
  assert.match(P.dataCard(fad, 'x'), /data-act="downloadRebate"/);
  const home = P.homeLayout(); assert.doesNotMatch(home, /href="#\/FAD\/rebate-payable"/); assert.match(home, /href="#\/FAD\/rebate-monitoring">Rebate Monitoring<span class="cnt">/);
});
test('SMD Rebate group: Rebate Monitoring then Rebate Payable, both New, one menu entry linking to the first tab', () => {
  const P = load(), group = P.SCREENS.filter(s => s.dept === 'SMD' && s.group === 'Rebate');
  assert.deepStrictEqual(group.map(s => s.id), ['SMD/rebate-monitoring', 'SMD/rebate-payable'], 'tab order');
  assert.deepStrictEqual(group.map(s => s.title), ['Rebate Monitoring', 'Rebate Payable']);
  assert.ok(group.every(s => s.isNew && !s.tag), 'both tabs carry the New badge');
  const side = deptMenu(P.sideHtml('SMD/rebate-payable'), 'SMD');
  assert.match(side, /<a class="mis is-active" href="#\/SMD\/rebate-monitoring" aria-current="page">Rebate<span class="ptag mini new"[^>]*>New<\/span><\/a>/, 'the group entry shows New and is active on the second tab');
  assert.ok(!side.includes('href="#/SMD/rebate-payable"') && !/>Rebate (Monitoring|Payable)</.test(side), 'the tabs are not separate menu entries');
  const head = P.pageHead(P.byId['SMD/rebate-payable']);
  assert.match(head, /<h1>Rebate<span class="ptag new"/); assert.match(head, /<span>SMD<\/span>›<span>Rebate<\/span>›<b>Rebate Payable<\/b>/);
  assert.ok(head.indexOf('href="#/SMD/rebate-monitoring" class="tab"') < head.indexOf('href="#/SMD/rebate-payable" class="tab is-active"'), 'Rebate Monitoring tab comes first');
  const home = P.homeLayout(); assert.match(home, /href="#\/SMD\/rebate-monitoring">Rebate › Rebate Monitoring<span class="ptag mini new"/); assert.match(home, /href="#\/SMD\/rebate-payable">Rebate › Rebate Payable<span class="ptag mini new"/);
});
test('screens per department: FAD 16, SMD 10 (total still 38, with the switch off and on)', () => {
  const P = load();
  assert.deepStrictEqual(perDept(P), { Customer: 1, Report: 5, FAD: 16, SMD: 10, VWD: 4, Settings: 1, LOG: 1 });
  assert.strictEqual(P.SCREENS.length, 38); assert.strictEqual(P.SCREENS.filter(P.shown).length, 38);
  P.setProposed(true); assert.strictEqual(P.SCREENS.filter(P.shown).length, 38);
});
test('SMD Rebate Monitoring is the live list FAD shows: same rows, same columns (shared definition), totals, sort; view only, no Download report', () => {
  const P = load(), fad = P.byId['FAD/rebate-monitoring'], smd = P.byId['SMD/rebate-monitoring'];
  assert.deepStrictEqual(smd.rows().map(r => r.id), fad.rows().map(r => r.id), 'same rows in the same order');
  assert.ok(smd.rows().length > 0);
  assert.deepStrictEqual(smd.cols.map(c => c.key), fad.cols.map(c => c.key)); assert.deepStrictEqual(smd.cols.map(c => c.label), fad.cols.map(c => c.label));
  assert.ok(smd.cols.map(c => c.key).includes('rebate_approved'), 'with Rebate Approved (President)');
  assert.strictEqual(smd.cols, fad.cols, 'the column definitions are shared, so they stay equal');
  assert.deepStrictEqual(smd.sort, fad.sort); assert.deepStrictEqual(smd.totals(smd.rows()), fad.totals(fad.rows()), 'same totals row');
  assert.strictEqual(smd.totals(smd.rows()).plate, `${smd.rows().length} lots`);
  assert.deepStrictEqual(P.colsOf(smd).map(c => c.key), P.colsOf(fad).map(c => c.key), 'same columns with the switch off');
  assert.deepStrictEqual(smd.actions, fad.actions); assert.ok(!smd.actions.includes('Update'), 'view only');
  assert.ok(!(smd.buttons || []).length, 'no Download report on SMD'); assert.doesNotMatch(P.dataCard(smd, 'x'), /data-act=/);
  assert.deepStrictEqual(P.sortRows(smd, P.applyFilters(smd, smd.rows()).reverse()).map(r => r.id), P.sortRows(fad, P.applyFilters(fad, fad.rows()).reverse()).map(r => r.id), 'same sorting and filtering');
  // live: a rebate recorded on a sold lot shows on both lists, and is no longer the legacy snapshot
  const lot = P.sold().find(v => !v.rebate), n = smd.rows().length;
  P.S.veh.find(x => x.id === lot.id).rebate = 1234;
  assert.strictEqual(smd.rows().length, n + 1); assert.strictEqual(fad.rows().length, n + 1); assert.ok(smd.rows().some(r => r.id === lot.id));
  assert.strictEqual(P.countOf(smd), n + 1);
});
test('SMD Rebate Payable is the FAD screen moved: same rows, columns and checks; Rebate Paid saves and is logged under SMD', () => {
  const P = load(), scr = P.byId['SMD/rebate-payable'];
  assert.ok(scr && scr.dept === 'SMD' && scr.group === 'Rebate' && scr.title === 'Rebate Payable');
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
  assert.strictEqual(P.byId['FAD/rebate-monitoring'].rows().find(x => x.id === r.id).rebate_paid, P.TODAY, 'and shows as Date Remitted on Rebate Monitoring (FAD and SMD)');
  assert.strictEqual(P.byId['SMD/rebate-monitoring'].rows().find(x => x.id === r.id).rebate_paid, P.TODAY);
  const logged = P.S.log.slice(before);
  assert.strictEqual(logged.length, 1); assert.deepStrictEqual([logged[0].module, logged[0].screen, logged[0].action, logged[0].field, logged[0].old, logged[0].new], ['SMD', 'Rebate Payable', 'Update', 'Rebate Paid', '', P.fmtDate(P.TODAY)]);
});
test('Save changes on SMD Rebate Payable through the screen action: toast note and Log Activity row under SMD', () => {
  const P = load(), scr = P.byId['SMD/rebate-payable'], r = scr.rows()[0], before = P.S.log.length;
  P.U(scr.id).edits[r.id] = { rebate_paid: P.TODAY };
  assert.strictEqual(scr.savedNote, 'Paid rebates removed from the list.');
  P.applyEdits(scr);
  const row = P.S.log[P.S.log.length - 1]; assert.ok(P.S.log.length === before + 1 && row.module === 'SMD');
  P.U('log-activity').applied.module = 'SMD'; assert.ok(P.byId['log-activity'].rows().some(l => l.id === row.id && l.screen === 'Rebate Payable'), 'visible under the SMD module filter');
});
test('the old FAD Rebate Payable link opens SMD Rebate Payable and rewrites the address bar', () => {
  const P = load(), calls = [], had = 'history' in globalThis, prev = globalThis.history;
  assert.strictEqual(P.MOVED['FAD/rebate-payable'], 'SMD/rebate-payable'); assert.strictEqual(P.routeOf('FAD/rebate-payable'), 'SMD/rebate-payable');
  assert.strictEqual(P.routeOf('FAD/rebate-monitoring'), 'FAD/rebate-monitoring', 'FAD Rebate Monitoring keeps its link'); assert.strictEqual(P.routeOf('SMD/rebate-monitoring'), 'SMD/rebate-monitoring', 'SMD Rebate Monitoring keeps its id');
  globalThis.history = { replaceState: (...a) => calls.push(a) };
  try { P.location.hash = '#/FAD/rebate-payable'; assert.strictEqual(P.route(), 'SMD/rebate-payable'); assert.deepStrictEqual(calls, [[null, '', '#/SMD/rebate-payable']], 'the address bar shows the new link'); }
  finally { if (had) globalThis.history = prev; else delete globalThis.history; }
});
test('texts: SMD Rebate Monitoring and Rebate Payable are live; Rebate Paid is recorded by SMD', () => {
  const P = load(), card = P.homeLayout().split('<section class="hcard">').find(h => h.includes('<b>SMD</b>')), sub = card.match(/<p class="sub"[^>]*>([^<]*)<\/p>/)[1];
  const [legacy, live] = sub.split('Live data:');
  assert.match(legacy, /Legacy sample data: Pending Awarding, Unpaid, Seller Acknowledgement, For Dispatch\.\s*$/); assert.doesNotMatch(legacy, /Rebate/, 'Rebate Monitoring is no longer a legacy screen');
  assert.match(live, /Seller Awarding Acknowledgement, Unreleased Unit, Rebate Monitoring, Rebate Payable, Return to Seller, SMD Manager Approval/, 'both Rebate screens are listed as live');
  const saaf = P.byId['SMD/saaf'].rule;
  assert.match(saaf, /Pending Awarding, Unpaid, Seller Acknowledgement and For Dispatch in SMD still show the legacy sample/); assert.doesNotMatch(saaf, /Rebate Monitoring/);
  const log = P.byId['log-activity']; assert.match(log.rule, /SMD entries come from Return to Seller clearances and approvals, the SAAF and Rebate Paid/);
  P.U('log-activity').applied.module = 'SMD'; assert.match(log.emptyNote(), /Return to Seller[^]*SAAF[^]*Rebate Paid/);
  for (const id of ['SMD/pending-awarding', 'SMD/unpaid', 'SMD/seller-acknowledgement', 'SMD/for-dispatch']) assert.ok(P.byId[id].rows().length > 0, `${id} is still the legacy sample`);
  const rule = P.byId['SMD/rebate-monitoring'].rule; assert.doesNotMatch(rule, /legacy|snapshot/i); assert.match(rule, /live/i); assert.match(rule, /view only/i);
  assert.match(P.byId['SMD/rebate-payable'].rule, /SMD records Rebate Paid/);
  const src = ['app.js', 'reports.js', 'data-extra.js', 'index.html'].map(f => require('fs').readFileSync(require('path').join(__dirname, '..', f), 'utf8')).join('\n');
  assert.doesNotMatch(src, /FAD › Rebate(?! Monitoring)|FAD Rebate Payable|FAD › Rebate Payable|Rebate Monitoring and Rebate Payable as two tabs of/, 'no text still puts Rebate Payable in FAD');
  assert.doesNotMatch(src, /For Dispatch and Rebate Monitoring|For Dispatch, Rebate Monitoring/, 'no text still lists Rebate Monitoring as a legacy SMD screen');
});
