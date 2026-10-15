const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness');
test('cdmsPaid: fully paid (one or two payments), partly paid, no payment', () => {
  const P = load(), v = id => P.V().find(x => x.id === id);
  assert.deepStrictEqual([v('V123').cdms_full, v('V123').cdms_paid], ['2026-10-01', 300400]);
  assert.strictEqual(v('V126').cdms_full, '2026-10-02', '100,000 + 138,012 reaches the total on the second payment');
  assert.strictEqual(v('V121').cdms_full, null); assert.strictEqual(v('V121').cdms_status, 'Partly paid 200,000.00 of 460,750.00');
  assert.strictEqual(v('V107').cdms_status, 'No payment');
  assert.deepStrictEqual(P.cdmsPaid('none', 1000), { paid: 0, due: 1000, fullDate: null });
});
test('Confirm is pre-ticked for fully paid lots, only with the switch on; unticking holds a lot back', () => {
  const P = load(), scr = P.byId['FAD/unpaid'], row = id => scr.rows().find(r => r.id === id);
  assert.strictEqual(P.tickDefault(scr, row('V123'), 'cdms_confirm'), false);
  P.setProposed(true);
  assert.strictEqual(P.tickDefault(scr, row('V123'), 'cdms_confirm'), true);
  assert.strictEqual(P.tickDefault(scr, row('V121'), 'cdms_confirm'), false);
  assert.deepStrictEqual(P.selectedRows(scr, 'cdms_confirm').map(r => r.id).sort(), ['V110', 'V111', 'V123', 'V124', 'V126']);
  P.U(scr.id).edits.V123 = { cdms_confirm: false };
  assert.strictEqual(P.tickValue(scr, row('V123'), 'cdms_confirm'), false);
  assert.ok(!P.selectedRows(scr, 'cdms_confirm').some(r => r.id === 'V123'));
});
test('Confirm Buyer Paid sets the CDMS date and logs action Confirm', () => {
  const P = load(), scr = P.byId['FAD/unpaid']; P.setProposed(true);
  const before = P.S.log.length;
  P.recordCdmsPaid(scr, P.selectedRows(scr, 'cdms_confirm'));
  assert.strictEqual(P.S.veh.find(v => v.id === 'V126').buyer_paid, '2026-10-02');
  const added = P.S.log.slice(before);
  assert.strictEqual(added.length, 5);
  assert.ok(added.every(e => e.action === 'Confirm' && e.field === 'Buyer Paid' && e.module === 'FAD'));
  assert.ok(!scr.rows().some(r => r.id === 'V126'), 'confirmed lots leave Unpaid');
});
test('typing Buyer Paid on a lot CDMS does not show fully paid is allowed but counted (switch on only)', () => {
  const P = load(), scr = P.byId['FAD/unpaid']; P.setProposed(true);
  P.U(scr.id).edits = { V121: { buyer_paid: '2026-10-05' }, V123: { buyer_paid: '2026-10-01' } };
  assert.strictEqual(P.saveWarnCount(scr), 1);
  assert.strictEqual(scr.saveWarn.text(1), '1 lot(s) saved without full payment in CDMS.');
  P.setProposed(false); assert.strictEqual(P.saveWarnCount(scr), 0);
});
test('Unpaid shows Paid in CDMS, Confirm and its button only with the switch on', () => {
  const P = load(), scr = P.byId['FAD/unpaid'], keys = () => P.colsOf(scr).map(c => c.key);
  assert.ok(!keys().includes('cdms_status') && !keys().includes('cdms_confirm'));
  P.setProposed(true);
  assert.ok(keys().includes('cdms_status') && keys().includes('cdms_confirm'));
  assert.ok(scr.buttons.filter(P.shown).some(b => b.act === 'confirmPaid'));
});
