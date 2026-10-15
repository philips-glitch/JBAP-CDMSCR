const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness');
const P = load(), D = P.D, byPlate = Object.fromEntries(D.vehicles.map(v => [v.plate, v]));
test('seller settings', () => {
  const s = Object.fromEntries(D.sellers.map(x => [x.code, x]));
  assert.deepStrictEqual([s.EWB.release, s.EWB.vat_inclusive, s.EWB.net, s.EWB.transfer_fee], ['doas', true, true, 1000]);
  assert.strictEqual(s.EWB.doas_signing, 'branch');
  assert.deepStrictEqual(s.SBC.fee_tiers, [[499999.99, 400], [null, 500]]);
  assert.deepStrictEqual([s.TFS.release, s.TFS.net, s.TFS.transfer_fee], ['payment', false, 500]);
  assert.strictEqual(s.JACCS.release, 'ack');
  for (const x of D.sellers) assert.ok(['payment', 'ack', 'doas'].includes(x.release), x.code);
});
test('Access lots carry exact prices and fees', () => {
  assert.deepStrictEqual([byPlate.NLA2191.price, byPlate.NLA2191.transfer_fee], [472000, 400]);
  assert.deepStrictEqual([byPlate.LAQ8198.price, byPlate.LAQ8198.transfer_fee], [570000, 500]);
  assert.deepStrictEqual([byPlate.NKR1470.price, byPlate.NKR1470.transfer_fee], [866250, 1000]);
  assert.deepStrictEqual([byPlate.CDC2903.price, byPlate.CDC2903.transfer_fee], [563000, 500]);
  assert.deepStrictEqual([byPlate.CCC5740.price, byPlate.CCC5740.transfer_fee], [1137000, 1000]);
  assert.ok(D.vehicles.every(v => v.to_jbap === undefined), 'no stored to_jbap');
});
test('new fields and company settings', () => {
  assert.ok(D.vehicles.every(v => v.location === 'Pasay City' && Array.isArray(v.docs_received)));
  assert.ok(D.cancellations.every(c => 'seller' in c));
  assert.ok(D.billing.every(b => b.print_trans === false));
  assert.deepStrictEqual(D.meta.company.next, { vrf: 4583, atf: 8864 });
  assert.strictEqual(D.meta.company.emails.finance, 'finance@jbap.com.ph');
});
test('JBAP Document Monitoring merge: EWB columns on EWB lots only, no DOAS dates for sellers without a DOAS, nothing after the demo day', () => {
  const S = Object.fromEntries(D.sellers.map(x => [x.code, x])), dates = ['ewb_callout', 'ewb_signed', 'rcv_doas', 'buyer_doas', 'seller_doas', 'orig_docs', 'to_buyer'];
  assert.ok(D.vehicles.filter(v => v.ewb_signed).length > 0, 'merged EWB signing dates exist');
  assert.ok(D.vehicles.every(v => !(v.ewb_callout || v.ewb_signed || v.ewb_place) || v.seller === 'EWB'));
  assert.ok(D.vehicles.every(v => S[v.seller]?.release !== 'payment' || !(v.rcv_doas || v.buyer_doas || v.seller_doas)));
  assert.ok(D.vehicles.every(v => dates.every(k => !v[k] || v[k] <= D.meta.demoToday)));
  assert.match(D.meta.note, /2026 Documents Monitoring/);
});
