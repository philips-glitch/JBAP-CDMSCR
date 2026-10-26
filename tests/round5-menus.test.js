const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness');
test('Report holds Rebate Monitoring and Liability to Seller; FAD has Rebate Payable; SMD Rebate gone', () => {
  const P = load(), B = P.byId;
  assert.ok(B['report/rebate-monitoring'] && B['report/liability-to-seller'] && B['FAD/rebate-payable']);
  for (const id of ['FAD/rebate-monitoring', 'FAD/liability-to-seller', 'SMD/rebate-monitoring', 'SMD/rebate-payable']) assert.strictEqual(B[id], undefined, id);
  assert.ok(B['report/rebate-monitoring'].buttons.some(b => /Download report/.test(b.label)));
  assert.ok(B['report/rebate-monitoring'].isNew && B['report/liability-to-seller'].isNew && B['FAD/rebate-payable'].isNew);
  assert.strictEqual(B['FAD/rebate-payable'].group, undefined);
  assert.ok(B['FAD/rebate-payable'].cols.some(c => c.key === 'rebate_paid' && c.edit === 'date'));
  const redirect = { 'FAD/rebate-monitoring': 'report/rebate-monitoring', 'SMD/rebate-monitoring': 'report/rebate-monitoring',
    'SMD/rebate-payable': 'FAD/rebate-payable', 'FAD/liability-to-seller': 'report/liability-to-seller' };
  for (const [from, to] of Object.entries(redirect)) assert.strictEqual(P.routeOf(from), to, from);
  assert.strictEqual(P.SCREENS.length, 38);
});
test('New badge marks only round-5 changes', () => {
  const P = load();
  assert.match(P.newHtml({ isNew: true }), /26 Oct 2026/);
  const marked = P.SCREENS.filter(s => s.isNew).map(s => s.id);
  for (const id of ['FAD/rebate-payable', 'report/liability-to-seller', 'report/rebate-monitoring']) assert.ok(marked.includes(id), id);
  // badges of the 19 and 20 Oct rounds are gone (these screens are not changed in round 5)
  for (const id of ['SMD/saaf', 'settings/holidays', 'report/inventory-summary', 'report/inventory-monitoring', 'SMD/unreleased-unit', 'VWD/for-return-to-seller']) assert.ok(!P.byId[id].isNew, id);
  for (const id of ['SMD/unreleased-unit', 'SMD/return-to-seller', 'FAD/payment-seller', 'FAD/commission-billing']) assert.ok(!P.byId[id].cols.some(c => c.isNew), id);
});
test('Rebate Paid saved on FAD Rebate Payable is logged under FAD', () => {
  const P = load(), scr = P.byId['FAD/rebate-payable'], r = scr.rows()[0];
  P.U(scr.id).edits[r.id] = { rebate_paid: P.TODAY };
  assert.deepStrictEqual(P.validateEdits(scr), []); P.applyEdits(scr);
  assert.strictEqual(P.S.log[0].module, 'FAD'); assert.ok(!scr.rows().some(x => x.id === r.id));
});
