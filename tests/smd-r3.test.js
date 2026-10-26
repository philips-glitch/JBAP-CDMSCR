const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness');
test('SMD Unreleased Unit = FAD list, live, view only', () => {
  const P = load(), s = P.byId['SMD/unreleased-unit'], f = P.byId['FAD/unreleased-unit'];
  assert.deepStrictEqual(s.rows().map(r => r.id).sort(), f.rows().map(r => r.id).sort());
  assert.deepStrictEqual(s.cols.map(c => c.key), ['customer', 'auction', 'model', 'plate', 'location', 'dispatch_deadline', 'penalty', 'penalty_paid']);
  assert.deepStrictEqual(s.actions, ['View', 'Filter', 'Sort']); assert.ok(!(s.buttons || []).length && !s.isNew, 'the 19 Oct New mark is gone');
  const loc = x => x.cols.find(c => c.key === 'location');
  assert.ok(!loc(s).isNew && !loc(f).isNew && !loc(P.byId['VWD/unreleased-unit']).isNew, 'Location: the 19 Oct New mark is gone');
  assert.strictEqual(s.cols.filter(c => c.isNew).length, 0);
});
test('Return to Seller: Number of Listing', () => {
  const P = load(), rts = P.byId['SMD/return-to-seller'], col = rts.cols.find(c => c.key === 'listings');
  assert.ok(col && !col.isNew && !rts.isNew, 'the 19 Oct New marks are gone');
  assert.ok(rts.rows().every(r => r.listings === P.listingsOf(r) && r.listings >= 1));
  assert.ok(rts.rows().some(r => r.listings > 1), '[MOCK] prior listings show');
  assert.strictEqual(P.listingsOf({ plate: 'ZZZ', prior_listings: 2, next_auction: 222 }), 3);
});
