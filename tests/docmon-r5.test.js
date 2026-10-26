const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness');
const dm = P => P.byId['FAD/document-monitoring'];
test('List: Sold and paid to the seller (EWB: buyer paid); no Pending Payment or Cancelled', () => {
  const P = load(), rows = dm(P).rows();
  assert.deepStrictEqual(P.DOC_STATUSES, ['Pending DOAS', 'DOAS for Signing', 'Pending Documents', 'For Releasing', 'Complete']);
  assert.ok(rows.every(r => r.status === 'Sold'));
  assert.ok(rows.every(r => P.doasOf(r) === 'branch' ? !!r.buyer_paid : !!r.pay_seller));
  assert.ok(rows.some(r => r.seller === 'TFS'));
  assert.ok(rows.every(r => P.DOC_STATUSES.includes(r.doc_status)));
});
test('Filled dates are read-only; blank ones editable', () => {
  const P = load(), scr = dm(P), r = scr.rows().find(x => x.rcv_doas), col = scr.cols.find(c => c.key === 'rcv_doas');
  assert.ok(col.lockWhen(r)); assert.ok(!col.lockWhen(scr.rows().find(x => !x.rcv_doas && P.doasOf(x) === 'jbap')));
  assert.ok(scr.cols.find(c => c.key === 'change_date' && c.type === 'rowbtn' && c.isNew));
});
test('Change date: reason required, same checks, logged with the reason', () => {
  const P = load(), scr = dm(P), r = scr.rows().find(x => x.rcv_doas && x.pay_seller);
  // the new date must keep the order with the later dates of the row (fix round 1): Buyer Paid is before every date of the row, so it keeps the order
  const keep = r.buyer_paid; assert.ok(keep && keep !== r.rcv_doas && keep < r._raw.rcv_doas);
  assert.match(P.changeDateError(r, 'rcv_doas', keep, '') || '', /reason/i);
  assert.match(P.changeDateError(r, 'rcv_doas', '2999-01-01', 'typo') || '', /after today/);
  assert.ok(P.changeDateError(r, 'rcv_doas', '2000-01-01', 'typo'));
  assert.strictEqual(P.changeDateError(r, 'rcv_doas', keep, 'Typed the wrong day'), null);
  P.recordDateChange(scr, r, 'rcv_doas', keep, 'Typed the wrong day');
  assert.strictEqual(r._raw.rcv_doas, keep);
  const top = P.S.log.slice(-2).map(l => l.field); assert.ok(top.includes('Receipt of DOAS') && top.includes('Change reason'));
});
test('DOC_DATE_FIELDS are the date columns of the screen, in the screen order; each of them locks when filled', () => {
  const P = load(), scr = dm(P);
  assert.deepStrictEqual(P.DOC_DATE_FIELDS.map(f => f[0]), ['ewb_callout', 'ewb_signed', 'rcv_doas', 'buyer_doas', 'seller_doas', 'orig_docs', 'to_buyer']);
  assert.deepStrictEqual(scr.cols.filter(c => c.lockWhen).map(c => [c.key, c.label]), P.DOC_DATE_FIELDS);
  assert.ok(scr.cols.filter(c => c.lockWhen).every(c => c.edit === 'date'));
  const text = scr.cols.filter(c => c.edit === 'text' || c.edit === 'check'); assert.ok(text.length === 3 && text.every(c => !c.lockWhen), 'EWB HO/Store, Remarks and Print Transmittal stay editable');
});
test('Cells: a filled date shows as text, a blank one as a typed box; a saved date locks, an unsaved one stays editable', () => {
  const P = load(), scr = dm(P), col = k => scr.cols.find(c => c.key === k);
  const filled = scr.rows().find(r => r.orig_docs), blank = scr.rows().find(r => !r.orig_docs && P.doasOf(r) === 'jbap');
  assert.doesNotMatch(P.cellHtml(scr, filled, col('orig_docs'), true), /<input/); assert.match(P.cellHtml(scr, filled, col('orig_docs'), true), /\d\d\/\d\d\/\d{4}/);
  assert.match(P.cellHtml(scr, blank, col('orig_docs'), true), /class="cell-in dt/);
  P.U(scr.id).edits[blank.id] = { orig_docs: P.TODAY };   // typed, not saved
  assert.ok(!col('orig_docs').lockWhen(scr.rows().find(r => r.id === blank.id)), 'an unsaved date stays editable');
  assert.match(P.cellHtml(scr, blank, col('orig_docs'), true), /is-dirty/);
  P.applyEdits(scr);
  const saved = scr.rows().find(r => r.id === blank.id); assert.ok(col('orig_docs').lockWhen(saved), 'saved: now read-only');
  assert.doesNotMatch(P.cellHtml(scr, saved, col('orig_docs'), true), /<input/);
  const text = scr.rows().find(r => r.doc_remarks !== undefined) || scr.rows()[0]; assert.match(P.cellHtml(scr, text, col('doc_remarks'), true), /<input type="text"/, 'Remarks stays editable');
});
test('Change date button only on rows with a date; the dialog action exists', () => {
  const P = load(), scr = dm(P), col = scr.cols.find(c => c.key === 'change_date');
  const none = scr.rows().find(r => P.DOC_DATE_FIELDS.every(([k]) => !r._raw[k])), some = scr.rows().find(r => r.rcv_doas);
  assert.ok(none && some, 'sample has both');
  assert.strictEqual(P.cellHtml(scr, none, col, true), '<td class="c"></td>');
  assert.match(P.cellHtml(scr, some, col, true), new RegExp(`<button type="button" class="btn ol" data-act="changeDate" data-rid="${some.id}" aria-label="Change date of`));
  assert.strictEqual(typeof P.ACTIONS.changeDate, 'function'); assert.ok(scr.isNew, 'the screen changed in round 5');
});
test('Change date errors: no date, not a date, same date, before Buyer Paid, in the future; each names the problem', () => {
  const P = load(), r = dm(P).rows().find(x => x.rcv_doas && x.pay_seller);
  assert.strictEqual(P.changeDateError(r, 'rcv_doas', '', 'typo'), 'Type the new date as mm/dd/yyyy.');
  assert.strictEqual(P.changeDateError(r, 'rcv_doas', null, 'typo'), 'Type the new date as mm/dd/yyyy.');
  assert.strictEqual(P.changeDateError(r, 'rcv_doas', P.TODAY, '   '), 'A reason is required.', 'blanks are no reason');
  assert.strictEqual(P.changeDateError(r, 'rcv_doas', '', ''), 'A reason is required.', 'the reason is checked first');
  assert.match(P.changeDateError(r, 'rcv_doas', r.rcv_doas, 'typo'), /same as the current date/);
  assert.match(P.changeDateError(r, 'rcv_doas', '2000-01-01', 'typo'), /^New date cannot be before Buyer Paid \(/);
  assert.match(P.changeDateError(r, 'rcv_doas', '2999-01-01', 'typo'), /^New date cannot be after today \(/);
  const ewb = dm(P).rows().find(x => x.doas === 'branch' && x.ewb_callout && x.ewb_signed);
  assert.match(P.changeDateError(ewb, 'ewb_signed', '2026-01-01', 'typo'), /before/, 'EWB: before the call-out or Buyer Paid');
});
test('Change date: saves the date, logs old to new and the reason as the newest rows, and the status and aging follow', () => {
  const P = load(), scr = dm(P), r = scr.rows().find(x => x.doas === 'branch' && x.ewb_callout && !x.ewb_signed && !x.orig_docs);
  assert.ok(r, 'sample: an EWB lot called out, not signed'); assert.strictEqual(r.doc_status, 'DOAS for Signing');
  const old = r.ewb_callout, ni = P.TODAY, n = P.S.log.length;
  assert.strictEqual(P.changeDateError(r, 'ewb_callout', ni, ' Called on the right day '), null);
  P.recordDateChange(scr, r, 'ewb_callout', ni, ' Called on the right day ');
  const rows = P.S.log.slice(n); assert.strictEqual(rows.length, 2);
  assert.deepStrictEqual(rows.map(l => [l.module, l.screen, l.action, l.field, l.old, l.new]), [
    ['FAD', 'Document Monitoring', 'Update', 'EWB Call Out', P.fmtDate(old), P.fmtDate(ni)],
    ['FAD', 'Document Monitoring', 'Update', 'Change reason', '', 'Called on the right day']]);
  assert.strictEqual(P.S.log.at(-1).field, 'Change reason'); assert.strictEqual(P.S.log.at(-1).record, rows[0].record);
  const after = scr.rows().find(x => x.id === r.id); assert.strictEqual(after.ewb_callout, ni); assert.strictEqual(after.doc_status, 'DOAS for Signing');
  assert.strictEqual(after.doas_aging, P.workdaysBetween(after.buyer_paid, P.TODAY), 'EWB: aging counts from Buyer Paid');
});
test('Status of EWB lots: the call-out starts DOAS for Signing, a buyer-paid EWB lot with no seller payment is listed', () => {
  const P = load(), rows = dm(P).rows(), ewb = rows.filter(r => r.doas === 'branch');
  assert.ok(ewb.length > 0 && ewb.every(r => r.buyer_paid));
  assert.ok(ewb.every(r => !(r.doc_status === 'DOAS for Signing') || r.ewb_callout || r.rcv_doas), 'DOAS for Signing: a call-out (or a receipt of DOAS)');
  assert.ok(ewb.some(r => !r.pay_seller), 'sample: EWB lot listed on Buyer Paid alone');
  assert.ok(rows.filter(r => r.doas !== 'branch').every(r => r.pay_seller));
});
// Fix round 1 (controller ruling, 26 Oct 2026): Change date also checks the later dates that depend on the changed one
test('Change date: a change that puts a later date out of order is refused, names that date, and saves and logs nothing', () => {
  const P = load(), scr = dm(P), r = scr.rows().find(x => x.rcv_doas && x.buyer_doas && x.pay_seller), n = P.S.log.length, before = JSON.stringify(P.DOC_DATE_FIELDS.map(([k]) => r._raw[k]));
  const late = P.TODAY; assert.ok(r._raw.buyer_doas < late, 'sample: JBAP Receipt of Signed DOAS is before today');
  const err = P.changeDateError(r, 'rcv_doas', late, 'Typed the wrong day');
  assert.strictEqual(err, `JBAP Receipt of Signed DOAS (${P.fmtDate(r._raw.buyer_doas)}) cannot be before Receipt of DOAS (${P.fmtDate(late)}).`);
  assert.strictEqual(P.S.log.length, n, 'nothing is logged'); assert.strictEqual(JSON.stringify(P.DOC_DATE_FIELDS.map(([k]) => r._raw[k])), before, 'no date is changed');
  // the change that keeps the order is fine: the day the later date has
  assert.strictEqual(P.changeDateError(r, 'rcv_doas', r._raw.buyer_doas, 'Typed the wrong day'), null);
  // the other chains: JBAP receipt past the seller receipt, JBAP documents past the buyer's, EWB call-out past the signing
  const lot = (seller, f) => P.enrichV(Object.assign({ status: 'Sold', seller, buyer_paid: '2026-09-01' }, f));
  const sbc = lot('SBC', { rcv_doas: '2026-09-05', buyer_doas: '2026-09-10', seller_doas: '2026-09-12', orig_docs: '2026-09-15', to_buyer: '2026-09-20' });
  assert.strictEqual(P.changeDateError(sbc, 'buyer_doas', '2026-09-13', 'x'), 'Seller Receipt of Signed DOAS (09/12/2026) cannot be before JBAP Receipt of Signed DOAS (09/13/2026).');
  assert.strictEqual(P.changeDateError(sbc, 'orig_docs', '2026-09-21', 'x'), 'Buyer Receipt of Documents (09/20/2026) cannot be before JBAP Receipt of Documents (09/21/2026).');
  assert.strictEqual(P.changeDateError(sbc, 'orig_docs', '2026-09-20', 'x'), null, 'the same day is in order');
  const ewb = lot('EWB', { ewb_callout: '2026-09-05', ewb_signed: '2026-09-10' });
  assert.strictEqual(P.changeDateError(ewb, 'ewb_callout', '2026-09-11', 'x'), 'Date DOAS Signed (EWB) (09/10/2026) cannot be before EWB Call Out (09/11/2026).');
  assert.strictEqual(P.changeDateError(ewb, 'ewb_callout', '2026-09-10', 'x'), null);
  // the date itself is still checked first, and a change to the latest date has no later date to break
  assert.match(P.changeDateError(sbc, 'rcv_doas', '2026-08-01', 'x'), /^New date cannot be before Buyer Paid/);
  assert.strictEqual(P.changeDateError(sbc, 'to_buyer', '2026-09-30', 'x'), null);
});
test('Change date: dates the row already had out of order (JBAP sheet) are not blamed on an unrelated change', () => {
  const P = load(), lot = f => P.enrichV(Object.assign({ status: 'Sold', seller: 'SBC', buyer_paid: '2026-09-01' }, f));
  const v = lot({ rcv_doas: '2026-10-05', buyer_doas: '2026-10-01', seller_doas: '2026-10-02' });   // JBAP's own order: the JBAP receipt is before Receipt of DOAS
  assert.strictEqual(P.changeDateError(v, 'orig_docs', '2026-10-06', 'x'), null, 'a document date is fine');
  assert.strictEqual(P.changeDateError(v, 'seller_doas', '2026-10-03', 'x'), null, 'the seller date is in order with the JBAP date');
  assert.match(P.changeDateError(v, 'rcv_doas', '2026-10-06', 'x'), /^JBAP Receipt of Signed DOAS \(10\/01\/2026\) cannot be before Receipt of DOAS \(10\/06\/2026\)\.$/, 'still broken after the change: refused');
  assert.strictEqual(P.changeDateError(v, 'rcv_doas', '2026-09-30', 'x'), null, 'the change that repairs the order is allowed');
});
// Fix round 1: DOAS Aging of an EWB lot counts from Buyer Paid, the date the lot enters the list
test('DOAS Aging for EWB counts from Buyer Paid (not Seller Payment); other sellers still from Seller Payment', () => {
  const P = load(), v = (seller, f) => P.enrichV(Object.assign({ status: 'Sold', seller, buyer_paid: '2026-10-02' }, f));
  assert.strictEqual(v('EWB', {}).doas_aging, P.workdaysBetween('2026-10-02', P.TODAY), 'EWB, no Seller Payment yet: counted');
  assert.strictEqual(v('EWB', { pay_seller: '2026-10-06' }).doas_aging, P.workdaysBetween('2026-10-02', P.TODAY), 'Seller Payment does not move the start');
  assert.strictEqual(v('EWB', { ewb_callout: '2026-10-05' }).doas_aging, P.workdaysBetween('2026-10-02', P.TODAY), 'DOAS for Signing: still counting until signed');
  assert.strictEqual(v('EWB', { ewb_callout: '2026-10-05', ewb_signed: '2026-10-06' }).doas_aging, null, 'signed: blank');
  assert.strictEqual(v('SBC', { pay_seller: '2026-10-06' }).doas_aging, P.workdaysBetween('2026-10-06', P.TODAY), 'JBAP sellers: from Seller Payment');
  assert.strictEqual(v('SBC', {}).doas_aging, null, 'no Seller Payment: nothing to count from');
  const rows = dm(P).rows().filter(r => r.doas === 'branch' && ['Pending DOAS', 'DOAS for Signing'].includes(r.doc_status));
  assert.ok(rows.length > 10 && rows.some(r => !r.pay_seller), 'sample: waiting EWB lots, some with no Seller Payment');
  assert.ok(rows.every(r => r.doas_aging === P.workdaysBetween(r.buyer_paid, P.TODAY) && r.doas_aging !== null));
  assert.match(dm(P).rule, /DOAS Aging from Seller Payment \(EWB: from Buyer Paid\)/);
});
