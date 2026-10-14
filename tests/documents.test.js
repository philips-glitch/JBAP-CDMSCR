const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness');
const P = load(), scr = () => P.byId['FAD/document-monitoring'];
test('lists paid lots except Buyer Payment sellers, until documents are released', () => {
  const rows = scr().rows(); assert.ok(rows.length > 0);
  for (const r of rows) { assert.ok(r.buyer_paid && !r.to_buyer, r.plate); assert.notStrictEqual(P.releaseOf(r), 'payment', r.plate); }
});
test('validation: order, buyer paid, future', () => {
  const r = { buyer_paid: '2026-09-20' };
  assert.match(P.docValidate(r, { buyer_doas: '2026-09-22', rcv_doas: '2026-09-25' }).buyer_doas, /Received DOAS/);
  assert.match(P.docValidate(r, { rcv_doas: '2026-09-10' }).rcv_doas, /Buyer Paid/);
  assert.match(P.docValidate(r, { orig_docs: '2026-12-01' }).orig_docs, /after today/);
  assert.match(P.docValidate(r, { orig_docs: '2026-09-30', to_buyer: '2026-09-25' }).to_buyer, /Original Docs/);
  assert.match(P.docValidate(r, { rcv_doas: '2026-10-05', seller_doas: '2026-10-01' }).seller_doas || '', /Received DOAS/, 'Buyer Signed DOAS blank: seller receipt checked against Received DOAS');
  assert.deepStrictEqual(Object.values(P.docValidate(r, { rcv_doas: '2026-09-21', buyer_doas: '2026-09-22', seller_doas: '2026-09-23' })).filter(Boolean), []);
});
test('the 5 document dates are editable, and a lot leaves the list once documents are released', () => {
  const s = scr(), editable = s.cols.filter(c => c.edit === 'date').map(c => c.key);
  assert.deepStrictEqual(editable, ['rcv_doas', 'buyer_doas', 'seller_doas', 'orig_docs', 'to_buyer']);
  const r = s.rows()[0]; r._raw.to_buyer = r.buyer_paid;
  assert.ok(!s.rows().some(x => x.id === r.id));
});
