const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness');
test('eligible units: Not Sold or Cancelled, not listed in an ongoing or future auction, no clearance and no release', () => {
  const P = load(), rows = P.byId['SMD/return-to-seller'].rows();
  assert.strictEqual(rows.length, 17);
  assert.ok(rows.every(r => ['Not Sold', 'Cancelled'].includes(r.status)));
  assert.ok(!rows.some(r => ['V066', 'V070', 'V077'].includes(r.id)), 'relisted in auction 222 (not ended): they stay');
  assert.ok(['V069', 'V071'].every(id => rows.some(r => r.id === id)), 'auction 221 has ended: these may go back');
  assert.strictEqual(P.byId['SMD/return-to-seller'].tag, 'Wish'); assert.strictEqual(P.LATEST_AUCTION, '221');
  assert.doesNotMatch(P.byId['SMD/return-to-seller'].rule, /latest auction/);
});
test('listedAhead: the own auction or the relisting auction has not ended', () => {
  const P = load();
  assert.deepStrictEqual([P.listedAhead({ auction: 221 }), P.listedAhead({ auction: 221, next_auction: 222 }), P.listedAhead({ auction: 222 })], [false, true, true]);
});
test('clearance: recorded under SMD, units move to VWD For Return to Seller, one form per seller', () => {
  const P = load(), scr = P.byId['SMD/return-to-seller'], units = scr.rows().filter(r => r.seller === 'ORICO'), before = P.S.log.length;
  assert.strictEqual(units.length, 4);
  P.recordReturnClearance(scr, units);
  assert.ok(units.every(u => u._raw.rts_cleared === P.TODAY)); assert.ok(P.S.log.slice(before).every(e => e.module === 'SMD'));
  assert.deepStrictEqual(P.byId['VWD/for-return-to-seller'].rows().map(r => r.id).sort(), units.map(u => u.id).sort());
  assert.ok(!scr.rows().some(r => r.seller === 'ORICO'));
  const h = P.REPORTS.returnClearance('ORICO', units, P.TODAY);
  assert.match(h, /Return to Seller/); assert.match(h, /SMD Manager/); assert.match(h, /FAD Manager/); assert.match(h, /Q32/);
  assert.doesNotMatch(h.replace(/<[^>]*>/g, ' '), /\bnull\b|undefined|NaN/);
});
test('a return is recorded like a release and is never blocked by DOAS or penalty', () => {
  const P = load(), smd = P.byId['SMD/return-to-seller'], u = smd.rows().find(r => P.releaseOf(r) === 'doas');
  assert.ok(u, 'need a unit of a DOAS seller');
  P.recordReturnClearance(smd, [u]);
  const vwd = P.byId['VWD/for-return-to-seller'], v = vwd.rows().find(r => r.id === u.id);
  assert.strictEqual(P.releaseBlock(v), null);
  assert.strictEqual(vwd.releaseType, 'Return to Seller');
  const vrf = P.recordRelease(vwd, v, { date: P.TODAY, to: v.seller_full, type: 'Return to Seller', items: [] });
  assert.strictEqual(vrf, '04583'); assert.strictEqual(v._raw.release_type, 'Return to Seller');
  assert.ok(!vwd.rows().some(r => r.id === u.id));
  assert.strictEqual(P.byId['VWD/inventory'].rows().find(r => r.id === u.id).returned_seller, P.TODAY);
});
test('a sold lot is still blocked even if another release type is picked', () => {
  const P = load(), v = P.byId['VWD/unreleased-unit-overdue'].rows().find(x => x.penalty > 0);
  assert.match(P.releaseBlock(v), /Storage penalty/);
});
test('Log Activity texts: SMD logs Return to Seller (and the SAAF)', () => {
  const P = load(), scr = P.byId['log-activity'];
  assert.match(scr.rule, /SMD entries come from Return to Seller/);
  P.U('log-activity').applied.module = 'SMD'; assert.match(scr.emptyNote(), /Return to Seller/);
  P.U('log-activity').applied.module = 'VWD'; assert.match(scr.emptyNote(), /returns/);
});
