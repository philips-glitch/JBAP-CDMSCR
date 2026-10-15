const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness');
test('CDMS cancellations wait for FAD while the lot is still Sold', () => {
  const P = load(), pend = P.cdmsCancelsPending();
  assert.deepStrictEqual(pend.map(x => x.v.id).sort(), ['V107', 'V109', 'V112']);
  assert.ok(pend.every(x => x.c.reason && x.c.date <= P.TODAY && x.c.date >= x.v.awarding));
});
test('confirming creates the same record as Cancellation Entry and leaves the panel', () => {
  const P = load(), scr = P.byId['FAD/cancellation-entry'], { c, v } = P.cdmsCancelsPending().find(x => x.v.id === 'V112');
  const before = P.S.log.length, n = P.S.cancels.length;
  P.recordCancellation(scr, v, { date: c.date, waived: false, just: c.reason });
  assert.strictEqual(P.S.cancels.length, n + 1);
  const rec = P.S.cancels[0];
  assert.deepStrictEqual([rec.plate, rec.dcancel, rec.waived, rec.just, rec.seller], [v.plate, c.date, false, c.reason, 'JACCS']);
  assert.strictEqual(P.S.veh.find(x => x.id === 'V112').status, 'Cancelled');
  assert.ok(P.S.log.slice(before).length > 0 && P.S.log.slice(before).every(e => e.action === 'Cancel'));
  assert.ok(!P.cdmsCancelsPending().some(x => x.v.id === 'V112'));
  assert.ok(P.byId['FAD/cancellation-billing'].rows().some(r => r.plate === v.plate), 'billable like any cancellation');
});
test('Cancellation Entry carries the P2 rule text', () => {
  const P = load(), scr = P.byId['FAD/cancellation-entry'];
  assert.strictEqual(scr.ruleP[0], 'P2');
});
test('a lot is cancelled only once, whichever screen records it', () => {
  const P = load(), scr = P.byId['FAD/cancellation-entry'], { c, v } = P.cdmsCancelsPending().find(x => x.v.id === 'V109');
  const n = P.S.cancels.length, logs = P.S.log.length;
  assert.strictEqual(P.recordCancellation(scr, v, { date: c.date, waived: false, just: c.reason }), true);
  assert.strictEqual(P.recordCancellation(scr, v, { date: c.date, waived: false, just: 'again' }), false);
  assert.strictEqual(P.S.cancels.length, n + 1);
  assert.strictEqual(P.S.log.length - logs, 4, 'one set of Cancel log entries');
});
