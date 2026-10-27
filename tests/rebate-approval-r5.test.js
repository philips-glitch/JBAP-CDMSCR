const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path');
const { load } = require('./harness');
// JBAP feedback, 26 Oct 2026: SMD types the rebate in Result Price; the President approves or rejects it in Approval › Rebate Approval;
// FAD › Pending Awarding then shows the approved rebate only (read-only) with its Rebate Status.
test('President approves or rejects; Pending Awarding shows the approved amount only', () => {
  const P = load(), ap = P.byId['approval/rebate-approval'], pa = P.byId['FAD/pending-awarding'];
  assert.ok(ap && ap.isNew && ap.dept === 'Approval');
  const pend = ap.rows().filter(r => r.rebate_status === 'Pending approval'); assert.ok(pend.length >= 2);
  const [a, b] = pend;
  assert.match(P.recordRebateDecision(ap, b, 'Rejected', '') || '', /reason/i);
  assert.strictEqual(P.recordRebateDecision(ap, a, 'Approved'), null);
  assert.strictEqual(a._raw.rebate_status, 'Approved'); assert.strictEqual(a._raw.rebate_approved, P.TODAY); assert.strictEqual(P.S.log.at(-1).module, 'Approval');
  assert.strictEqual(P.recordRebateDecision(ap, b, 'Rejected', 'Commission too low'), null);
  assert.strictEqual(b._raw.rebate_status, 'Rejected'); assert.strictEqual(b._raw.rebate_reject_reason, 'Commission too low');
  const rowA = pa.rows().find(r => r.id === a.id), rowB = pa.rows().find(r => r.id === b.id);
  assert.strictEqual(P.approvedRebate(rowA), a._raw.rebate); assert.strictEqual(P.approvedRebate(rowB), null);
  assert.ok(!pa.cols.some(c => c.key === 'rebate' && c.edit), 'rebate is read-only on Pending Awarding');
  assert.ok(!pa.cols.some(c => c.key === 'rebate_approved' && c.edit));
  assert.ok(pa.cols.some(c => c.key === 'rebate_status' && c.isNew));
});
test('A pending rebate blocks awarding (Save and Email BAAF)', () => {
  const P = load(), pa = P.byId['FAD/pending-awarding'], v = pa.rows().find(r => r.rebate_status === 'Pending approval');
  P.U(pa.id).edits[v.id] = { awarding: P.TODAY };
  assert.ok(P.validateEdits(pa).some(e => /waiting for the President/.test(JSON.stringify(e))));
  const { held, send } = P.baafSplit(pa.rows().filter(r => r.id === v.id || r.rebate_status !== 'Pending approval').slice(0, 3), {});
  assert.ok(held.some(r => r.id === v.id)); assert.ok(!send.some(r => r.id === v.id));
});
test('Report Rebate Monitoring and FAD Rebate Payable list approved rebates only', () => {
  const P = load(), rm = P.byId['report/rebate-monitoring'], rp = P.byId['FAD/rebate-payable'];
  assert.ok(rm.rows().every(r => P.approvedRebate(r) !== null)); assert.ok(rp.rows().every(r => P.approvedRebate(r) !== null));
  assert.ok(P.byId['log-activity'].filters.find(f => f.key === 'module').options().includes('Approval'));
});

