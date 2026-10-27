const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness');
const rp = P => P.byId['auction/result-price'];
const live = scr => scr.rows().filter(x => x.status === 'Sold' && !x.release);   // the lots Update acts on
test('Result Price is the existing Auction screen: every lot with an auction status; Update on sold lots not released', () => {
  const P = load(), scr = rp(P);
  assert.ok(scr && scr.isNew && scr.dept === 'Auction'); assert.strictEqual(P.byId['SMD/result-price'], undefined); assert.strictEqual(P.routeOf('SMD/result-price'), 'auction/result-price');
  const st = new Set(scr.rows().map(r => r.status)); assert.ok(st.has('Sold') && st.has('Not Sold') && st.has('Cancelled'));
  const upd = scr.cols.find(c => c.key === 'upd'); assert.ok(scr.rows().every(r => !!upd.showWhen(r) === (r.status === 'Sold' && !r.release)));
  assert.ok(scr.cols.some(c => c.key === 'rebate' && c.edit === 'money'));
  assert.ok(scr.cols.some(c => c.key === 'rebate_status'));
  assert.strictEqual(P.byId['FAD/cancellation-entry'], undefined);
  assert.strictEqual(P.routeOf('FAD/cancellation-entry'), 'report/cancellation-monitoring');
  assert.ok(!(P.PROPOSALS || []).some(p => p.id === 'P2' || p[0] === 'P2'));
});
test('Typing a rebate sends it for approval; changing an approved one sends it again', () => {
  const P = load(), scr = rp(P), r = live(scr).find(x => !x.awarding && !x.rebate);
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
  const P = load(), scr = rp(P), awarded = live(scr).find(x => x.awarding), open = live(scr).find(x => !x.awarding && !x.rebate);
  const col = scr.cols.find(c => c.key === 'rebate'); assert.ok(col.lockWhen(awarded) && !col.lockWhen(open));
  assert.ok(scr.validate(open, { rebate: '-1' }).rebate); assert.ok(scr.validate(open, { rebate: String(open.price + 1) }).rebate);
});
test('Cancel sale: checks, then cancellation with Waived? and justification', () => {
  const P = load(), scr = rp(P), v = live(scr).find(x => !x.awarding);
  assert.match(P.cancelSaleError(v, { date: '2999-01-01', waived: false, just: '' }), /after today/);
  assert.match(P.cancelSaleError(v, { date: P.TODAY, waived: true, just: '' }), /Justification/);
  assert.strictEqual(P.cancelSaleError(v, { date: P.TODAY, waived: false, just: '' }), null);
  const n = P.CX().length; assert.ok(P.recordCancellation(scr, v, { date: P.TODAY, waived: true, just: 'Seller agreed' }));
  assert.strictEqual(P.CX().length, n + 1); assert.strictEqual(v._raw.status, 'Cancelled'); assert.strictEqual(P.S.log[P.S.log.length - 1].module, 'Auction');   // the log is appended to: the sample entries come first
  assert.strictEqual(scr.rows().find(x => x.id === v.id).status, 'Cancelled', 'the lot stays, as Cancelled');
  assert.ok(P.byId['report/cancellation-monitoring'].rows().some(c => c.plate === v.plate && c.waived));
});
// Beyond the brief's tests: the request fields, the logging, the checks of the Cancel sale dialog and what the retired Cancellation Entry tests covered
test('rebateRequestFields: a rebate goes to the President as of today with any decision cleared; none (blank or 0) clears all five fields', () => {
  const P = load(), clear = { rebate_status: null, rebate_requested: null, rebate_approved: null, rebate_rejected: null, rebate_reject_reason: null };
  assert.deepStrictEqual(P.rebateRequestFields({}, null, P.TODAY), clear); assert.deepStrictEqual(P.rebateRequestFields({}, 0, P.TODAY), clear);
  assert.deepStrictEqual(P.rebateRequestFields({ rebate_status: 'Rejected' }, 1, P.TODAY), { ...clear, rebate_status: 'Pending approval', rebate_requested: P.TODAY });
});
test('saving a rebate is logged under SMD with the status, the request date and the cleared decision; the same amount again changes nothing', () => {
  const P = load(), scr = rp(P), r = live(scr).find(x => !x.awarding && !x.rebate), before = P.S.log.length;
  P.U(scr.id).edits[r.id] = { rebate: '5000' }; P.applyEdits(scr);
  let rows = P.S.log.slice(before); assert.ok(rows.every(l => l.module === 'Auction' && l.screen === 'Result Price' && l.action === 'Update'));
  assert.deepStrictEqual(rows.map(l => [l.field, l.old, l.new]), [['Rebate', '', '5,000.00'], ['Rebate Status', '', 'Pending approval'], ['Rebate Requested', '', P.fmtDate(P.TODAY)]]);
  Object.assign(r._raw, { rebate_status: 'Approved', rebate_approved: P.TODAY, rebate_requested: '2026-10-01' });
  const n = P.S.log.length; P.U(scr.id).edits[r.id] = { rebate: '5000.00' }; P.applyEdits(scr);
  assert.strictEqual(r._raw.rebate_status, 'Approved', 'the same amount typed another way keeps the approval'); assert.strictEqual(P.S.log.length, n, 'nothing to log');
  P.U(scr.id).edits[r.id] = { rebate: '7000' }; P.applyEdits(scr); rows = P.S.log.slice(n);
  assert.deepStrictEqual(rows.map(l => [l.field, l.old, l.new]), [['Rebate', '5,000.00', '7,000.00'], ['Rebate Status', 'Approved', 'Pending approval'], ['Rebate Requested', P.fmtDate('2026-10-01'), P.fmtDate(P.TODAY)], ['Rebate Approved', P.fmtDate(P.TODAY), '']]);
  P.U(scr.id).edits[r.id] = { rebate: '0' }; P.applyEdits(scr);
  assert.strictEqual(r._raw.rebate, 0); assert.ok(!r._raw.rebate_status && !r._raw.rebate_requested, 'a 0 rebate is no rebate');
});
test('the rebate cell is a number box until the lot is awarded; Auction Status and Update on sold lots not released; the layout of CDMS Set Result Price', () => {
  const P = load(), scr = rp(P), open = live(scr).find(x => !x.awarding && !x.rebate), awarded = live(scr).find(x => x.awarding), col = k => scr.cols.find(c => c.key === k);
  assert.match(P.cellHtml(scr, open, col('rebate'), true), /<input type="number"[^>]*data-key="rebate"/);
  assert.doesNotMatch(P.cellHtml(scr, awarded, col('rebate'), true), /<input/, 'locked once awarded');
  assert.doesNotMatch(P.cellHtml(scr, open, col('rebate_status'), true), /<input/);
  for (const r of [open, awarded]) { assert.match(P.cellHtml(scr, r, col('upd'), true), new RegExp(`data-act="rpUpdate" data-rid="${r.id}"[^>]*>Update<`)); assert.match(P.cellHtml(scr, r, col('status_set'), true), /<select[^>]*data-key="status_set"/); }
  const done = scr.rows().find(x => x.status !== 'Sold'); assert.strictEqual(P.cellHtml(scr, done, col('upd'), true), '<td class="c"></td>'); assert.doesNotMatch(P.cellHtml(scr, done, col('status_set'), true), /<select/);
  assert.deepStrictEqual(scr.cols.map(c => c.label), ['Update', 'Auction Status', 'Auction No.', 'Lot No.', 'Model', 'Plate Number', 'Seller', 'Buyer ID', 'Buyer Name', 'Start Price', 'Minimum Bid Price', 'Highest Offer Price', 'Rebate', 'Rebate Status', 'Winner Confirmation', 'Offer Status', 'KYC Status', 'Justification Log']);
  assert.deepStrictEqual(scr.filters.map(f => f.key), ['seller', 'auction', 'lot', 'plate', 'status']); assert.strictEqual(scr.sort, undefined);
  assert.deepStrictEqual(scr.cols.filter(c => c.isNew).map(c => c.key), ['status_set', 'rebate', 'rebate_status'], 'only the new fields carry the New badge');
  assert.ok(P.ACTIONS.cancelSale && P.ACTIONS.rpUpdate && !P.ACTIONS.confirmCdmsCancel && !P.ACTIONS.entryClear, 'the Cancellation Entry actions are gone');
});
test('Cancel sale checks: blank date, future date, before the auction end, justification only when waived', () => {
  const P = load(), v = live(rp(P)).find(x => !x.awarding), ok = { date: P.TODAY, waived: false, just: '' };
  assert.match(P.cancelSaleError(v, { ...ok, date: '' }), /Date Cancelled is required/); assert.match(P.cancelSaleError(v, { ...ok, date: null }), /Date Cancelled is required/);
  assert.strictEqual(P.cancelSaleError(v, { ...ok, date: '1999-01-01' }), `Date Cancelled cannot be before the auction end (${P.fmtDate(v.auction_end)}).`);
  assert.strictEqual(P.cancelSaleError(v, { ...ok, date: v.auction_end }), null, 'the auction end day itself is fine');
  assert.match(P.cancelSaleError(v, { ...ok, waived: true, just: '   ' }), /Justification is required when the fee is waived/);
  assert.strictEqual(P.cancelSaleError(v, { ...ok, waived: true, just: 'Seller agreed' }), null); assert.strictEqual(P.cancelSaleError(v, { ...ok, just: 'optional' }), null);
});
test('a cancellation made in Result Price is the same record as before: logged under SMD, billable unless waived, listed in Report; a lot is cancelled once', () => {
  const P = load(), scr = rp(P), [a, b] = live(scr).filter(x => !x.awarding), billing = P.byId['FAD/cancellation-billing'];
  const n = P.S.cancels.length, before = P.S.log.length;
  assert.strictEqual(P.recordCancellation(scr, a, { date: P.TODAY, waived: false, just: '' }), true);
  const rec = P.S.cancels[0]; assert.strictEqual(P.S.cancels.length, n + 1);
  assert.deepStrictEqual([rec.plate, rec.auction, rec.lot, rec.dcancel, rec.waived, rec.just, rec.seller, rec.bill_date, rec.paid_date], [a.plate, a.auction, a.lot, P.TODAY, false, '', a.seller, null, null]);
  const logs = P.S.log.slice(before); assert.deepStrictEqual(logs.map(l => [l.module, l.screen, l.action, l.field]), ['Status', 'Date Cancelled', 'Cancellation Fee Waived', 'Justification of Waiver'].map(f => ['Auction', 'Result Price', 'Cancel', f]));
  assert.ok(billing.rows().some(r => r.plate === a.plate && r.penalty === 10000), 'not waived: the penalty is billed');
  assert.strictEqual(P.recordCancellation(scr, a, { date: P.TODAY, waived: false, just: 'again' }), false, 'a second try does nothing'); assert.strictEqual(P.S.cancels.length, n + 1); assert.strictEqual(P.S.log.length - before, 4);
  P.recordCancellation(scr, b, { date: P.TODAY, waived: true, just: 'Seller agreed' });
  assert.ok(!billing.rows().some(r => r.plate === b.plate), 'waived: no penalty to bill'); assert.ok(P.byId['report/cancellation-monitoring'].rows().some(c => c.plate === b.plate && c.waived && c.just === 'Seller agreed'));
  assert.ok([a, b].every(l => scr.rows().find(x => x.id === l.id).status === 'Cancelled'), 'cancelled lots show as Cancelled'); assert.strictEqual(scr.rows().find(x => x.id === b.id).just_log, 'Seller agreed');
});
test('the P2 sample and screen are gone: no CDMS cancellation list, proposals P3 to P6 remain, the old link opens Report', () => {
  const P = load(), fs = require('fs'), path = require('path');
  assert.strictEqual(P.D.cdmsCancels, undefined); assert.deepStrictEqual(P.PROPOSALS.map(p => p[0]), ['P3', 'P4', 'P5', 'P6']);
  assert.ok(!P.SCREENS.some(s => (s.ruleP && s.ruleP[0] === 'P2') || s.layout === 'entry'));
  const src = ['app.js', 'data-extra.js', 'index.html'].map(f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8')).join('\n');
  assert.doesNotMatch(src, /cdmsCancels|cdmsCancelPanel|confirmCdmsCancel|entryLayout|entryFind|entryCancel|Cancelled in CDMS/);
  P.location.hash = '#/FAD/cancellation-entry'; assert.strictEqual(P.route(), 'report/cancellation-monitoring');
});
test('merged with the parallel version: a pending or approved rebate is locked (a rejected one can be retyped), Winner Confirmation prints, lots that can take a rebate come first, Home has an Auction card', () => {
  const P = load(), scr = rp(P), col = scr.cols.find(c => c.key === 'rebate'), open = live(scr).find(x => !x.awarding && !x.rebate);
  for (const [st, locked] of [['Pending approval', true], ['Approved', true], ['Rejected', false]]) assert.strictEqual(!!col.lockWhen({ ...open, rebate: 5000, rebate_status: st }), locked, st);
  assert.ok(col.lockWhen({ ...open, rebate: 5000, rebate_status: null }), 'an Access rebate with no status counts as approved');
  const sold = scr.rows().find(x => x.status === 'Sold'), notSold = scr.rows().find(x => x.status !== 'Sold'), win = scr.cols.find(c => c.key === 'winner');
  assert.match(P.cellHtml(scr, sold, win, true), /data-act="printWinner"[^>]*>Print</); assert.strictEqual(P.cellHtml(scr, notSold, win, true), '<td class="c"></td>');
  const can = r => r.status === 'Sold' && !r.release && !r.awarding, rows = scr.rows(), firstNo = rows.findIndex(r => !can(r));
  assert.ok(firstNo > 0 && rows.slice(firstNo).every(r => !can(r)), 'the lots that can take a rebate come first'); assert.strictEqual(scr.sort, undefined);
  assert.match(P.homeLayout(), /<b>Auction<\/b>[^]*?Result Price/);
});
