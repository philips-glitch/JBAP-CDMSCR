const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness');
const P = load();
const groupBy = (rows, k) => { const g = {}; rows.forEach(r => (g[r[k]] ||= []).push(r)); return Object.values(g); };
// Read-only: renders every row that can reach each report as its app.js call site does, on fresh data (no record* calls)
test('render sweep: no report prints null, undefined or NaN', () => {
  const Q = load(), T = Q.TODAY, rows = id => Q.byId[id].rows(), co = Q.D.meta.company, out = [], add = (name, h) => out.push([name, h]);
  groupBy(rows('FAD/pending-awarding'), 'cid').forEach(list => {
    const b = { customer: list[0].customer, cid: list[0].cid, email: list[0].email }, award = list[0].awarding || T;
    const lots = list.map(r => Object.assign({}, r, { transfer_fee: Number(r.transfer_fee || 0) })), withRebate = lots.filter(r => r.rebate);
    add(`awarding ${b.cid}`, Q.REPORTS.awarding(b, lots, award));
    if (withRebate.length) add(`rebate ${b.cid}`, Q.REPORTS.rebate(b, withRebate, Q.addWorkdays(award, 3)));
    add(`BAAF email ${b.cid}`, Q.REPORTS.email({ from: co.emails.finance, to: `${b.customer} <${b.email}>`, cc: co.emails.sales, subject: `NOTICE OF AWARDING - ${Q.fmtDate(award)}`,
      atts: [{ key: `aw:${b.cid}`, name: 'JBAP AWARDING.pdf' }], body: 'Congratulations!!' }));
  });
  groupBy(rows('FAD/payment-seller'), 'seller').forEach(list => add(`payable ${list[0].seller}`, Q.REPORTS.payableToSeller(list[0].seller, list, T)));
  groupBy(rows('FAD/commission-billing'), 'seller').forEach(list => add(`billing ${list[0].seller}`, Q.REPORTS.billingComputation(list[0].seller, '999', T, list)));
  groupBy(rows('FAD/billing-monitoring'), 'customer').forEach(list => add(`transmittal ${list[0].customer}`, Q.REPORTS.billingTransmittal(list[0].customer, list, T)));
  groupBy(rows('FAD/for-dispatch'), 'cid').forEach(list => {
    const b = { customer: list[0].customer, cid: list[0].cid, email: list[0].email };
    add(`dispatch ${b.cid}`, Q.REPORTS.dispatchForm(b, list, T));
    add(`dispatch email ${b.cid}`, Q.REPORTS.email({ from: co.emails.finance, to: `${b.customer} <${b.email}>`, cc: `${co.emails.sales}; ${co.emails.vwd}; ${co.emails.finance}`,
      subject: 'JBAP VEHICLE FOR RELEASE', atts: [{ key: b.cid, name: 'VEHICLE DISPATCH.pdf' }], body: 'Vehicles for release' }));
  });
  [...rows('VWD/unreleased-unit'), ...rows('VWD/unreleased-unit-overdue')].forEach(v =>
    add(`release ${v.plate}`, Q.REPORTS.releaseForm(Q.enrichV(v._raw), { date: T, to: v.customer || '', type: 'Sold', items: [] }, '00001')));
  Q.cancelLetterGroups(rows('FAD/cancellation-billing')).forEach(list => add(`cancellation ${list[0].customer}`, Q.REPORTS.cancellationLetter({ customer: list[0].customer }, list, T)));
  rows('FAD/document-monitoring').forEach(v => add(`document ${v.plate}`, Q.REPORTS.documentTransmittal(Q.enrichV(v._raw), [], '', 'HRAD-ATF-0', '')));
  groupBy(rows('SMD/saaf'), 'seller').forEach(list => add(`saaf ${list[0].seller}`, Q.REPORTS.saaf(list[0].seller, list, T)));
  groupBy(rows('SMD/return-to-seller'), 'seller').forEach(list => add(`return ${list[0].seller}`, Q.REPORTS.returnClearance(list[0].seller, list, T)));
  for (const id of ['SMD/return-to-seller', 'SMD/saaf', 'FAD/pending-awarding', 'FAD/payment-seller', 'FAD/commission-billing', 'FAD/billing-monitoring', 'FAD/for-dispatch', 'VWD/unreleased-unit-overdue', 'FAD/cancellation-billing', 'FAD/document-monitoring'])
    assert.ok(rows(id).length > 0, `${id} has rows to render`);
  const bad = out.map(([name, h]) => [name, h.replace(/<[^>]*>/g, ' ').match(/.{0,30}(\bnull\b|undefined|NaN).{0,30}/)]).filter(([, m]) => m).map(([name, m]) => `${name}: ${m[0].trim()}`);
  assert.deepStrictEqual(bad, []);
  assert.strictEqual(Q.S.log.length, (Q.D.activityLog || []).length, 'the sweep records nothing');
});
const buyer = { customer: 'TEST BUYER', cid: 'B0001', email: 'b0001@buyers.example.com' };
const lot = (o = {}) => Object.assign({ adate: '09/21/2026 - 09/23/2026', model: 'TOYOTA VIOS XLE', plate: 'AAA1111', year: 2020, lot: '001', price: 400000, transfer_fee: 1000, rebate: 5000 }, o);
test('awarding: deadline, rows, grand total, placeholder bank, role signature', () => {
  const h = P.REPORTS.awarding(buyer, [lot(), lot({ plate: 'BBB2222', price: 300000 })], '2026-10-08');
  assert.match(h, /Buyer's Winning Bid Confirmation/); assert.match(h, /13 October 2026/);
  assert.match(h, /702,000\.00/); assert.match(h, /000-0-000-000-000 \(placeholder\)/); assert.match(h, /Finance and Admin Head/);
});
test('rebate: one row per lot with rebate and the total', () => {
  const h = P.REPORTS.rebate(buyer, [lot(), lot({ plate: 'BBB2222', rebate: 2500 })], '2026-10-13');
  assert.match(h, /Rebate Confirmation/); assert.match(h, /7,500\.00/); assert.match(h, /13 October 2026/);
});
test('email preview lists attachments as buttons', () => {
  const h = P.REPORTS.email({ from: 'a@x', to: 'b@x', cc: 'c@x', subject: 'S', body: 'Hello', atts: [{ key: 'k1', name: 'JBAP AWARDING.pdf' }] });
  assert.match(h, /data-att="k1"/); assert.match(h, /JBAP AWARDING\.pdf/);
});
test('date helpers', () => {
  assert.strictEqual(P.api.longDate('2026-10-12'), '12 October 2026');
  assert.strictEqual(P.api.shortDate('2026-10-12'), '12-Oct-26');
  assert.strictEqual(P.api.shortDate('2026-09-21'), '21-Sep-26');
});
test('payable to seller: totals equal the screen totals', () => {
  const rows = P.byId['FAD/payment-seller'].rows().filter(r => r.seller === 'EWB');
  const h = P.REPORTS.payableToSeller('EWB', rows, P.TODAY);
  assert.match(h, /Computation of Payable to Seller/);
  const fmt = n => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  assert.ok(h.includes(fmt(rows.reduce((a, r) => a + r.payable, 0))), 'payable total'); assert.ok(h.includes(fmt(rows.reduce((a, r) => a + r.to_jbap, 0))), 'to JBAP total');
});
test('billing computation: billing no, date and commission totals', () => {
  const rows = P.V().filter(r => ['NKC4711', 'NFM5719'].includes(r.plate));
  const h = P.REPORTS.billingComputation('SBC', '511', '2026-10-08', rows);
  assert.match(h, /Billing Computation/); assert.match(h, /511/); assert.match(h, /10\/08\/2026/); assert.match(h, /37,550\.00/);
});
test('billing transmittal: report lists each billing and recording sets the transmittal date', () => {
  const scr = P.byId['FAD/billing-monitoring'], rows = scr.rows().filter(b => !b.trans).slice(0, 2);
  const h = P.REPORTS.billingTransmittal(rows[0].customer, rows, P.TODAY);
  assert.match(h, /Transmittal of Documents/); for (const b of rows) assert.ok(h.includes(b.no));
  P.recordBillingTransmittal(scr, rows);
  for (const b of rows) assert.strictEqual(P.B().find(x => x.id === b.id).trans, P.TODAY);
});
test('dispatch form: deadline, remarks, location; recording moves the lot to Unreleased', () => {
  const scr = P.byId['FAD/for-dispatch'], r = scr.rows().find(x => x.plate === 'NKR1470');
  const h = P.REPORTS.dispatchForm({ customer: r.customer, cid: r.cid, email: r.email }, [r], '2026-10-08');
  assert.match(h, /Vehicle Dispatch Clearance Form/); assert.match(h, /13-Oct-26/); assert.match(h, /Required DOAS/); assert.match(h, /Pasay City/);
  P.recordDispatch(scr, [r], () => '2026-10-08');
  assert.ok(!scr.rows().some(x => x.plate === 'NKR1470'));
  assert.ok(P.byId['FAD/unreleased-unit'].rows().some(x => x.plate === 'NKR1470'));
});
test('VWD release: DOAS block, then release with the next VRF number', () => {
  const scr = P.byId['VWD/unreleased-unit'];
  const v = scr.rows().find(x => P.releaseOf(x) === 'doas') || P.V().find(x => P.releaseOf(x) === 'doas' && x.dispatch && !x.release && !(x.penalty > 0));
  v._raw.buyer_doas = null; assert.match(P.releaseBlock(P.enrichV(v._raw)), /DOAS/);
  v._raw.buyer_doas = v.buyer_paid; assert.strictEqual(P.releaseBlock(P.enrichV(v._raw)), null);
  const f = { date: P.TODAY, to: v.customer, type: 'Sold', items: ['No. of Keys', 'Spare Tire'] }, before = P.S.log.length;
  const vrf = P.recordRelease(scr, v, f);
  assert.strictEqual(vrf, '04583'); assert.strictEqual(P.D.meta.company.next.vrf, 4584); assert.strictEqual(v._raw.release, P.TODAY);
  const added = P.S.log.slice(before), entry = k => added.find(e => e.field === k) || {};
  assert.deepStrictEqual([entry('Released To').new, entry('Release Type').new, entry('Release Checklist').new], [v.customer, 'Sold', 'No. of Keys, Spare Tire']);
  assert.ok(added.every(e => e.module === 'VWD'), 'logged under VWD');
  const h = P.REPORTS.releaseForm(P.enrichV(v._raw), f, vrf);
  assert.match(h, /Vehicle Release Form/); assert.match(h, /Gate Pass/); assert.match(h, /04583/);
});
test('VWD release is blocked while a storage penalty is unpaid', () => {
  const v = P.byId['VWD/unreleased-unit-overdue'].rows().find(x => x.penalty > 0);
  assert.match(P.releaseBlock(v), /Storage penalty/);
});
test('Log Activity texts no longer call VWD view-only', () => {
  const scr = P.byId['log-activity'];
  assert.ok(!scr.rule.includes('VWD are view-only'), 'rule still says VWD is view-only');
  assert.match(scr.rule, /VWD entries come from vehicle releases/);
  P.U('log-activity').applied.module = 'VWD';
  assert.match(scr.emptyNote(), /releases/);
  P.U('log-activity').applied.module = 'SMD';
  assert.match(scr.emptyNote(), /Return to Seller/);
  delete P.U('log-activity').applied.module;
});
test('cancellation letter: penalty × units', () => {
  const rows = P.byId['FAD/cancellation-billing'].rows().slice(0, 2).map(r => Object.assign({}, r, { customer: 'TEST BUYER' }));
  const h = P.REPORTS.cancellationLetter({ customer: 'TEST BUYER' }, rows, '2026-10-08');
  assert.match(h, /Cancellation Fee Billing/); assert.match(h, /20,000\.00/); assert.match(h, /8 October 2026/);
});
test('cancellation letters: one letter per buyer name, even when some lots have no cid', () => {
  const rows = P.byId['FAD/cancellation-billing'].rows().filter(r => r.customer === 'ANGEL ANN CEREZO MONTES');
  assert.ok(rows.length >= 2, 'need at least two unbilled lots for this buyer');
  assert.ok(rows.some(r => !r.cid) && rows.some(r => r.cid), 'lots should mix cid and no cid');
  assert.strictEqual(P.cancelLetterGroups(rows).length, 1);
});
test('document transmittal: control number, checklist and saved documents', () => {
  const scr = P.byId['FAD/document-monitoring'], v = scr.rows()[0];
  v._raw.orig_docs = v.buyer_paid;
  const atf = P.recordDocTransmittal(scr, v, ['LTO Official Receipt', 'Spare Key'], 'Extra key fob');
  assert.strictEqual(atf, 'HRAD-ATF-8864'); assert.deepStrictEqual(v._raw.docs_received, ['LTO Official Receipt', 'Spare Key']);
  assert.strictEqual(P.recordDocTransmittal(scr, v, ['Spare Key'], ''), 'HRAD-ATF-8864', 'reprint keeps the number');
  const h = P.REPORTS.documentTransmittal(P.enrichV(v._raw), ['Spare Key'], 'Extra key fob', atf);
  assert.match(h, /Auction Transmittal Form/); assert.match(h, /HRAD-ATF-8864/); assert.strictEqual(P.DOC_TYPES.length, 19);
});
test('document transmittal: Others and Remarks are saved, logged and printed (escaped)', () => {
  const scr = P.byId['FAD/document-monitoring'], v = scr.rows()[1], before = P.S.log.length;
  const atf = P.recordDocTransmittal(scr, v, ['Spare Key', 'Others'], 'Extra key fob', 'Keys with VWD');
  assert.strictEqual(v._raw.docs_others, 'Extra key fob'); assert.strictEqual(v._raw.docs_remarks, 'Keys with VWD');
  const added = P.S.log.slice(before), entry = f => added.find(e => e.field === f);
  assert.strictEqual(entry('Documents Others').new, 'Extra key fob'); assert.strictEqual(entry('Documents Remarks').new, 'Keys with VWD');
  assert.ok(entry('Documents Received') && entry('ATF Control No.'), 'the existing fields are still logged');
  const h = P.REPORTS.documentTransmittal(P.enrichV(v._raw), ['Spare Key', 'Others'], 'Extra key fob', atf, 'Keys with VWD');
  assert.match(h, /Keys with VWD/); assert.match(h, /Others: Extra key fob/);
  const x = P.REPORTS.documentTransmittal(P.enrichV(v._raw), ['Spare Key'], '<b>x</b>', atf, '<i>r</i>');
  assert.match(x, /&lt;b&gt;x/); assert.match(x, /&lt;i&gt;r/); assert.doesNotMatch(x, /<b>x<\/b>/);
  assert.match(x, /rbox">✓<\/span>Others: /, 'typed Others text prints with the Others box ticked');
});
test('document transmittal keeps unsaved date edits on the row and clears only Print Transmittal?', () => {
  const scr = P.byId['FAD/document-monitoring'], [v, w] = scr.rows().slice(2), edits = P.U(scr.id).edits;
  edits[v.id] = { to_buyer: '2026-10-08', print_doc_trans: true }; edits[w.id] = { print_doc_trans: true };
  P.recordDocTransmittal(scr, v, ['Spare Key'], ''); P.recordDocTransmittal(scr, w, ['Spare Key'], '');
  assert.deepStrictEqual(edits[v.id], { to_buyer: '2026-10-08' });
  assert.ok(!(w.id in edits), 'a row with no other edit is no longer dirty');
  delete edits[v.id];
});
