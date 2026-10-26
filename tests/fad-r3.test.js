const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness');
test('Payment Seller: recording the payment date on printed lots moves them on, logged', () => {
  const P = load(), scr = P.byId['FAD/payment-seller'], rows = scr.rows().slice(0, 2), before = P.S.log.length;
  P.recordSellerPayment(scr, rows, P.TODAY);
  assert.ok(rows.every(r => r._raw.pay_seller === P.TODAY && !r._raw.print_seller));
  assert.ok(!scr.rows().some(r => rows.some(x => x.id === r.id)), 'left Payment Seller');
  assert.ok(rows.every(r => P.byId['FAD/seller-acknowledgement'].rows().some(x => x.id === r.id)));
  assert.ok(P.S.log.slice(before).some(e => e.field === 'Payment to Seller Date'));
  assert.ok(!scr.isNew && !scr.buttons.find(b => b.act === 'printSeller').isNew, 'the 19 Oct New marks are gone');
  assert.match(scr.buttons.find(b => b.act === 'printSeller').label, /Record payment date & print/);
});
test('Pending Awarding: Rebate editable (0 to the result price), saved with the awarding', () => {
  const P = load(), scr = P.byId['FAD/pending-awarding'], col = scr.cols.find(c => c.key === 'rebate'), r = scr.rows().find(x => x.price);
  assert.strictEqual(col.edit, 'money'); assert.ok(!col.isNew && !scr.isNew, 'the 19 Oct New marks are gone');
  assert.match(scr.validate(r, { rebate: '-1' }).rebate, /0 or more/);
  assert.match(scr.validate(r, { rebate: String(r.price + 1) }).rebate, /result price/);
  assert.strictEqual(scr.validate(r, { rebate: '5000' }).rebate, null);
  P.U(scr.id).edits[r.id] = { rebate: '5000' }; P.recordAwarding(scr, [r]);
  assert.strictEqual(r._raw.rebate, 5000);
});
test('Commission Billing shows Auction No. and Auction Date', () => {
  const P = load(), cb = P.byId['FAD/commission-billing'], keys = cb.cols.map(c => c.key);
  assert.ok(keys.indexOf('auction') > -1 && keys.indexOf('auction') + 1 === keys.indexOf('adate'));
  assert.ok(!cb.cols.find(c => c.key === 'auction').isNew && !cb.isNew, 'the 19 Oct New marks are gone');
});
test('Payment Seller: recording saves a typed Payment Voucher No., logs it, and leaves no edit behind for printed lots', () => {
  const P = load(); P.setProposed(true);   // Payment Voucher No. is a proposed column
  const scr = P.byId['FAD/payment-seller'], [a, b, c] = scr.rows(), ed = P.U(scr.id).edits, before = P.S.log.length;
  ed[a.id] = { print_seller: true, pay_seller: '2026-10-01', voucher_no: 'PV-1' }; ed[b.id] = { print_seller: true }; ed[c.id] = { voucher_no: 'PV-9' };
  P.recordSellerPayment(scr, [a, b], P.TODAY);
  assert.strictEqual(a._raw.voucher_no, 'PV-1', 'the typed voucher number is saved on the lot');
  assert.ok([a, b].every(r => r._raw.pay_seller === P.TODAY && !r._raw.print_seller), 'the recorded date replaces the typed one');
  assert.ok(!ed[a.id] && !ed[b.id], 'no edit stays pending for a printed lot');
  assert.deepStrictEqual(ed[c.id], { voucher_no: 'PV-9' }, 'an unprinted row keeps its edit');
  assert.strictEqual(P.dirtyCount(scr), 1, 'no phantom unsaved count');
  const log = P.S.log.slice(before);
  assert.ok(log.some(e => e.field === 'Payment Voucher No.' && e.new === 'PV-1'));
  assert.strictEqual(log.filter(e => e.field === 'Payment to Seller Date' && e.new === P.fmtDate(P.TODAY)).length, 2);
});
test('Payment Seller: the printed report carries the date it is given', () => {
  const P = load(), rows = P.byId['FAD/payment-seller'].rows().slice(0, 1);
  assert.match(P.REPORTS.payableToSeller(rows[0].seller, rows, '2025-12-30'), /30 December 2025/);
});
test('Payment Seller dialog date check: blank, unreadable, future, before the latest Buyer Paid, valid', () => {
  const P = load(), rows = P.byId['FAD/payment-seller'].rows().slice(0, 3), latest = rows.map(r => r.buyer_paid).filter(Boolean).sort().pop();
  assert.ok(latest && latest < P.TODAY, 'the rows have a Buyer Paid date before the demo date');
  assert.strictEqual(P.paymentDateError(rows, ''), 'Payment date is required.');
  assert.strictEqual(P.paymentDateError(rows, P.parseDateInput('13/45', P.TODAY)), 'Type the date as mm/dd/yyyy, or t for today.', 'unreadable text (null from parseDateInput)');
  assert.strictEqual(P.paymentDateError(rows, null), 'Type the date as mm/dd/yyyy, or t for today.');
  assert.strictEqual(P.paymentDateError(rows, '2099-01-01'), 'Cannot be after today.');
  const d = new Date(latest + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - 1); const before = d.toISOString().slice(0, 10);
  assert.strictEqual(P.paymentDateError(rows, before), `Cannot be before ${P.fmtDate(latest)} (the latest Buyer Paid of these lots).`);
  assert.strictEqual(P.paymentDateError(rows, latest), null, 'the latest Buyer Paid itself is fine');
  assert.strictEqual(P.paymentDateError(rows, P.TODAY), null);
  assert.strictEqual(P.paymentDateError([{ buyer_paid: '' }, {}], '2000-01-01'), null, 'no Buyer Paid on the lots: only today and the format are checked');
});
