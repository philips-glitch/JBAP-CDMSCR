const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path');
const { load } = require('./harness');
// JBAP answer Q5 (20 Oct 2026): rebates are recommended by SMD and approved by the President; FAD types the approval date (Rebate Approved (President)).
const NEEDS = "The rebate needs the President's approval date before awarding.";
const pa = P => P.byId['FAD/pending-awarding'];
const lot = (P, o) => Object.assign({}, pa(P).rows().find(r => r.price), { rebate: 5000, rebate_approved: null }, o);

test('Pending Awarding: Rebate Approved (President) is an editable New date column right after Rebate', () => {
  const P = load(), cols = pa(P).cols, i = cols.findIndex(c => c.key === 'rebate');
  const c = cols[i + 1];
  assert.deepStrictEqual([c.key, c.label, c.type, c.edit, c.isNew, !!c.proposed], ['rebate_approved', 'Rebate Approved (President)', 'date', 'date', true, false]);
  assert.match(P.dataCard(pa(P), 'Pending Awarding list'), /<span>Rebate Approved \(President\)<\/span><span class="ptag new"/);
});

test('Rebate Monitoring shows the approval date read-only, New, right after Rebate', () => {
  const P = load(), cols = P.byId['FAD/rebate-monitoring'].cols, i = cols.findIndex(c => c.key === 'rebate'), c = cols[i + 1];
  assert.deepStrictEqual([c.key, c.label, c.type, !!c.edit, c.isNew], ['rebate_approved', 'Rebate Approved (President)', 'date', false, true]);
  const approved = P.byId['FAD/rebate-monitoring'].rows().find(r => r.rebate_approved);
  assert.ok(approved, 'a sample lot with a rebate approval is listed');
  assert.ok(P.cellHtml(P.byId['FAD/rebate-monitoring'], approved, c, false).includes(P.fmtDate(approved.rebate_approved)));
});

test('Pending Awarding rule text: rebates are recommended by SMD and approved by the President; FAD types the date (one added sentence)', () => {
  const P = load(), rule = pa(P).rule;
  assert.match(rule, /Rebates are recommended by SMD and approved by the President \(JBAP answer Q5\); FAD types the approval date\./);
  assert.match(rule, /Rebate is entered here before the BAAF \(proposal, Q73\)\./, 'the earlier sentences stay');
});

test('approval date: not in the future; blank when the lot has no rebate (blank or 0); required with a rebate once an Awarding Date is entered', () => {
  const P = load(), v = pa(P).validate;
  assert.match(v(lot(P), { rebate_approved: '2099-01-01' }).rebate_approved, /after today/);
  for (const rebate of [null, '', 0, '0']) assert.strictEqual(v(lot(P, { rebate }), { rebate_approved: P.TODAY }).rebate_approved, 'No rebate to approve', `rebate ${JSON.stringify(rebate)}`);
  assert.strictEqual(v(lot(P, { rebate: 5000 }), { rebate: '', rebate_approved: P.TODAY }).rebate_approved, 'No rebate to approve', 'a rebate cleared in the same edit');
  assert.strictEqual(v(lot(P, { rebate: null, rebate_approved: P.TODAY }), { rebate: '4000' }).rebate_approved, null, 'a rebate typed in the same edit: the saved approval stands');
  assert.strictEqual(v(lot(P, { rebate_approved: P.TODAY }), { rebate: '' }).rebate_approved, 'No rebate to approve', 'clearing the rebate of an approved lot is refused');
  assert.strictEqual(v(lot(P), { awarding: P.TODAY }).rebate_approved, NEEDS, 'Awarding Date entered, rebate, no approval');
  assert.strictEqual(v(lot(P), { awarding: P.TODAY, rebate_approved: P.TODAY }).rebate_approved, null, 'with the approval');
  assert.strictEqual(v(lot(P, { rebate_approved: P.TODAY }), { awarding: P.TODAY }).rebate_approved, null, 'the saved approval counts');
  assert.strictEqual(v(lot(P), { awarding: P.TODAY, rebate_approved: '' }).rebate_approved, NEEDS, 'a cleared approval date is no approval');
  assert.strictEqual(v(lot(P), { rebate: '4000' }).rebate_approved, null, 'no Awarding Date entered: the rebate alone is fine (approval comes later)');
  assert.strictEqual(v(lot(P, { rebate: null }), { awarding: P.TODAY }).rebate_approved, null, 'no rebate, nothing to approve, awarding goes');
  assert.strictEqual(v(lot(P, { rebate: 0 }), { awarding: P.TODAY }).rebate_approved, null, 'rebate 0 counts as none');
  assert.strictEqual(v(lot(P), { awarding: P.TODAY, rebate: '3000', rebate_approved: P.TODAY }).rebate_approved, null);
});

