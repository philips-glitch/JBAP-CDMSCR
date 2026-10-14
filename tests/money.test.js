const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness');
const P = load(), lots = Object.fromEntries(P.V().map(v => [v.plate, v]));
// Access Payment Seller, 10/08/2026: [plate, To JBAP, total shown by Access (= payable)]
const ACCESS = [['NLA2191', 20439.29, 451960.71], ['LAQ8198', 24683.04, 545816.96], ['NIK5667', 8141.07, 180258.93], ['NKE3305', 13943.75, 308456.25],
  ['NDA2713', 3724.11, 82675.89], ['KAF6387', 9959.82, 220440.18], ['NIE6292', 16446.70, 364353.30], ['NKK6215', 16719.51, 370380.49], ['NGC5331', 12568.86, 278681.14],
  ['DAS1987', 14303.17, 316996.83], ['NKP2895', 40454.20, 894745.80], ['NKS5422', 42714.64, 944685.36], ['NHL1871', 15199.55, 336800.45], ['NKR1470', 37511.72, 829738.28],
  ['MK950A', 22777.68, 504222.32], ['NFU1089', 24596.43, 544403.57], ['CDC2903', 0, 563500], ['CDD1240', 0, 563500]];
test('To JBAP and payable match all 18 Access rows', () => {
  for (const [p, tj, pay] of ACCESS) { assert.strictEqual(lots[p].to_jbap, tj, `${p} to_jbap`); assert.strictEqual(lots[p].payable, pay, `${p} payable`); }
});
test('SBC commission billing matches Access (VAT inside 5%)', () => {
  const v = lots.NKC4711; assert.deepStrictEqual([v.com, v.cvat, v.ctotal], [15758.93, 1891.07, 17650]);
});
test('Commission Billing rows foot: com + cvat = ctotal for every priced lot', () => {
  const r = x => Math.round(x * 100) / 100;
  const priced = P.V().filter(v => v.price !== null && v.price !== undefined);
  assert.ok(priced.length > 0);
  for (const v of priced) assert.strictEqual(r(v.com + v.cvat), v.ctotal, `${v.plate} com + cvat vs ctotal`);
});
test('NKR1470 (EWB, 866,250) splits to 38,671.87 + 4,640.63 = 43,312.50', () => {
  const v = lots.NKR1470; assert.deepStrictEqual([v.com, v.cvat, v.ctotal], [38671.87, 4640.63, 43312.5]);
});
test('VAT on top for non-inclusive sellers (Q1, ORIX sample)', () => {
  const m = P.sellerMoney({ seller: 'ORIX', price: 231000, transfer_fee: 0 });
  assert.deepStrictEqual([m.com, m.cvat, m.ctotal], [11550, 1386, 12936]);
});
test('null price gives null money', () => { assert.strictEqual(P.sellerMoney({ seller: 'EWB', price: null }).to_jbap, null); });
