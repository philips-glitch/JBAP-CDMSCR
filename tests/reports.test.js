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
