const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness');
// JBAP feedback of 16 Oct 2026: #13 combine Cancellation Billing and Payment, #14 Cancellation Entry replaces Cancellation Monitoring
test('Cancellation Billing & Payment: one screen for every unpaid fee, billed or not', () => {
  const P = load(), scr = P.byId['FAD/cancellation-billing'], col = k => scr.cols.find(c => c.key === k);
  assert.strictEqual(scr.title, 'Cancellation Billing & Payment'); assert.strictEqual(P.byId['FAD/cancellation-payment'], undefined);
  assert.deepStrictEqual(scr.rows().map(r => r.id).sort(), P.CX().filter(c => !c.waived && !c.paid_date).map(c => c.id).sort());
  const billed = scr.rows().find(r => r.bill_date), unbilled = scr.rows().find(r => !r.bill_date);
  assert.ok(billed && unbilled);
  assert.doesNotMatch(P.cellHtml(scr, billed, col('for_print'), true), /type="checkbox"/, 'billed: no tick');
  assert.match(P.cellHtml(scr, unbilled, col('for_print'), true), /type="checkbox"/);
  assert.match(P.cellHtml(scr, billed, col('paid_date'), true), /data-key="paid_date"/);
  assert.doesNotMatch(P.cellHtml(scr, unbilled, col('paid_date'), true), /data-key="paid_date"/, 'unbilled: Date Paid locked');
  assert.doesNotMatch(P.cellHtml(scr, unbilled, col('amount'), true), /data-key="amount"/, 'unbilled: Amount locked');
});
test('billing keeps the lot on the screen; entering Date Paid removes it', () => {
  const P = load(), scr = P.byId['FAD/cancellation-billing'], r = scr.rows().find(x => !x.bill_date);
  P.recordCancellationBilling(scr, [r]);
  const b = scr.rows().find(x => x.id === r.id); assert.ok(b, 'still listed'); assert.strictEqual(b.bill_date, P.TODAY); assert.strictEqual(b.amount, b.penalty);
  P.U(scr.id).edits[r.id] = { paid_date: P.TODAY }; assert.deepStrictEqual(P.validateEdits(scr), []);
  P.applyEdits(scr); assert.ok(!scr.rows().some(x => x.id === r.id), 'paid: removed');
});
test('Print cancellation billing never bills a lot that already has a Billing Date', () => {
  const P = load(), scr = P.byId['FAD/cancellation-billing'], billed = scr.rows().find(x => x.bill_date);
  assert.ok(billed, 'a billed cancellation is listed');
  P.CX().find(c => c.id === billed.id)._raw.for_print = true;   // a stray For Print? tick on a billed lot
  assert.ok(P.selectedRows(scr, 'for_print').some(r => r.id === billed.id), 'the tick is picked up');
  const before = billed.bill_date;
  try { P.ACTIONS.printCancel(scr); } catch (e) { /* DOM stub: render() / openModal throw after the message is set */ }
  const m = P.U(scr.id).msg; assert.ok(m && m.type === 'error' && /at least one record/.test(m.html), 'nothing left to bill: the error is shown, no letter is opened');
  assert.strictEqual(scr.rows().find(x => x.id === billed.id).bill_date, before, 'the Billing Date is untouched');
});
test('Date Paid: not before the Billing Date; Amount more than 0', () => {
  const P = load(), scr = P.byId['FAD/cancellation-billing'], b = scr.rows().find(x => x.bill_date);
  assert.match(scr.validate(b, { paid_date: '2000-01-01' }).paid_date, /before/);
  assert.match(scr.validate(b, { paid_date: P.TODAY, amount: '0' }).amount, /more than 0/);
});
test('Cancellation Entry lists every cancellation with filters; FAD and SMD no longer have their own Cancellation Monitoring', () => {
  const P = load(), scr = P.byId['FAD/cancellation-entry'];
  assert.strictEqual(P.byId['FAD/cancellation-monitoring'], undefined); assert.strictEqual(P.byId['SMD/cancellation-monitoring'], undefined);
  assert.deepStrictEqual(scr.cols.map(c => c.key), ['auction', 'lot', 'customer', 'cid', 'plate', 'dcancel', 'waived', 'just', 'bill_date', 'paid_date', 'remitted']);
  assert.strictEqual(scr.rows().length, P.CX().length); assert.ok(scr.actions.includes('Filter'));
  assert.deepStrictEqual(scr.filters.map(f => f.key), ['auction', 'customer', 'plate', 'waived']);
  P.U(scr.id).applied = { waived: 'Yes' }; const y = P.applyFilters(scr, scr.rows()); assert.ok(y.length && y.every(r => r.waived));
  P.U(scr.id).applied = { waived: 'No' }; const n = P.applyFilters(scr, scr.rows()); assert.ok(n.length && n.every(r => !r.waived));
  P.U(scr.id).applied = {}; const h = P.entryLayout(scr); assert.match(h, /data-form="filter"/); assert.match(h, /aria-label="Cancellations"/);
});
test('38 screens (38 with the Proposed improvements switch off: the SAAF screen is standard since JBAP answer Q11)', () => {
  const P = load(); assert.strictEqual(P.SCREENS.length, 38); assert.strictEqual(P.SCREENS.filter(P.shown).length, 38);
  assert.ok(!P.SCREENS.some(s => s.proposed), 'no screen is behind the switch any more (columns still can be)');
});
