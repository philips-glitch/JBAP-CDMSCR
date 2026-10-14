const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness');
const P = load();
test('cancellation penalty split', () => {
  assert.deepStrictEqual(P.cancelSplit({ seller: 'SBC', waived: false }), { penalty: 10000, pen_seller: 5000, pen_jbap: 5000 });
  assert.deepStrictEqual(P.cancelSplit({ seller: 'EWB', waived: false }), { penalty: 10000, pen_seller: 0, pen_jbap: 10000 });
  assert.deepStrictEqual(P.cancelSplit({ seller: null, waived: true }), { penalty: 0, pen_seller: 0, pen_jbap: 0 });
});
test('recording the cancellation billing sets the amount to the penalty', () => {
  const scr = P.byId['FAD/cancellation-billing'], r = scr.rows()[0];
  P.recordCancellationBilling(scr, [r]);
  const c = P.CX().find(x => x.id === r.id);
  assert.strictEqual(c.bill_date, P.TODAY); assert.strictEqual(c.amount, 10000);
});
test('storage penalty only for Pasay City / JBAP', () => {
  const v = P.S.veh.find(x => x.dispatch && !x.release && P.enrichV(x).penalty > 0);
  v.location = 'Cavite'; assert.strictEqual(P.enrichV(v).penalty, null);
  v.location = 'Pasay City'; assert.ok(P.enrichV(v).penalty > 0);
});