test('Save changes lists the message with the column name (a capitalised message follows a colon)', () => {
  const P = load(), scr = pa(P), r = scr.rows().find(x => x.rebate && !x.rebate_approved);
  assert.ok(r, 'sample lot with a rebate and no approval');
  P.U(scr.id).edits[r.id] = { awarding: P.TODAY };
  const lines = P.validateEdits(scr);
  assert.strictEqual(lines.length, 1);
  assert.ok(lines[0].includes(`<b>Rebate Approved (President)</b>: ${NEEDS.replace("'", '&#39;')}`), lines[0]);
  assert.strictEqual(P.U(scr.id).errors[r.id].rebate_approved, NEEDS);
  // the other messages are unchanged: label, space, lower-case message
  P.U(scr.id).edits[r.id] = { awarding: '2099-01-01' };
  assert.match(P.validateEdits(scr)[0], /<b>Awarding Date<\/b> cannot be after today/);
  P.U(scr.id).edits = {}; P.U(scr.id).errors = {};
});

test('Email BAAF: lots with a rebate and no approval date are held back, the others still go', () => {
  const P = load(), scr = pa(P), rows = scr.rows(), ed = P.U(scr.id).edits;
  const noRebate = rows.find(r => !r.rebate), approved = rows.find(r => r.rebate && r.rebate_approved), unapproved = rows.find(r => r.rebate && !r.rebate_approved);
  assert.ok(noRebate && approved && unapproved);
  let s = P.baafSplit([noRebate, approved, unapproved], ed);
  assert.deepStrictEqual([s.send.map(r => r.id), s.held.map(r => r.id)], [[noRebate.id, approved.id], [unapproved.id]]);
  ed[unapproved.id] = { rebate_approved: P.TODAY };   // typed on the row, not saved yet
  assert.deepStrictEqual(P.baafSplit([unapproved], ed).held, [], 'a typed approval date lets the lot go');
  ed[unapproved.id] = { rebate_approved: '' };
  assert.strictEqual(P.baafSplit([unapproved], ed).held.length, 1, 'a cleared approval date does not');
  ed[unapproved.id] = { rebate: '' };
  assert.strictEqual(P.baafSplit([unapproved], ed).held.length, 0, 'a rebate cleared on the row: nothing to approve, the lot goes');
  ed[unapproved.id] = { rebate: '0' };
  assert.strictEqual(P.baafSplit([unapproved], ed).held.length, 0, 'rebate 0 counts as none');
  ed[noRebate.id] = { rebate: '1000' };
  assert.deepStrictEqual(P.baafSplit([noRebate], ed).held.map(r => r.id), [noRebate.id], 'a rebate typed on a lot without one, no approval: held');
  s = P.baafSplit([], ed); assert.deepStrictEqual([s.send, s.held], [[], []]);
  Object.keys(ed).forEach(k => delete ed[k]);
});

test('Email BAAF with every ticked lot held back sends nothing and says why, lot by lot', () => {
  const P = load(), scr = pa(P), rows = scr.rows(), unapproved = rows.filter(r => r.rebate && !r.rebate_approved).slice(0, 2);
  rows.forEach(r => { P.U(scr.id).edits[r.id] = { for_baaf: unapproved.some(x => x.id === r.id) }; });
  try { P.ACTIONS.emailBaaf(scr); } catch (e) { /* DOM stub: render() has no #content */ }
  const m = P.U(scr.id).msg;
  assert.ok(m && m.type === 'error', 'an error message is set');
  for (const r of unapproved) assert.ok(m.html.includes(`Lot ${r.lot}`) && m.html.includes(r.plate), r.id);
  assert.ok(m.html.includes('The rebate needs the President&#39;s approval date before awarding.'), m.html);
  assert.strictEqual(pa(P).rows().length, rows.length, 'nothing was awarded');
});

test('awarding through the BAAF saves the typed approval date with the lot and logs it under its field label', () => {
  const P = load(), scr = pa(P), r = scr.rows().find(x => x.rebate && !x.rebate_approved), before = P.S.log.length;
  P.U(scr.id).edits[r.id] = { rebate_approved: P.TODAY };
  P.recordAwarding(scr, [r]);
  assert.strictEqual(r._raw.rebate_approved, P.TODAY);
  const e = P.S.log.slice(before).find(x => x.field === 'Rebate Approved (President)');
  assert.ok(e, 'logged'); assert.deepStrictEqual([e.module, e.screen, e.action, e.old, e.new], ['FAD', 'Pending Awarding', 'Update', '', P.fmtDate(P.TODAY)]);
  assert.strictEqual(P.S.log.slice(before).filter(x => x.field === 'Rebate Approved (President)').length, 1);
  assert.ok(P.byId['FAD/rebate-monitoring'].rows().find(x => x.id === r.id).rebate_approved === P.TODAY, 'the lot shows the date on Rebate Monitoring');
});

