const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness');
// JBAP feedback of 16 Oct 2026: seller short code (#5, 7, 8, 10, 15, 16, 17, 21), Auction No. (#6, 8, 9, 12, 17, 18, 22), transfer fees (#5), Commission Billing (#13)
test('seller code and Auction No. where JBAP asked', () => {
  const P = load(), keys = id => P.byId[id].cols.map(c => c.key);
  for (const id of ['FAD/seller-acknowledgement', 'FAD/for-dispatch', 'FAD/liability-to-seller', 'SMD/pending-awarding', 'SMD/seller-acknowledgement', 'SMD/for-dispatch', 'VWD/for-dispatch']) {
    assert.ok(keys(id).includes('seller') && !keys(id).includes('seller_full'), id);
    assert.strictEqual(P.byId[id].cols.find(c => c.key === 'seller').type, 'code', id);
  }
  for (const id of ['FAD/payment-seller', 'FAD/for-dispatch', 'FAD/unreleased-unit', 'SMD/for-dispatch', 'SMD/unreleased-unit', 'VWD/unreleased-unit-overdue'])
    assert.ok(keys(id).includes('auction') && !keys(id).includes('adate'), id);
  assert.deepStrictEqual(P.byId['FAD/payment-seller'].filters.map(f => f.key), ['seller', 'auction', 'customer', 'plate']);
  assert.deepStrictEqual(P.byId['FAD/liability-to-seller'].sort, ['seller', 'asc']);
});
test('SMD snapshot rows get the seller code and the Auction No.', () => {
  const P = load();
  for (const id of ['SMD/pending-awarding', 'SMD/seller-acknowledgement', 'SMD/for-dispatch']) for (const r of P.byId[id].rows()) assert.ok(P.SELLER[r.seller], `${id}: ${r.seller}`);
  for (const id of ['SMD/for-dispatch']) for (const r of P.byId[id].rows()) {
    const a = P.D.auctions[String(r.auction)]; assert.ok(a, `${id}: ${r.adate}`); assert.strictEqual(r.adate, `${P.fmtDate(a[0])} - ${P.fmtDate(a[1])}`);
  }
  assert.strictEqual(P.byId['SMD/pending-awarding'].filters.find(f => f.label === 'Seller').key, 'seller');
});
test('Pending Awarding: Transfer Fees come from the seller parameters (read-only)', () => {
  const P = load(), scr = P.byId['FAD/pending-awarding'], col = scr.cols.find(c => c.key === 'transfer_fee'), r = scr.rows()[0];
  assert.strictEqual(col.edit, undefined); assert.strictEqual(scr.validate(r, {}).transfer_fee, undefined);
  assert.doesNotMatch(P.cellHtml(scr, r, col, true), /<input/);
  assert.match(scr.rule, /seller parameters/);
  P.U(scr.id).edits[r.id] = { transfer_fee: '99999' }; P.recordAwarding(scr, [r]);
  assert.strictEqual(r._raw.transfer_fee, P.D.vehicles.find(v => v.id === r.id).transfer_fee, 'a stray edit is ignored');
});
test('Commission Billing shows the seller code, the Auction No. and the auction date; Cancellation Entry shows the Auction No.', () => {
  const P = load(), cb = P.byId['FAD/commission-billing'];
  assert.deepStrictEqual(cb.cols.slice(0, 4).map(c => [c.label, c.key]), [['Customer Name', 'customer'], ['Seller', 'seller'], ['Auction No.', 'auction'], ['Auction Date', 'adate']]);
  const scr = P.byId['FAD/cancellation-entry'], v = P.V().find(x => x.status === 'Sold');
  P.U(scr.id).entry = { auction: String(v.auction), lot: v.lot, found: v, errors: {}, note: '', form: { status: 'Sold', date: P.TODAY, waived: false, just: '' } };
  const h = P.entryLayout(scr);
  assert.match(h, new RegExp(`<label>Auction No\\.</label><input class="ctl" value="${v.auction}" readonly>`)); assert.doesNotMatch(h, /<label>Auction Date<\/label>/);
});
// JBAP Q79 (19 Oct 2026): TFSPH is TFS; seller names as Access and JBAP's files write them map to the seller code
test('TFSPH merged into TFS; seller names map through aliases', () => {
  const P = load();
  assert.strictEqual(P.SELLER.TFSPH, undefined); assert.ok(!P.V().some(v => v.seller === 'TFSPH'));
  assert.ok(!P.S.cancels.some(c => c.seller === 'TFSPH'), 'cancellations that named TFSPH are TFS too');
  assert.strictEqual(P.SELLER.TFS.name, 'TOYOTA FINANCIAL SERVICES PHILIPPINES');
  assert.ok(P.V().filter(v => v.seller === 'TFS').length >= 23, 'the 12 former TFSPH lots are TFS');
  for (const [n, c] of [['TOYOTA FINANCIAL SERVICES CORP', 'TFS'], ['South Asialink Finance Corp.', 'ASIALINK'], ['JACCS FINANCE PHILIPPINES CORP', 'JACCS'],
    ['SECURITY BANK  CORPORATION', 'SBC'], ['EAST WEST BANKING CORPORATION', 'EWB'], ['NOBODY', null]]) assert.strictEqual(P.sellerCode(n), c, n);
});
