const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness');
// JBAP feedback of 16 Oct 2026, #4: dates are hard to enter; they can now be typed
test('parseDateInput: typed dates and shortcuts', () => {
  const P = load(), p = s => P.parseDateInput(s, '2026-10-08');
  assert.deepStrictEqual(['t', 'Today', ' T '].map(p), ['2026-10-08', '2026-10-08', '2026-10-08']);
  assert.deepStrictEqual(['10/16/2026', '10-16-2026', '10.16.2026', '10 16 2026', '10/16/26', '10/16', '1016', '10162026', '2026-10-16'].map(p), Array(9).fill('2026-10-16'));
  assert.deepStrictEqual(['1/2', '1/2/2027'].map(p), ['2026-01-02', '2027-01-02']);
  assert.deepStrictEqual(['', '   ', null, undefined].map(p), ['', '', '', '']);
  for (const bad of ['13/01/2026', '02/30/2026', '0/10/2026', 'abc', '10/16/202', '123', '2026-13-01', '10/16/1899']) assert.strictEqual(p(bad), null, bad);
});
test('date cells are typed text boxes with a calendar button; they show mm/dd/yyyy or the text typed', () => {
  const P = load(), scr = P.byId['FAD/unpaid'], r = scr.rows()[0], col = scr.cols.find(c => c.key === 'buyer_paid');
  const h = P.cellHtml(scr, r, col, true);
  assert.match(h, /<input type="text" class="cell-in dt[^"]*" autocomplete="off" placeholder="mm\/dd\/yyyy" value=""/); assert.match(h, /data-pick/);
  P.U(scr.id).edits[r.id] = { buyer_paid: '2026-10-08' }; assert.match(P.cellHtml(scr, r, col, true), /value="10\/08\/2026"/);
  P.U(scr.id).edits[r.id] = { buyer_paid: '13/45' }; assert.match(P.cellHtml(scr, r, col, true), /value="13\/45"/);
});
test('Save reports a date it cannot read and skips the screen rule for that date', () => {
  const P = load(), scr = P.byId['FAD/unpaid'], r = scr.rows()[0];
  P.U(scr.id).edits[r.id] = { buyer_paid: '13/45' };
  const errs = P.validateEdits(scr);
  assert.strictEqual(errs.length, 1); assert.match(errs[0], /<b>Buyer Paid<\/b> is not a valid date \(mm\/dd\/yyyy, or t for today\)/);
  assert.match(P.U(scr.id).errors[r.id].buyer_paid, /not a valid date/);
  P.U(scr.id).edits[r.id] = { buyer_paid: P.TODAY }; assert.deepStrictEqual(P.validateEdits(scr), []);
});
test('form date fields are typed text boxes too', () => {
  const P = load(), h = P.dateField('rl-date', '2026-10-08');
  assert.match(h, /<input type="text" class="ctl dt" autocomplete="off" placeholder="mm\/dd\/yyyy" value="10\/08\/2026" id="rl-date"/); assert.match(h, /data-pick/);
  assert.match(P.dateField('ce-date', '', 'disabled', 'is-invalid'), /class="ctl dt is-invalid"[^>]*value="" id="ce-date" disabled/);
});
test('Liability query: the date box has an error line for text it cannot read', () => {
  const P = load(), scr = P.byId['report/liability-to-seller'], h = P.queryCard(scr);
  assert.match(h, /class="ctl dt"[^>]*value="10\/08\/2026" id="q-asof"/);
  assert.match(h, /<span class="err" id="q-asof-err"><\/span>/);
});