test('Save changes saves and logs the approval date like any other edit; the lot stays in Pending Awarding', () => {
  const P = load(), scr = pa(P), r = scr.rows().find(x => x.rebate && !x.rebate_approved), before = P.S.log.length;
  P.U(scr.id).edits[r.id] = { rebate_approved: P.TODAY };
  assert.deepStrictEqual(P.validateEdits(scr), []);
  assert.strictEqual(P.applyEdits(scr), 1);
  assert.strictEqual(r._raw.rebate_approved, P.TODAY);
  assert.ok(pa(P).rows().some(x => x.id === r.id), 'no Awarding Date yet: still listed');
  assert.deepStrictEqual(P.S.log.slice(before).map(x => [x.field, x.old, x.new]), [['Rebate Approved (President)', '', P.fmtDate(P.TODAY)]]);
  // clearing the date again is logged with the old value
  P.U(scr.id).edits[r.id] = { rebate_approved: '' }; P.applyEdits(scr);
  assert.strictEqual(r._raw.rebate_approved, null);
  assert.deepStrictEqual(P.S.log.slice(-1).map(x => [x.field, x.old, x.new]), [['Rebate Approved (President)', P.fmtDate(P.TODAY), '']]);
});

test('[MOCK] sample: Pending Awarding has lots with a rebate and an approval date and lots with a rebate and none; data.js has no approval dates', () => {
  const P = load(), rows = pa(P).rows();
  const withDate = rows.filter(r => r.rebate && r.rebate_approved), without = rows.filter(r => r.rebate && !r.rebate_approved);
  assert.ok(withDate.length >= 1 && withDate.length <= 2, `1 or 2 approved (${withDate.length})`);
  assert.ok(without.length >= 1, 'at least one rebate lot waiting for the approval');
  assert.ok(withDate.every(r => r.rebate_approved <= P.TODAY && r.rebate_approved >= r.auction_end), 'approved after the auction, not in the future');
  assert.ok(P.V().filter(v => v.rebate_approved).every(v => v.rebate > 0), 'no approval on a lot without a rebate');
  assert.ok(rows.some(r => r.rebate && !r.rebate_approved && r.saaf_approved), 'one waiting lot is SAAF-approved: it arrives pre-ticked with the switch on and gets held back');
  const win = {}; new Function('window', fs.readFileSync(path.join(__dirname, '..', 'data.js'), 'utf8'))(win);
  assert.ok(!win.MOCK_DATA.vehicles.some(v => 'rebate_approved' in v), 'data.js is untouched');
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'data-extra.js'), 'utf8'), /\[MOCK\][^\n]*rebate/i, 'the sample carries a [MOCK] comment');
});

