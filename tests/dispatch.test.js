const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness');
const P = load(), fd = () => P.byId['FAD/for-dispatch'].rows();
test('For Dispatch follows the seller release condition', () => {
  for (const r of fd()) {
    assert.ok(!r.dispatch, r.plate);
    if (P.releaseOf(r) === 'ack') assert.ok(r.seller_ack, `${r.plate} needs Seller Acknowledgement`); else assert.ok(r.buyer_paid, `${r.plate} needs Buyer Paid`);
  }
});
test('the 9 Access For Dispatch lots are listed with the DOAS remark', () => {
  const rows = fd();
  for (const p of ['NKK6215', 'NIE6292', 'NKR1470', 'NKS5422', 'NAO8239', 'DAS1987', 'NKP2895', 'MK950A', 'NHL1871']) {
    const r = rows.find(x => x.plate === p); assert.ok(r, p); assert.strictEqual(r.release_cond, 'Required DOAS / Legal Documents signing');
  }
});
test('an ack seller lot waits for Seller Acknowledgement', () => {
  const v = P.S.veh.find(x => P.releaseOf(x) === 'ack' && x.status === 'Sold' && x.buyer_paid && !x.dispatch);
  v.seller_ack = null; assert.ok(!fd().some(r => r.plate === v.plate));
  v.seller_ack = v.buyer_paid; assert.ok(fd().some(r => r.plate === v.plate));
});
