const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness');
test('clearance → SMD Manager → FAD Manager → VWD', () => {
  const P = load(), rts = P.byId['SMD/return-to-seller'], smd = P.byId['SMD/return-approval'], fad = P.byId['FAD/return-approval'], vwd = P.byId['VWD/for-return-to-seller'];
  assert.ok(smd.isNew && fad.isNew && smd.group === 'Return to Seller' && rts.group === 'Return to Seller');
  const u = rts.rows()[0]; P.recordReturnClearance(rts, [u]);
  const a = smd.rows().find(r => r.id === u.id); assert.ok(a); assert.ok(!fad.rows().some(r => r.id === u.id)); assert.ok(!vwd.rows().some(r => r.id === u.id));
  assert.match(smd.validate(a, { rts_smd_ok: '2000-01-01' }).rts_smd_ok, /before/);
  P.U(smd.id).edits[u.id] = { rts_smd_ok: P.TODAY }; assert.deepStrictEqual(P.validateEdits(smd), []); P.applyEdits(smd);
  assert.ok(!smd.rows().some(r => r.id === u.id) && fad.rows().some(r => r.id === u.id) && !vwd.rows().some(r => r.id === u.id));
  P.U(fad.id).edits[u.id] = { rts_fad_ok: P.TODAY }; P.applyEdits(fad);
  assert.ok(!fad.rows().some(r => r.id === u.id) && vwd.rows().some(r => r.id === u.id));
  assert.match(P.REPORTS.returnClearance(u.seller, [u], P.TODAY), /Approved in CDMS/);
});
test('approval screens: dates are checked and logged, VWD gets the approval column, texts and menu labels name the new steps', () => {
  const P = load(), rts = P.byId['SMD/return-to-seller'], smd = P.byId['SMD/return-approval'], fad = P.byId['FAD/return-approval'], vwd = P.byId['VWD/for-return-to-seller'];
  const u = rts.rows()[0]; P.recordReturnClearance(rts, [u]);
  assert.match(smd.validate(smd.rows().find(r => r.id === u.id), { rts_smd_ok: '2999-01-01' }).rts_smd_ok, /after today/);
  const n = P.S.log.length; P.U(smd.id).edits[u.id] = { rts_smd_ok: P.TODAY }; P.applyEdits(smd);
  const logged = P.S.log.slice(n); assert.ok(logged.length === 1 && logged[0].module === 'SMD' && logged[0].screen === 'SMD Manager Approval' && logged[0].field === 'SMD Manager Approved');
  const ago = k => new Date(Date.parse(P.TODAY) - k * 864e5).toISOString().slice(0, 10);   // the demo date is fixed, so dates are taken relative to it
  u._raw.rts_smd_ok = ago(3);
  assert.match(fad.validate(fad.rows().find(r => r.id === u.id), { rts_fad_ok: ago(4) }).rts_fad_ok, /before/);
  assert.match(fad.validate(fad.rows().find(r => r.id === u.id), { rts_fad_ok: '2999-01-01' }).rts_fad_ok, /after today/);
  assert.strictEqual(fad.validate(fad.rows().find(r => r.id === u.id), { rts_fad_ok: ago(2) }).rts_fad_ok, null);
  assert.deepStrictEqual(vwd.cols.filter(c => c.isNew).map(c => c.key), ['rts_fad_ok']); assert.ok(vwd.isNew);
  assert.deepStrictEqual(vwd.cols.map(c => c.key).slice(-3), ['rts_cleared', 'rts_fad_ok', 'id']);
  assert.match(vwd.rule, /approved by the SMD and FAD Managers/); assert.match(rts.rule, /SMD Manager and the FAD Manager approve in CDMS \(proposal, Q76\)/);
  const home = P.homeLayout();
  assert.doesNotMatch(home, /Return to Seller › Return to Seller/); assert.match(home, /Return to Seller › SMD Manager Approval/);
  assert.match(home, /Live data: [^<]*SMD Manager Approval/);
  assert.doesNotMatch(P.pageHead(rts), /Return to Seller<\/span>›<b>Return to Seller/); assert.match(P.pageHead(smd), /Return to Seller<\/span>›<b>SMD Manager Approval/);
  assert.match(P.pageHead(smd), /class="tab[^"]*"[^>]*>Return to Seller/);
});
test('the Wish tag shows on every tab of the Return to Seller group, and only where a screen of the group carries it', () => {
  const P = load(), h1 = scr => P.pageHead(scr).match(/<h1>.*?<\/h1>/s)[0];
  for (const id of ['SMD/return-to-seller', 'SMD/return-approval']) assert.match(h1(P.byId[id]), /Wish list/, id);
  assert.doesNotMatch(h1(P.byId['FAD/billing-monitoring']), /ptag wish/); assert.doesNotMatch(h1(P.byId['FAD/unpaid']), /ptag wish/);
  assert.match(h1(P.byId['VWD/for-return-to-seller']), /Wish list/);
});
test('a return is dated not before the latest of the clearance and the FAD Manager approval', () => {
  const P = load(), rts = P.byId['SMD/return-to-seller'], vwd = P.byId['VWD/for-return-to-seller'], u = rts.rows()[0];
  const ago = k => new Date(Date.parse(P.TODAY) - k * 864e5).toISOString().slice(0, 10);   // the demo date is fixed
  P.recordReturnClearance(rts, [u]); Object.assign(u._raw, { rts_cleared: ago(5), rts_smd_ok: ago(4), rts_fad_ok: ago(2) });
  const v = vwd.rows().find(r => r.id === u.id); assert.ok(v);
  assert.match(P.releaseDateError(v, ago(3)), /before the FAD Manager approval/); assert.match(P.releaseDateError(v, ago(6)), /before the FAD Manager approval/);
  assert.strictEqual(P.releaseDateError(v, ago(2)), null); assert.strictEqual(P.releaseDateError(v, P.TODAY), null);
  assert.match(P.releaseDateError(v, '2999-01-01'), /after today/);
  u._raw.rts_cleared = ago(1);   // an unlikely order (clearance after the approval): the later date is named
  assert.match(P.releaseDateError(vwd.rows().find(r => r.id === u.id), ago(2)), /before the Return to Seller clearance/);
});
test('a released unit drops out of SMD Manager Approval and FAD Return to Seller Approval', () => {
  const P = load(), rts = P.byId['SMD/return-to-seller'], smd = P.byId['SMD/return-approval'], fad = P.byId['FAD/return-approval'], vwd = P.byId['VWD/for-return-to-seller'];
  const [a, b] = rts.rows(); P.recordReturnClearance(rts, [a, b]);
  const toSmd = smd.rows().find(r => r.id === a.id), toFad = smd.rows().find(r => r.id === b.id);
  b._raw.rts_smd_ok = P.TODAY; assert.ok(fad.rows().some(r => r.id === b.id) && !smd.rows().some(r => r.id === b.id));
  const f = { date: P.TODAY, to: 'Seller', type: 'Return to Seller', items: [] };
  P.recordRelease(vwd, toSmd, f); P.recordRelease(vwd, toFad, f);
  assert.ok(!smd.rows().some(r => r.id === a.id), 'released before the SMD approval: not in SMD Manager Approval');
  assert.ok(!fad.rows().some(r => r.id === b.id), 'released before the FAD approval: not in FAD Return to Seller Approval');
});
