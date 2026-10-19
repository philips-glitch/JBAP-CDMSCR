const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness');
test('SMD Unreleased Unit = FAD list, live, view only', () => {
  const P = load(), s = P.byId['SMD/unreleased-unit'], f = P.byId['FAD/unreleased-unit'];
  assert.deepStrictEqual(s.rows().map(r => r.id).sort(), f.rows().map(r => r.id).sort());
  assert.deepStrictEqual(s.cols.map(c => c.key), ['customer', 'auction', 'model', 'plate', 'location', 'dispatch_deadline', 'penalty', 'penalty_paid']);
  assert.deepStrictEqual(s.actions, ['View', 'Filter', 'Sort']); assert.ok(!(s.buttons || []).length && s.isNew);
});
test('Return to Seller: Number of Listing', () => {
  const P = load(), rts = P.byId['SMD/return-to-seller'], col = rts.cols.find(c => c.key === 'listings');
  assert.ok(col && col.isNew && rts.isNew);
  assert.ok(rts.rows().every(r => r.listings === P.listingsOf(r) && r.listings >= 1));
  assert.ok(rts.rows().some(r => r.listings > 1), '[MOCK] prior listings show');
  assert.strictEqual(P.listingsOf({ plate: 'ZZZ', prior_listings: 2, next_auction: 222 }), 3);
});
