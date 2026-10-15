const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness');
test('no badges with the switch off', () => {
  const P = load(); assert.strictEqual(P.queueCounts(P.byId['FAD/payment-seller']), null);
});
test('ready counts agree with the pre-ticks; late counts rows past a deadline column', () => {
  const P = load(); P.setProposed(true);
  const queues = P.SCREENS.filter(s => s.queue === true && s.ready);
  assert.strictEqual(queues.length, 9, 'Unpaid, the 7 P4 lists and SMD SAAF');
  for (const s of queues) assert.strictEqual(P.queueCounts(s).ready, P.selectedRows(s, s.ready.key).length, s.id);
  const ps = P.byId['FAD/payment-seller']; assert.strictEqual(P.queueCounts(ps).late, ps.rows().filter(r => r.pay_deadline < P.TODAY).length);
  assert.strictEqual(P.queueCounts(P.byId['FAD/cancellation-entry']).ready, P.cdmsCancelsPending().length);
  const od = P.byId['VWD/unreleased-unit-overdue']; assert.deepStrictEqual(P.queueCounts(od), { ready: od.rows().length, late: od.rows().length });
  assert.deepStrictEqual(P.queueCounts(P.byId['VWD/unreleased-unit']).late, 0);
});
test('Home lists P1 to P6, each linking to a screen shown with the switch on', () => {
  const P = load(); assert.deepStrictEqual(P.PROPOSALS.map(p => p[0]), ['P1', 'P2', 'P3', 'P4', 'P5', 'P6']);
  P.setProposed(true); for (const [, , link] of P.PROPOSALS) if (link) assert.ok(P.byId[link] && P.shown(P.byId[link]), link);
});
