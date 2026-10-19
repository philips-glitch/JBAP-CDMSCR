const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness');
test('Payment Seller: recording the payment date on printed lots moves them on, logged', () => {
  const P = load(), scr = P.byId['FAD/payment-seller'], rows = scr.rows().slice(0, 2), before = P.S.log.length;
  P.recordSellerPayment(scr, rows, P.TODAY);
  assert.ok(rows.every(r => r._raw.pay_seller === P.TODAY && !r._raw.print_seller));
  assert.ok(!scr.rows().some(r => rows.some(x => x.id === r.id)), 'left Payment Seller');
  assert.ok(rows.every(r => P.byId['FAD/seller-acknowledgement'].rows().some(x => x.id === r.id)));
  assert.ok(P.S.log.slice(before).some(e => e.field === 'Payment to Seller Date'));
  assert.ok(scr.isNew && scr.buttons.find(b => b.act === 'printSeller').isNew);
  assert.match(scr.buttons.find(b => b.act === 'printSeller').label, /Record payment date & print/);
});
test('Pending Awarding: Rebate editable (0 to the result price), saved with the awarding', () => {
  const P = load(), scr = P.byId['FAD/pending-awarding'], col = scr.cols.find(c => c.key === 'rebate'), r = scr.rows().find(x => x.price);
  assert.strictEqual(col.edit, 'money'); assert.ok(col.isNew && scr.isNew);
  assert.match(scr.validate(r, { rebate: '-1' }).rebate, /0 or more/);
  assert.match(scr.validate(r, { rebate: String(r.price + 1) }).rebate, /result price/);
  assert.strictEqual(scr.validate(r, { rebate: '5000' }).rebate, null);
  P.U(scr.id).edits[r.id] = { rebate: '5000' }; P.recordAwarding(scr, [r]);
  assert.strictEqual(r._raw.rebate, 5000);
});
test('Commission Billing shows Auction No. and Auction Date', () => {
  const P = load(), cb = P.byId['FAD/commission-billing'], keys = cb.cols.map(c => c.key);
  assert.ok(keys.indexOf('auction') > -1 && keys.indexOf('auction') + 1 === keys.indexOf('adate'));
  assert.ok(cb.cols.find(c => c.key === 'auction').isNew && cb.isNew);
});
test('Payment Seller: recording drops the print tick and a typed payment date on the row; other edits stay', () => {
  const P = load(), scr = P.byId['FAD/payment-seller'], r = scr.rows()[0];
  P.U(scr.id).edits[r.id] = { print_seller: true, pay_seller: '2026-10-01', voucher_no: 'PV-1' };
  P.recordSellerPayment(scr, [r], P.TODAY);
  assert.deepStrictEqual(P.U(scr.id).edits[r.id], { voucher_no: 'PV-1' });
  assert.strictEqual(r._raw.pay_seller, P.TODAY);
});
