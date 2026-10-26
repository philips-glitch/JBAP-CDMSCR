const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness');
test('Extend deadline: new date, reason, approver; penalty recalculated; logged', () => {
  const P = load(), scr = P.byId['FAD/unreleased-unit'], v = scr.rows().find(r => r.penalty > 0), old = v.dispatch_deadline, before = P.S.log.length;
  const col = scr.cols.find(c => c.act === 'extendDeadline'); assert.ok(col && !col.isNew && !scr.isNew, 'the 19 Oct New marks are gone');
  assert.match(P.cellHtml(scr, v, col, true), /data-act="extendDeadline"/);
  P.recordDeadlineExtension(scr, v, { date: P.TODAY, reason: 'Buyer hospitalised', by: 'FAD Manager' });
  const after = scr.rows().find(r => r.id === v.id);
  assert.strictEqual(after.dispatch_deadline, P.TODAY); assert.ok(!(after.penalty > 0));
  assert.deepStrictEqual(v._raw.deadline_changes, [{ date: P.TODAY, from: old, to: P.TODAY, reason: 'Buyer hospitalised', by: 'FAD Manager' }]);
  assert.deepStrictEqual(P.S.log.slice(before).map(e => e.field), ['Dispatch Deadline', 'Extension Reason', 'Extension Approved By']);
});
test('extension rules', () => {
  const P = load(), v = P.byId['FAD/unreleased-unit'].rows()[0];
  assert.match(P.extendError(v, { date: v.dispatch_deadline, reason: 'x', by: 'y' }), /after the current deadline/);
  assert.match(P.extendError(v, { date: '2099-01-01', reason: '', by: 'y' }), /Reason/);
  assert.match(P.extendError(v, { date: '2099-01-01', reason: 'x', by: '' }), /Approved by/);
  assert.match(P.extendError(v, { date: null, reason: 'x', by: 'y' }), /mm\/dd\/yyyy/);
  assert.strictEqual(P.extendError(v, { date: '2099-01-01', reason: 'x', by: 'y' }), null);
});
test('read-only fields of the Extend and Record payment dialogs have an accessible name', () => {
  const P = load(), h = P.roField('Penalty due (PHP)', '1,500 & "more"');
  assert.match(h, /<label>Penalty due \(PHP\)<\/label>/); assert.match(h, /<input class="ctl" value="1,500 &amp; &quot;more&quot;" aria-label="Penalty due \(PHP\)" readonly>/);
  for (const label of ['Customer', 'Current deadline', 'Dispatch deadline', 'Days overdue']) assert.match(P.roField(label, 'x'), new RegExp(`aria-label="${label}"`));
});