// ---- more checks -------------------------------------------------------------------------------------------------------
const pa = P => P.byId['FAD/pending-awarding'], ap = P => P.byId['approval/rebate-approval'];
const PENDING_MSG = "The rebate is waiting for the President's approval.";
test('approvedRebate: the rebate only when it is approved, or has no status (Access data); none for pending, rejected, blank or 0', () => {
  const P = load(), f = P.approvedRebate;
  assert.strictEqual(f({ rebate: 5000, rebate_status: 'Approved' }), 5000);
  assert.strictEqual(f({ rebate: 5000 }), 5000, 'Access data: a rebate and no status counts as approved');
  assert.strictEqual(f({ rebate: 5000, rebate_status: null }), 5000);
  for (const s of ['Pending approval', 'Rejected']) assert.strictEqual(f({ rebate: 5000, rebate_status: s }), null, s);
  for (const rebate of [null, undefined, 0, '']) assert.strictEqual(f({ rebate, rebate_status: 'Approved' }), null, `rebate ${JSON.stringify(rebate)}`);
  assert.strictEqual(P.REBATE_PENDING, PENDING_MSG);
});
test('[MOCK] sample: the six Pending Awarding lots with a rebate show 2 Approved, 3 Pending approval, 1 Rejected; data.js is untouched', () => {
  const P = load(), rows = pa(P).rows().filter(r => r.rebate), by = s => rows.filter(r => r.rebate_status === s);
  assert.strictEqual(rows.length, 6);
  assert.deepStrictEqual([by('Approved').length, by('Pending approval').length, by('Rejected').length], [2, 3, 1]);
  for (const r of rows) assert.ok(r.rebate_requested >= r.auction_end && r.rebate_requested <= P.TODAY, `${r.id} requested after the auction, not in the future`);
  for (const r of by('Approved')) assert.ok(r.rebate_approved >= r.rebate_requested && r.rebate_approved <= P.TODAY && !r.rebate_rejected, r.id);
  for (const r of by('Pending approval')) assert.ok(!r.rebate_approved && !r.rebate_rejected && !r.rebate_reject_reason, r.id);
  const rej = by('Rejected')[0]; assert.ok(rej.rebate_rejected >= rej.rebate_requested && rej.rebate_rejected <= P.TODAY && rej.rebate_reject_reason && !rej.rebate_approved);
  assert.ok(rows.some(r => r.rebate_status === 'Pending approval' && r.saaf_approved), 'a pending lot is SAAF-approved: it arrives pre-ticked with the switch on and gets held back');
  const win = {}; new Function('window', fs.readFileSync(path.join(__dirname, '..', 'data.js'), 'utf8'))(win);
  assert.ok(!win.MOCK_DATA.vehicles.some(v => 'rebate_status' in v || 'rebate_approved' in v), 'data.js is untouched');
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'data-extra.js'), 'utf8'), /\[MOCK\] JBAP 26 Oct 2026: rebates typed by SMD in Result Price, decided by the President/);
});
test('recordRebateDecision: approving logs the status and the date under Approval; rejecting logs the status, the date and the reason', () => {
  const P = load(), scr = ap(P), [a, b] = scr.rows().filter(r => r.rebate_status === 'Pending approval'), n = P.S.log.length;
  assert.strictEqual(P.recordRebateDecision(scr, a, 'Approved'), null);
  const rows = P.S.log.slice(n);
  assert.deepStrictEqual(rows.map(l => [l.module, l.screen, l.action, l.field, l.old, l.new]),
    [['Approval', 'Rebate Approval', 'Update', 'Rebate Status', 'Pending approval', 'Approved'], ['Approval', 'Rebate Approval', 'Update', 'Rebate Approved', '', P.fmtDate(P.TODAY)]]);
  assert.ok(rows.every(l => l.record === `Auction ${a.auction}, Lot ${a.lot} · ${a.plate}`));
  const m = P.S.log.length;
  assert.strictEqual(P.recordRebateDecision(scr, b, 'Rejected', '  Too high  '), null);
  assert.strictEqual(b._raw.rebate_reject_reason, 'Too high', 'the reason is trimmed'); assert.strictEqual(b._raw.rebate_rejected, P.TODAY); assert.ok(!b._raw.rebate_approved);
  assert.deepStrictEqual(P.S.log.slice(m).map(l => [l.field, l.old, l.new]), [['Rebate Status', 'Pending approval', 'Rejected'], ['Rebate Rejected', '', P.fmtDate(P.TODAY)], ['Reject Reason', '', 'Too high']]);
});
test('recordRebateDecision: a blank reason is refused and changes nothing; only a pending rebate can be decided', () => {
  const P = load(), scr = ap(P), a = scr.rows().find(r => r.rebate_status === 'Pending approval'), n = P.S.log.length;
  for (const why of [undefined, null, '', '   ']) assert.strictEqual(P.recordRebateDecision(scr, a, 'Rejected', why), 'A reason is required to reject a rebate.', JSON.stringify(why));
  assert.strictEqual(a._raw.rebate_status, 'Pending approval'); assert.strictEqual(P.S.log.length, n, 'nothing logged');
  assert.strictEqual(P.recordRebateDecision(scr, a, 'Approved'), null);
  const again = P.S.log.length;
  for (const d of ['Approved', 'Rejected']) assert.strictEqual(P.recordRebateDecision(scr, a, d, 'x'), 'This rebate is not waiting for a decision.', d);
  assert.strictEqual(a._raw.rebate_status, 'Approved'); assert.strictEqual(P.S.log.length, again);
  const none = P.sold().find(v => !v.rebate_status); assert.strictEqual(P.recordRebateDecision(scr, none, 'Approved'), 'This rebate is not waiting for a decision.');
});
test('Approval › Rebate Approval: rows, default filter, sort, columns, filters, menu count and row buttons', () => {
  const P = load(), scr = ap(P), all = scr.rows(), pend = all.filter(r => r.rebate_status === 'Pending approval');
  assert.deepStrictEqual(scr.actions, ['View', 'Filter', 'Sort', 'Update']);
  assert.match(scr.rule, /The President approves or rejects the rebates SMD typed in Result Price/);
  assert.ok(all.every(r => r.rebate_status && r.status === 'Sold')); assert.strictEqual(all.length, 6);
  assert.deepStrictEqual(P.U(scr.id).applied, { rebate_status: ['Pending approval'] }, 'the default filter is the pending rebates');
  assert.deepStrictEqual(P.applyFilters(scr, all).map(r => r.id).sort(), pend.map(r => r.id).sort());
  P.U(scr.id).applied = { rebate_status: ['Approved', 'Rejected'] };
  assert.strictEqual(P.applyFilters(scr, all).length, all.length - pend.length, 'Approved and Rejected can be picked for history');
  assert.deepStrictEqual(scr.sort, ['auction', 'desc']);   // opens latest auction first (user request, 27 Oct 2026)
  assert.deepStrictEqual(scr.cols.map(c => c.label), ['Auction No.', 'Lot', 'Plate Number', 'Make/Model', 'Seller', 'Customer Name', 'Result Price', 'Rebate', 'Requested', 'Rebate Status', 'Decided', 'Reason', 'Approve', 'Reject']);
  assert.deepStrictEqual(scr.filters.map(f => f.label), ['Rebate Status', 'Auction No.', 'Seller', 'Plate Number']);
  assert.deepStrictEqual(scr.filters[0].options(), ['Pending approval', 'Approved', 'Rejected']);
  assert.ok(!scr.cols.some(c => c.edit), 'nothing is typed on this screen');
  assert.strictEqual(P.countOf(scr), pend.length, 'the menu number counts the pending rebates, not the rows');
  const col = k => scr.cols.find(c => c.key === k), done = all.find(r => r.rebate_status === 'Approved');
  for (const k of ['approve', 'reject']) {
    assert.match(P.cellHtml(scr, pend[0], col(k), true), new RegExp(`data-act="${k}Rebate" data-rid="${pend[0].id}" aria-label="${k === 'approve' ? 'Approve' : 'Reject'} rebate of ${pend[0].plate}"`));
    assert.strictEqual(P.cellHtml(scr, done, col(k), true), '<td class="c"></td>', `no ${k} button on a decided rebate`);
  }
  assert.strictEqual(typeof P.ACTIONS.approveRebate, 'function'); assert.strictEqual(typeof P.ACTIONS.rejectRebate, 'function');
  P.U(scr.id).applied = { rebate_status: ['Pending approval'] };
  const card = P.dataCard(scr, 'x');
  assert.strictEqual((card.match(/data-act="approveRebate"/g) || []).length, pend.length, 'one Approve button per pending row');
  assert.strictEqual((card.match(/data-act="rejectRebate"/g) || []).length, pend.length, 'one Reject button per pending row');
});
test('Rebate Approval: the Decided date is the approval or the rejection date, the Reason is the rejection reason', () => {
  const P = load(), scr = ap(P), a = scr.rows().find(r => r.rebate_status === 'Pending approval'), b = scr.rows().find(r => r.rebate_status === 'Rejected');
  assert.strictEqual(a.rebate_decided, null); assert.strictEqual(b.rebate_decided, b._raw.rebate_rejected);
  P.recordRebateDecision(scr, a, 'Approved'); assert.strictEqual(scr.rows().find(r => r.id === a.id).rebate_decided, P.TODAY);
  const rej = scr.rows().find(r => r.id === b.id); assert.ok(rej.rebate_reject_reason);
  assert.ok(P.cellHtml(scr, rej, scr.cols.find(c => c.key === 'rebate_reject_reason'), true).includes(rej.rebate_reject_reason));
});
test('sidebar: Approval is a top menu right after Report and before FAD, with Rebate Approval (New) and the pending count', () => {
  const P = load(), s = P.sideHtml('approval/rebate-approval'), pend = ap(P).rows().filter(r => r.rebate_status === 'Pending approval').length;
  assert.ok(s.indexOf('data-group="Report"') < s.indexOf('data-group="Approval"') && s.indexOf('data-group="Approval"') < s.indexOf('data-group="FAD"'));
  assert.match(s, /<button type="button" class="mi" data-group="Approval" aria-expanded="false" aria-controls="grp-Approval"><svg/);
  assert.match(s, new RegExp(`<a class="mis is-active" href="#/approval/rebate-approval" aria-current="page">Rebate Approval<span class="ptag mini new"[^>]*>New</span><span class="cnt">${pend}</span></a>`));
  assert.ok(pend >= 2 && pend < ap(P).rows().length);
  assert.match(s, /only Customer Inquiry, Sales Actions, Auction › Result Price, Report, Approval, FAD, SMD, VWD, Master › Holiday List and Log Activity are active/);
  assert.strictEqual(P.routeOf('approval/rebate-approval'), 'approval/rebate-approval');
  P.setProposed(true); assert.strictEqual(P.routeOf('approval/rebate-approval'), 'approval/rebate-approval'); assert.ok(P.shown(ap(P)));
  assert.match(P.pageHead(ap(P)), /Home<\/a>›<span>Approval<\/span>›<b>Rebate Approval<\/b>/);
});
test('Log Activity: Approval is a Module option, has its own empty note, and shows the President\'s decisions', () => {
  const P = load(), log = P.byId['log-activity'];
  assert.deepStrictEqual(log.filters.find(f => f.key === 'module').options(), ['FAD', 'SMD', 'VWD', 'Auction', 'Approval', 'Master']);
  assert.match(log.rule, /every rebate decision of the President in Approval/);
  P.U(log.id).applied = { module: ['Approval'] }; assert.match(log.emptyNote(), /Approval logs an entry each time the President approves or rejects a rebate/);
  P.recordRebateDecision(ap(P), ap(P).rows().find(r => r.rebate_status === 'Pending approval'), 'Approved');
  const shown = P.applyFilters(log, log.rows()); assert.strictEqual(shown.length, 2); assert.ok(shown.every(l => l.module === 'Approval'));
});
test('Pending Awarding: Rebate (approved) and Rebate Status are read-only New columns; the amount shows only when approved', () => {
  const P = load(), scr = pa(P), col = k => scr.cols.find(c => c.key === k), keys = scr.cols.map(c => c.key);
  assert.deepStrictEqual([col('rebate_ok').label, col('rebate_ok').type, !!col('rebate_ok').edit, col('rebate_ok').isNew], ['Rebate (approved)', 'money', false, true]);
  assert.deepStrictEqual([col('rebate_status').label, col('rebate_status').type, !!col('rebate_status').edit, col('rebate_status').isNew], ['Rebate Status', 'text', false, true]);
  assert.ok(keys.indexOf('rebate_ok') === keys.indexOf('awarding') + 1 && keys.indexOf('rebate_status') === keys.indexOf('rebate_ok') + 1);
  assert.ok(!keys.includes('rebate') && !keys.includes('rebate_approved'), 'round 4\'s editable columns are gone');
  assert.match(P.dataCard(scr, 'x'), /<span>Rebate \(approved\)<\/span><span class="ptag new"/);
  assert.match(P.dataCard(scr, 'x'), /<span>Rebate Status<\/span><span class="ptag new"/);
  for (const r of scr.rows()) assert.strictEqual(r.rebate_ok, P.approvedRebate(r._raw), r.id);
  const by = s => scr.rows().find(r => r.rebate_status === s);
  assert.ok(by('Approved').rebate_ok > 0); assert.strictEqual(by('Pending approval').rebate_ok, null); assert.strictEqual(by('Rejected').rebate_ok, null);
  assert.match(P.cellHtml(scr, by('Approved'), col('rebate_ok'), true), /^<td class="r ?">[\d,]+\.\d\d<\/td>$/);
  assert.match(P.cellHtml(scr, by('Pending approval'), col('rebate_ok'), true), /^<td class="r ?"><\/td>$/, 'blank while pending');
  assert.doesNotMatch(P.cellHtml(scr, by('Pending approval'), col('rebate_status'), true), /<input/);
  assert.match(scr.rule, /Rebate \(approved\) shows the rebate the President approved/); assert.match(scr.rule, /cannot be awarded/);
  assert.doesNotMatch(scr.rule, /Q73|Q5/);
});
test('Pending Awarding: only a Pending approval rebate blocks the Awarding Date; approved, rejected and no rebate are fine', () => {
  const P = load(), scr = pa(P), v = scr.validate, by = s => scr.rows().find(r => r.rebate_status === s), none = scr.rows().find(r => !r.rebate);
  assert.strictEqual(v(by('Pending approval'), { awarding: P.TODAY }).awarding, PENDING_MSG);
  for (const r of [by('Approved'), by('Rejected'), none]) assert.strictEqual(v(r, { awarding: P.TODAY }).awarding, null, r.id);
  assert.strictEqual(v(by('Pending approval'), { for_baaf: true }).awarding, null, 'no Awarding Date in the edit: nothing to block');
  assert.strictEqual(v(by('Pending approval'), { awarding: '' }).awarding, null, 'a blank Awarding Date is no Awarding Date');
  assert.match(v(by('Pending approval'), { awarding: '2099-01-01' }).awarding, /after today/, 'the date checks come first');
  assert.strictEqual(v(none, { rebate: '5000' }).rebate, undefined, 'there is no rebate check here any more');
  P.U(scr.id).edits[by('Pending approval').id] = { awarding: P.TODAY };
  const lines = P.validateEdits(scr); assert.strictEqual(lines.length, 1);
  assert.ok(lines[0].includes('<b>Awarding Date</b>: The rebate is waiting for the President&#39;s approval.'), lines[0]);
  assert.strictEqual(P.U(scr.id).errors[by('Pending approval').id].awarding, PENDING_MSG);
  P.U(scr.id).edits = {}; P.U(scr.id).errors = {};
});
test('Email BAAF: pending lots are held back, others go (a rejected rebate goes without a rebate); a held lot shows the message on its Awarding Date cell', () => {
  const P = load(), scr = pa(P), rows = scr.rows(), ed = P.U(scr.id).edits, by = s => rows.find(r => r.rebate_status === s), none = rows.find(r => !r.rebate);
  const pend = rows.filter(r => r.rebate_status === 'Pending approval');
  let s = P.baafSplit([none, by('Approved'), by('Rejected'), ...pend], ed);
  assert.deepStrictEqual(s.held.map(r => r.id), pend.map(r => r.id)); assert.deepStrictEqual(s.send.map(r => r.id), [none, by('Approved'), by('Rejected')].map(r => r.id));
  s = P.baafSplit([], ed); assert.deepStrictEqual([s.send, s.held], [[], []]);
  const call = () => { try { P.ACTIONS.emailBaaf(scr); } catch (e) { /* DOM stub: render() has no #content; the state is set before it */ } };
  rows.forEach(r => { ed[r.id] = { for_baaf: r.id === pend[0].id || r.id === pend[1].id }; }); call();
  const m = P.U(scr.id).msg; assert.ok(m && m.type === 'error' && m.html.includes('The rebate is waiting for the President&#39;s approval.'), 'nothing can be sent: says why');
  for (const r of [pend[0], pend[1]]) assert.ok(m.html.includes(`Lot ${r.lot}`) && m.html.includes(r.plate));
  const awd = scr.cols.find(c => c.key === 'awarding'), td = P.cellHtml(scr, pend[0], awd, true);
  assert.strictEqual(P.U(scr.id).errors[pend[0].id].awarding, PENDING_MSG);
  assert.match(td, /aria-invalid="true" title="Awarding Date: The rebate is waiting for the President&#39;s approval\."/); assert.match(td, /class="cell-in dt  is-invalid"/);
  // another ticked lot with its own error: the held mark is merged in after the other errors
  P.U(scr.id).errors = {}; ed[none.id] = { for_baaf: true, awarding: '2099-01-01' }; call();
  assert.match(P.U(scr.id).errors[none.id].awarding, /after today/); assert.strictEqual(P.U(scr.id).errors[pend[0].id].awarding, PENDING_MSG);
  assert.strictEqual(pa(P).rows().length, rows.length, 'nothing was awarded');
  Object.keys(ed).forEach(k => delete ed[k]); P.U(scr.id).errors = {};
});
test('Awarding an approved lot saves the Awarding Date and leaves the approved rebate as it is; it shows in Rebate Monitoring', () => {
  const P = load(), scr = pa(P), r = scr.rows().find(x => x.rebate_status === 'Approved'), rebate = r._raw.rebate, before = P.S.log.length, rm = P.byId['report/rebate-monitoring'];
  assert.ok(rm.rows().some(x => x.id === r.id), 'approved: listed already');
  P.recordAwarding(scr, [r]);
  assert.strictEqual(r._raw.awarding, P.TODAY); assert.strictEqual(r._raw.rebate, rebate); assert.strictEqual(r._raw.rebate_status, 'Approved');
  const log = P.S.log.slice(before); assert.ok(log.some(l => l.field === 'Awarding Date')); assert.ok(!log.some(l => /^Rebate/.test(l.field)), 'nothing about the rebate is typed here');
  assert.ok(!scr.rows().some(x => x.id === r.id)); assert.strictEqual(rm.rows().find(x => x.id === r.id).rebate_approved, r._raw.rebate_approved);
});
test('Report › Rebate Monitoring and FAD › Rebate Payable: approved rebates only; Access rebates (no status) stay; a decision moves a lot in or out', () => {
  const P = load(), rm = P.byId['report/rebate-monitoring'], rp = P.byId['FAD/rebate-payable'], ids = s => s.rows().map(r => r.id);
  const lot = P.S.veh.find(v => v.status === 'Sold' && v.rebate && v.buyer_paid && !v.rebate_paid && !v.rebate_status);   // an Access lot: a rebate, paid by the buyer, not yet paid out
  assert.ok(lot, 'sample Access lot'); assert.ok(ids(rm).includes(lot.id) && ids(rp).includes(lot.id), 'no status: counts as approved');
  lot.rebate_status = 'Pending approval'; assert.ok(!ids(rm).includes(lot.id) && !ids(rp).includes(lot.id), 'pending: in neither');
  lot.rebate_status = 'Rejected'; assert.ok(!ids(rm).includes(lot.id) && !ids(rp).includes(lot.id), 'rejected: in neither');
  lot.rebate_status = 'Approved'; assert.ok(ids(rm).includes(lot.id) && ids(rp).includes(lot.id), 'approved: in both');
  const pending = P.sold().find(v => v.rebate_status === 'Pending approval'); assert.ok(!ids(rm).includes(pending.id));
  assert.ok(rm.rows().length > 0 && rp.rows().length > 0);
  assert.match(rm.rule, /Only rebates the President approved are listed/); assert.match(rp.rule, /Only rebates the President approved are listed/);
  assert.match(rp.rule, /status SOLD, a rebate, a Buyer Paid date, and a blank Rebate Paid date/, 'the Buyer Paid and no Rebate Paid rule stays');
  assert.strictEqual(rm.totals(rm.rows()).plate, `${rm.rows().length} lots`);
});
test('Rebate Monitoring keeps its read-only Rebate Approved (President) date right after Rebate', () => {
  const P = load(), rm = P.byId['report/rebate-monitoring'], cols = rm.cols, i = cols.findIndex(c => c.key === 'rebate'), c = cols[i + 1];
  assert.deepStrictEqual([c.key, c.label, c.type, !!c.edit, !!c.isNew], ['rebate_approved', 'Rebate Approved (President)', 'date', false, false]);
  const approved = rm.rows().find(r => r.rebate_approved);
  assert.ok(approved, 'a sample lot with an approval date is listed');
  assert.ok(P.cellHtml(rm, approved, c, false).includes(P.fmtDate(approved.rebate_approved)));
  assert.match(rm.rule, /Rebate Approved \(President\) is blank for lots awarded before the approval date was recorded\./);
  assert.match(rm.rule, /Download report saves an Excel file/, 'the earlier sentences stay');
});
test('Result Price: a rebate with no status (Access data) on a lot not awarded is sent for approval when it is saved, even with the same amount', () => {
  const P = load(), rp = P.byId['auction/result-price'], raw = P.S.veh.find(v => v.id === 'V102');
  Object.assign(raw, { rebate_status: null, rebate_requested: null, rebate_approved: null });   // as Access has it: a rebate and no status
  const r = rp.rows().find(x => x.id === 'V102'); assert.ok(r && !r.awarding && r.rebate === 15000);
  P.U(rp.id).edits[r.id] = { rebate: '15000.00' }; assert.deepStrictEqual(P.validateEdits(rp), []); P.applyEdits(rp);
  assert.strictEqual(raw.rebate, 15000); assert.strictEqual(raw.rebate_status, 'Pending approval'); assert.strictEqual(raw.rebate_requested, P.TODAY);
  assert.ok(ap(P).rows().some(x => x.id === 'V102' && x.rebate_status === 'Pending approval'), 'it is waiting in Rebate Approval');
  // with a status the same amount changes nothing (round 5, task 3)
  Object.assign(raw, { rebate_status: 'Approved', rebate_approved: P.TODAY });
  const n = P.S.log.length; P.U(rp.id).edits[r.id] = { rebate: '15000.0' }; P.applyEdits(rp);
  assert.strictEqual(raw.rebate_status, 'Approved'); assert.strictEqual(P.S.log.length, n);
});
