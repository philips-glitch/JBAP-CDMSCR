const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness');
// JBAP feedback of 16 Oct 2026, #9: record payment of the storage penalty, then the dispatch deadline becomes today
test('FAD Unreleased Unit: Record payment only on lots with a penalty', () => {
  const P = load(), scr = P.byId['FAD/unreleased-unit'], col = scr.cols.find(c => c.act === 'payPenalty');
  assert.ok(scr.actions.includes('Update')); assert.ok(col, 'payment column'); assert.ok(scr.cols.some(c => c.key === 'penalty_paid'));
  const due = scr.rows().find(r => r.penalty > 0), none = scr.rows().find(r => !(r.penalty > 0));
  assert.match(P.cellHtml(scr, due, col, true), /data-act="payPenalty"/);
  assert.ok(none, 'a lot without penalty'); assert.doesNotMatch(P.cellHtml(scr, none, col, true), /data-act=/);
});
test('paying records it, resets the dispatch deadline to today and no longer blocks the release', () => {
  const P = load(), scr = P.byId['FAD/unreleased-unit'], v = scr.rows().find(r => r.penalty > 0 && !/DOAS/.test(P.releaseBlock(r) || ''));
  const due = v.penalty, before = P.S.log.length;
  assert.match(P.releaseBlock(v), /Storage penalty/); assert.match(P.releaseBlock(v), /Record payment/);
  assert.strictEqual(P.recordPenaltyPayment(scr, v, 'OR-123'), due);
  const after = scr.rows().find(r => r.id === v.id);
  assert.strictEqual(after.dispatch_deadline, P.TODAY); assert.ok(!(after.penalty > 0)); assert.strictEqual(after.penalty_paid, due);
  assert.deepStrictEqual(v._raw.penalty_payments, [{ date: P.TODAY, amount: due, ref: 'OR-123' }]);
  assert.strictEqual(P.releaseBlock(after), null);
  assert.deepStrictEqual(P.S.log.slice(before).map(e => [e.module, e.screen, e.field]), [['FAD', 'Unreleased Unit', 'Penalty Paid'], ['FAD', 'Unreleased Unit', 'Penalty Reference'], ['FAD', 'Unreleased Unit', 'Dispatch Deadline']]);
  assert.ok(P.byId['VWD/unreleased-unit'].rows().some(r => r.id === v.id) && !P.byId['VWD/unreleased-unit-overdue'].rows().some(r => r.id === v.id), 'back in the VWD list within the deadline');
});
test('no reference: no Penalty Reference entry in the log', () => {
  const P = load(), scr = P.byId['FAD/unreleased-unit'], v = scr.rows().find(r => r.penalty > 0), before = P.S.log.length;
  P.recordPenaltyPayment(scr, v, '');
  assert.deepStrictEqual(P.S.log.slice(before).map(e => e.field), ['Penalty Paid', 'Dispatch Deadline']);
});
