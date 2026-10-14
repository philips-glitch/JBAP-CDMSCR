const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness');
const P = load();
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
  const vrf = P.recordRelease(scr, v, { date: P.TODAY, to: v.customer, type: 'Sold', items: ['No. of Keys'] });
  assert.strictEqual(vrf, '04583'); assert.strictEqual(P.D.meta.company.next.vrf, 4584); assert.strictEqual(v._raw.release, P.TODAY);
  const h = P.REPORTS.releaseForm(P.enrichV(v._raw), { date: P.TODAY, to: v.customer, type: 'Sold', items: ['No. of Keys'] }, vrf);
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
  assert.match(scr.emptyNote(), /SMD is view-only/);
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
