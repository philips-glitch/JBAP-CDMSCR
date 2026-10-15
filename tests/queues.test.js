const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness');
const READY = { 'FAD/pending-awarding': 'for_baaf', 'FAD/payment-seller': 'print_seller', 'FAD/commission-billing': 'print_comm', 'FAD/billing-monitoring': 'print_trans',
  'FAD/for-dispatch': 'for_dispatch_email', 'FAD/document-monitoring': 'print_doc_trans', 'FAD/cancellation-billing': 'for_print' };
const ids = rows => rows.map(r => r.id).sort();
test('every queue has its ready rule', () => {
  const P = load();
  for (const [id, key] of Object.entries(READY)) assert.strictEqual(P.byId[id].ready?.key, key, id);
});
test('switch off: nothing is pre-ticked beyond the saved ticks', () => {
  const P = load();
  for (const [id, key] of Object.entries(READY)) { const scr = P.byId[id]; assert.deepStrictEqual(ids(P.selectedRows(scr, key)), ids(scr.rows().filter(r => r[key])), id); }
});
test('switch on: ready rows are pre-ticked as in the spec table', () => {
  const P = load(); P.setProposed(true);
  const sel = id => ids(P.selectedRows(P.byId[id], READY[id])), rows = id => P.byId[id].rows();
  for (const id of ['FAD/payment-seller', 'FAD/commission-billing', 'FAD/for-dispatch', 'FAD/cancellation-billing']) assert.deepStrictEqual(sel(id), ids(rows(id)), id);
  assert.deepStrictEqual(sel('FAD/billing-monitoring'), ids(rows('FAD/billing-monitoring').filter(b => !b.trans || b.print_trans)));
  assert.deepStrictEqual(sel('FAD/document-monitoring'), ids(rows('FAD/document-monitoring').filter(v => (v.orig_docs && !v.atf_no) || v.print_doc_trans)));
  assert.deepStrictEqual(sel('FAD/pending-awarding'), ids(rows('FAD/pending-awarding').filter(v => v.saaf_approved || v.for_baaf)));
});
test('unticking a pre-ticked row holds it back', () => {
  const P = load(); P.setProposed(true); const scr = P.byId['FAD/payment-seller'], r = scr.rows()[0];
  P.U(scr.id).edits[r.id] = { print_seller: false };
  assert.ok(!P.selectedRows(scr, 'print_seller').some(x => x.id === r.id));
});
test('commission billing: one billing per seller in one go', () => {
  const P = load(), scr = P.byId['FAD/commission-billing'], rows = scr.rows(), sellers = [...new Set(rows.map(r => r.seller))].slice(0, 2), n = P.S.billing.length;
  assert.strictEqual(sellers.length, 2, 'need two sellers');
  sellers.forEach((code, i) => P.recordCommissionBilling(scr, code, `T-${i}`, P.TODAY, rows.filter(r => r.seller === code)));
  assert.strictEqual(P.S.billing.length, n + 2);
  const lots0 = rows.filter(r => r.seller === sellers[0]), b0 = P.S.billing.find(b => b.no === 'T-0');
  assert.strictEqual(b0.total, Math.round(lots0.reduce((a, r) => a + r.ctotal, 0) * 100) / 100);
  assert.strictEqual(b0.customer, P.SELLER[sellers[0]].name);
  assert.ok(!scr.rows().some(r => sellers.includes(r.seller)), 'billed lots leave the list');
});
test('P3: Payment Voucher No. only with the switch on; saved and logged like other edits', () => {
  const P = load(), scr = P.byId['FAD/payment-seller'];
  assert.ok(!P.colsOf(scr).some(c => c.key === 'voucher_no'));
  P.setProposed(true);
  const col = P.colsOf(scr).find(c => c.key === 'voucher_no'); assert.ok(col && col.edit === 'text' && col.tag === 'P3');
  const r = scr.rows()[0], before = P.S.log.length;
  P.U(scr.id).edits[r.id] = { voucher_no: 'PV-0001' }; P.applyEdits(scr);
  assert.strictEqual(r._raw.voucher_no, 'PV-0001'); assert.strictEqual(P.S.log.slice(before)[0].field, 'Payment Voucher No.');
  assert.strictEqual(P.byId['FAD/unpaid-billing'].cols.find(c => c.key === 'cr').tag, 'P3');
});
