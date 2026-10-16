const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness');
const P = load();
test('cancellation penalty split', () => {
  assert.deepStrictEqual(P.cancelSplit({ seller: 'SBC', waived: false }), { penalty: 10000, pen_seller: 5000, pen_jbap: 5000 });
  assert.deepStrictEqual(P.cancelSplit({ seller: 'EWB', waived: false }), { penalty: 10000, pen_seller: 0, pen_jbap: 10000 });
  assert.deepStrictEqual(P.cancelSplit({ seller: null, waived: true }), { penalty: 0, pen_seller: 0, pen_jbap: 0 });
});
test('recording the cancellation billing sets the amount to the penalty', () => {
  const scr = P.byId['FAD/cancellation-billing'], r = scr.rows().find(r => !r.bill_date);
  P.recordCancellationBilling(scr, [r]);
  const c = P.CX().find(x => x.id === r.id);
  assert.strictEqual(c.bill_date, P.TODAY); assert.strictEqual(c.amount, 10000);
});
test('storage penalty only for Pasay City / JBAP', () => {
  const v = P.S.veh.find(x => x.dispatch && !x.release && P.enrichV(x).penalty > 0);
  v.location = 'Cavite'; assert.strictEqual(P.enrichV(v).penalty, null);
  v.location = 'Pasay City'; assert.ok(P.enrichV(v).penalty > 0);
});
test('EWB lot cancelled without a seller on the record gives 0 to the seller', () => {
  const v = P.S.veh.find(x => x.seller === 'EWB' && !P.S.cancels.some(c => c.plate === x.plate && c.auction === x.auction));
  assert.ok(v, 'an EWB vehicle with no cancellation record');
  P.S.cancels.unshift({ id: `C-${v.auction}-${v.lot}-new`, auction: v.auction, lot: v.lot, plate: v.plate, customer: v.customer, cid: v.cid, dcancel: P.TODAY,
    waived: false, just: 'Did not pay', remitted: null, bill_date: null, paid_date: null, amount: null, for_print: false });
  const c = P.CX().find(x => x.id === `C-${v.auction}-${v.lot}-new`);
  assert.deepStrictEqual([c.penalty, c.pen_seller, c.pen_jbap], [10000, 0, 10000]);
});
test('Cancellation Billing & Payment defaults the amount to the penalty for billed lots stored without one', () => {
  const stored = Object.fromEntries(P.D.cancellations.map(c => [c.id, c.amount]));
  const rows = P.byId['FAD/cancellation-billing'].rows().filter(r => r.bill_date);
  const blank = rows.filter(r => stored[r.id] === null || stored[r.id] === undefined);
  assert.ok(blank.length > 0, 'seeded billed-unpaid lots without an amount');
  blank.forEach(r => assert.strictEqual(r.amount, r.penalty, r.plate));
});
test('Cancellation Billing and Payment show Penalty, To Seller and To JBAP', () => {
  for (const slug of ['cancellation-billing']) {
    const keys = P.byId[`FAD/${slug}`].cols.map(c => c.key);
    assert.ok(keys.includes('penalty') && keys.includes('pen_seller') && keys.includes('pen_jbap'), slug);
  }
});
