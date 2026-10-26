const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness');
const rp = P => P.byId['SMD/result-price'];
test('Result Price lists sold lots not yet released; new, SMD', () => {
  const P = load(), scr = rp(P);
  assert.ok(scr && scr.isNew && scr.dept === 'SMD');
  assert.ok(scr.rows().every(r => r.status === 'Sold' && !r.release));
  assert.ok(scr.cols.some(c => c.key === 'rebate' && c.edit === 'money'));
  assert.ok(scr.cols.some(c => c.key === 'rebate_status'));
  assert.strictEqual(P.byId['FAD/cancellation-entry'], undefined);
  assert.strictEqual(P.routeOf('FAD/cancellation-entry'), 'report/cancellation-monitoring');
  assert.ok(!(P.PROPOSALS || []).some(p => p.id === 'P2' || p[0] === 'P2'));
});
test('Typing a rebate sends it for approval; changing an approved one sends it again', () => {
  const P = load(), scr = rp(P), r = scr.rows().find(x => !x.awarding && !x.rebate);
  P.U(scr.id).edits[r.id] = { rebate: '5000' };
  assert.deepStrictEqual(P.validateEdits(scr), []); P.applyEdits(scr);
  assert.strictEqual(r._raw.rebate, 5000); assert.strictEqual(r._raw.rebate_status, 'Pending approval'); assert.strictEqual(r._raw.rebate_requested, P.TODAY);
  Object.assign(r._raw, { rebate_status: 'Approved', rebate_approved: P.TODAY });
  P.U(scr.id).edits[r.id] = { rebate: '6000' }; P.applyEdits(scr);
  assert.strictEqual(r._raw.rebate_status, 'Pending approval'); assert.strictEqual(r._raw.rebate_approved, null);
  P.U(scr.id).edits[r.id] = { rebate: '' }; P.applyEdits(scr);
  assert.strictEqual(r._raw.rebate, null); assert.ok(!r._raw.rebate_status);
});
test('Rebate locked once awarded; validation as before', () => {
  const P = load(), scr = rp(P), awarded = scr.rows().find(x => x.awarding), open = scr.rows().find(x => !x.awarding);
  const col = scr.cols.find(c => c.key === 'rebate'); assert.ok(col.lockWhen(awarded) && !col.lockWhen(open));
  assert.ok(scr.validate(open, { rebate: '-1' }).rebate); assert.ok(scr.validate(open, { rebate: String(open.price + 1) }).rebate);
});
test('Cancel sale: checks, then cancellation with Waived? and justification', () => {
  const P = load(), scr = rp(P), v = scr.rows().find(x => !x.awarding);
  assert.match(P.cancelSaleError(v, { date: '2999-01-01', waived: false, just: '' }), /after today/);
  assert.match(P.cancelSaleError(v, { date: P.TODAY, waived: true, just: '' }), /Justification/);
  assert.strictEqual(P.cancelSaleError(v, { date: P.TODAY, waived: false, just: '' }), null);
  const n = P.CX().length; assert.ok(P.recordCancellation(scr, v, { date: P.TODAY, waived: true, just: 'Seller agreed' }));
  assert.strictEqual(P.CX().length, n + 1); assert.strictEqual(v._raw.status, 'Cancelled'); assert.strictEqual(P.S.log[P.S.log.length - 1].module, 'SMD');   // the log is appended to: the sample entries come first
  assert.ok(!scr.rows().some(x => x.id === v.id));
  assert.ok(P.byId['report/cancellation-monitoring'].rows().some(c => c.plate === v.plate && c.waived));
});
// Beyond the brief's tests: the request fields, the logging, the checks of the Cancel sale dialog and what the retired Cancellation Entry tests covered
test('rebateRequestFields: a rebate goes to the President as of today with any decision cleared; none (blank or 0) clears all five fields', () => {
  const P = load(), clear = { rebate_status: null, rebate_requested: null, rebate_approved: null, rebate_rejected: null, rebate_reject_reason: null };
  assert.deepStrictEqual(P.rebateRequestFields({}, null, P.TODAY), clear); assert.deepStrictEqual(P.rebateRequestFields({}, 0, P.TODAY), clear);
  assert.deepStrictEqual(P.rebateRequestFields({ rebate_status: 'Rejected' }, 1, P.TODAY), { ...clear, rebate_status: 'Pending approval', rebate_requested: P.TODAY });
});
test('saving a rebate is logged under SMD with the status, the request date and the cleared decision; the same amount again changes nothing', () => {
  const P = load(), scr = rp(P), r = scr.rows().find(x => !x.awarding && !x.rebate), before = P.S.log.length;
  P.U(scr.id).edits[r.id] = { rebate: '5000' }; P.applyEdits(scr);
  let rows = P.S.log.slice(before); assert.ok(rows.every(l => l.module === 'SMD' && l.screen === 'Result Price' && l.action === 'Update'));
  assert.deepStrictEqual(rows.map(l => [l.field, l.old, l.new]), [['Rebate', '', '5,000.00'], ['Rebate Status', '', 'Pending approval'], ['Rebate Requested', '', P.fmtDate(P.TODAY)]]);
  Object.assign(r._raw, { rebate_status: 'Approved', rebate_approved: P.TODAY, rebate_requested: '2026-10-01' });
  const n = P.S.log.length; P.U(scr.id).edits[r.id] = { rebate: '5000.00' }; P.applyEdits(scr);
  assert.strictEqual(r._raw.rebate_status, 'Approved', 'the same amount typed another way keeps the approval'); assert.strictEqual(P.S.log.length, n, 'nothing to log');
  P.U(scr.id).edits[r.id] = { rebate: '7000' }; P.applyEdits(scr); rows = P.S.log.slice(n);
  assert.deepStrictEqual(rows.map(l => [l.field, l.old, l.new]), [['Rebate', '5,000.00', '7,000.00'], ['Rebate Status', 'Approved', 'Pending approval'], ['Rebate Requested', P.fmtDate('2026-10-01'), P.fmtDate(P.TODAY)], ['Rebate Approved', P.fmtDate(P.TODAY), '']]);
  P.U(scr.id).edits[r.id] = { rebate: '0' }; P.applyEdits(scr);
  assert.strictEqual(r._raw.rebate, 0); assert.ok(!r._raw.rebate_status && !r._raw.rebate_requested, 'a 0 rebate is no rebate');
});
test('the rebate cell is a number box until the lot is awarded; Cancel sale is a row button on every row; Rebate Status is read only', () => {
  const P = load(), scr = rp(P), open = scr.rows().find(x => !x.awarding), awarded = scr.rows().find(x => x.awarding), col = k => scr.cols.find(c => c.key === k);
  assert.match(P.cellHtml(scr, open, col('rebate'), true), /<input type="number"[^>]*data-key="rebate"/);
  assert.doesNotMatch(P.cellHtml(scr, awarded, col('rebate'), true), /<input/, 'locked once awarded');
  assert.doesNotMatch(P.cellHtml(scr, open, col('rebate_status'), true), /<input/);
  for (const r of [open, awarded]) assert.match(P.cellHtml(scr, r, col('cancel'), true), new RegExp(`data-act="cancelSale" data-rid="${r.id}"[^>]*>Cancel sale<`));
  assert.deepStrictEqual(scr.cols.map(c => c.label), ['Auction No.', 'Lot', 'Plate Number', 'Make/Model', 'Seller', 'Customer Name', 'Result Price', 'Rebate', 'Rebate Status', 'Awarding Date', 'Cancel']);
  assert.deepStrictEqual(scr.filters.map(f => f.key), ['auction', 'seller', 'customer', 'plate']); assert.deepStrictEqual(scr.sort, ['auction_lot', 'desc']);
  assert.ok(P.ACTIONS.cancelSale && !P.ACTIONS.confirmCdmsCancel && !P.ACTIONS.entryClear, 'the Cancellation Entry actions are gone');
});
test('Cancel sale checks: blank date, future date, before the auction end, justification only when waived', () => {
  const P = load(), v = rp(P).rows().find(x => !x.awarding), ok = { date: P.TODAY, waived: false, just: '' };
  assert.match(P.cancelSaleError(v, { ...ok, date: '' }), /Date Cancelled is required/); assert.match(P.cancelSaleError(v, { ...ok, date: null }), /Date Cancelled is required/);
  assert.strictEqual(P.cancelSaleError(v, { ...ok, date: '1999-01-01' }), `Date Cancelled cannot be before the auction end (${P.fmtDate(v.auction_end)}).`);
  assert.strictEqual(P.cancelSaleError(v, { ...ok, date: v.auction_end }), null, 'the auction end day itself is fine');
  assert.match(P.cancelSaleError(v, { ...ok, waived: true, just: '   ' }), /Justification is required when the fee is waived/);
  assert.strictEqual(P.cancelSaleError(v, { ...ok, waived: true, just: 'Seller agreed' }), null); assert.strictEqual(P.cancelSaleError(v, { ...ok, just: 'optional' }), null);
});
test('a cancellation made in Result Price is the same record as before: logged under SMD, billable unless waived, listed in Report; a lot is cancelled once', () => {
  const P = load(), scr = rp(P), [a, b] = scr.rows().filter(x => !x.awarding), billing = P.byId['FAD/cancellation-billing'];
  const n = P.S.cancels.length, before = P.S.log.length;
  assert.strictEqual(P.recordCancellation(scr, a, { date: P.TODAY, waived: false, just: '' }), true);
  const rec = P.S.cancels[0]; assert.strictEqual(P.S.cancels.length, n + 1);
  assert.deepStrictEqual([rec.plate, rec.auction, rec.lot, rec.dcancel, rec.waived, rec.just, rec.seller, rec.bill_date, rec.paid_date], [a.plate, a.auction, a.lot, P.TODAY, false, '', a.seller, null, null]);
  const logs = P.S.log.slice(before); assert.deepStrictEqual(logs.map(l => [l.module, l.screen, l.action, l.field]), ['Status', 'Date Cancelled', 'Cancellation Fee Waived', 'Justification of Waiver'].map(f => ['SMD', 'Result Price', 'Cancel', f]));
  assert.ok(billing.rows().some(r => r.plate === a.plate && r.penalty === 10000), 'not waived: the penalty is billed');
  assert.strictEqual(P.recordCancellation(scr, a, { date: P.TODAY, waived: false, just: 'again' }), false, 'a second try does nothing'); assert.strictEqual(P.S.cancels.length, n + 1); assert.strictEqual(P.S.log.length - before, 4);
  P.recordCancellation(scr, b, { date: P.TODAY, waived: true, just: 'Seller agreed' });
  assert.ok(!billing.rows().some(r => r.plate === b.plate), 'waived: no penalty to bill'); assert.ok(P.byId['report/cancellation-monitoring'].rows().some(c => c.plate === b.plate && c.waived && c.just === 'Seller agreed'));
  assert.ok(!scr.rows().some(x => x.id === a.id || x.id === b.id), 'cancelled lots leave Result Price');
});
test('the P2 sample and screen are gone: no CDMS cancellation list, proposals P3 to P6 remain, the old link opens Report', () => {
  const P = load(), fs = require('fs'), path = require('path');
  assert.strictEqual(P.D.cdmsCancels, undefined); assert.deepStrictEqual(P.PROPOSALS.map(p => p[0]), ['P3', 'P4', 'P5', 'P6']);
  assert.ok(!P.SCREENS.some(s => (s.ruleP && s.ruleP[0] === 'P2') || s.layout === 'entry'));
  const src = ['app.js', 'data-extra.js', 'index.html'].map(f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8')).join('\n');
  assert.doesNotMatch(src, /cdmsCancels|cdmsCancelPanel|confirmCdmsCancel|entryLayout|entryFind|entryCancel|Cancelled in CDMS/);
  P.location.hash = '#/FAD/cancellation-entry'; assert.strictEqual(P.route(), 'report/cancellation-monitoring');
});