test('approval date bounds: not after the Awarding Date in the edit (else the saved date counts); a typed date not before the auction start', () => {
  const P = load(), v = pa(P).validate, base = lot(P, { auction_start: '2026-09-21' }), saved = d => Object.assign({}, base, { rebate_approved: d });
  assert.strictEqual(v(base, { awarding: '2026-09-30', rebate_approved: '2026-10-01' }).rebate_approved, 'cannot be after the Awarding Date (09/30/2026)');
  assert.strictEqual(v(base, { awarding: '2026-09-30', rebate_approved: '2026-09-30' }).rebate_approved, null, 'the same day is fine');
  assert.strictEqual(v(base, { awarding: '2026-09-30', rebate_approved: '2026-09-25' }).rebate_approved, null);
  assert.strictEqual(v(saved('2026-10-02'), { awarding: '2026-10-01' }).rebate_approved, 'cannot be after the Awarding Date (10/01/2026)', 'the saved approval is checked against the typed Awarding Date');
  assert.strictEqual(v(saved('2026-09-25'), { awarding: '2026-10-01' }).rebate_approved, null);
  assert.strictEqual(v(base, { rebate_approved: '2026-10-01' }).rebate_approved, null, 'no Awarding Date in the edit: no upper bound');
  assert.strictEqual(v(base, { awarding: '', rebate_approved: '2026-10-01' }).rebate_approved, null, 'a blank Awarding Date is no Awarding Date');
  assert.strictEqual(v(base, { rebate_approved: '2026-09-20' }).rebate_approved, 'cannot be before the auction start (09/21/2026)');
  assert.strictEqual(v(base, { rebate_approved: '2026-09-21' }).rebate_approved, null, 'the auction start itself is fine');
  assert.strictEqual(v(saved('2026-09-01'), { awarding: '2026-10-01' }).rebate_approved, null, 'a saved date is not re-checked against the auction start when it is not typed');
  assert.strictEqual(v(saved('2026-09-01'), { rebate: '4000' }).rebate_approved, null);
  assert.strictEqual(v(base, { awarding: '2026-09-23', rebate_approved: '2026-09-24' }).rebate_approved, 'cannot be after the Awarding Date (09/23/2026)', 'both bounds: the lower one passes, the upper one fails');
  assert.match(v(base, { rebate_approved: '2099-01-01' }).rebate_approved, /after today/, 'the future check stays first');
  assert.strictEqual(v(lot(P, { rebate: null, auction_start: '2026-09-21' }), { rebate_approved: '2026-09-20' }).rebate_approved, 'cannot be before the auction start (09/21/2026)', 'a bound error comes before "No rebate to approve"');
  const r = pa(P).rows().find(x => x.rebate && x.auction_start);   // a real lot: its own auction start
  assert.strictEqual(v(r, { rebate_approved: P.D.auctions[String(r.auction)][0] }).rebate_approved, null);
  const d = new Date(r.auction_start + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - 1);
  assert.strictEqual(v(r, { rebate_approved: d.toISOString().slice(0, 10) }).rebate_approved, 'cannot be before the auction start (' + P.fmtDate(r.auction_start) + ')');
});

test('Save changes lists the bound errors with the column name', () => {
  const P = load(), scr = pa(P), r = scr.rows().find(x => x.rebate && !x.rebate_approved);
  P.U(scr.id).edits[r.id] = { awarding: P.TODAY, rebate_approved: '2000-01-01' };
  const lines = P.validateEdits(scr); assert.strictEqual(lines.length, 1);
  assert.match(lines[0], /<b>Rebate Approved \(President\)<\/b> cannot be before the auction start \(/);
  P.U(scr.id).edits = {}; P.U(scr.id).errors = {};
});

test('Email BAAF marks each held lot\'s Rebate Approved cell invalid with the same message, next to the other errors', () => {
  const P = load(), scr = pa(P), rows = scr.rows(), col = scr.cols.find(c => c.key === 'rebate_approved'), ed = P.U(scr.id).edits;
  const held = rows.find(r => r.rebate && !r.rebate_approved), other = rows.find(r => !r.rebate && r.id !== held.id);
  const call = () => { try { P.ACTIONS.emailBaaf(scr); } catch (e) { /* DOM stub: render() has no #content; the state is set before it */ } };
  // only the held lot: nothing can be sent, the cell is marked
  ed[held.id] = { for_baaf: true }; call();
  assert.strictEqual(P.U(scr.id).errors[held.id].rebate_approved, NEEDS);
  const td = P.cellHtml(scr, held, col, true);
  assert.match(td, /aria-invalid="true" title="Rebate Approved \(President\): The rebate needs the President&#39;s approval date before awarding\."/);
  assert.match(td, /class="cell-in dt  is-invalid"/);
  // another ticked lot has its own error: validateEdits replaces ui.errors, the held mark is merged in afterwards
  P.U(scr.id).errors = {}; ed[other.id] = { for_baaf: true, awarding: '2099-01-01' }; call();
  const errs = P.U(scr.id).errors;
  assert.match(errs[other.id].awarding, /after today/); assert.strictEqual(errs[held.id].rebate_approved, NEEDS);
  // a lot that goes (nothing wrong) leaves no mark
  P.U(scr.id).errors = {}; delete ed[other.id]; const fine = rows.find(r => !r.rebate && r.id !== held.id && r.id !== other.id); ed[fine.id] = { for_baaf: true }; call();
  assert.strictEqual(P.U(scr.id).errors[held.id].rebate_approved, NEEDS); assert.ok(!P.U(scr.id).errors[fine.id]);
  Object.keys(ed).forEach(k => delete ed[k]); P.U(scr.id).errors = {};
});

test('Rebate Monitoring rule: the approval date is blank for lots awarded before it was recorded', () => {
  const P = load(), rule = P.byId['FAD/rebate-monitoring'].rule;
  assert.match(rule, /Rebate Approved \(President\) is blank for lots awarded before the approval date was recorded\./);
  assert.match(rule, /Download report saves an Excel file/, 'the earlier sentences stay');
});
