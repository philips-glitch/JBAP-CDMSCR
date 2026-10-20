const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness');
// JBAP answer Q11 (20 Oct 2026): "Let's include this to minimize human intervention." The SAAF is standard; its pre-tick and the Finance-only dispatch copy stay proposed (P5).
test('SAAF screen is standard (shown with the switch off, New, no P5 tag) and lists the same lots as FAD Pending Awarding', () => {
  const P = load(), scr = P.byId['SMD/saaf'];
  assert.ok(scr && P.shown(scr), 'shown with the switch off'); assert.ok(!scr.proposed && !scr.tag && scr.isNew);
  P.setProposed(true); assert.ok(P.shown(scr)); P.setProposed(false);
  assert.deepStrictEqual(scr.rows().map(r => r.id).sort(), P.byId['FAD/pending-awarding'].rows().map(r => r.id).sort());
  assert.ok(scr.actions.includes('Update'));
  for (const on of [false, true]) {   // no P5 tag on the screen, its menu entry or its page head
    P.setProposed(on);
    assert.doesNotMatch(P.pageHead(scr), /P5/, `page head, switch ${on}`);
    const entry = P.sideHtml('').match(/<a class="mis[^>]*>Seller Awarding Acknowledgement(?:<span[^>]*>[^<]*<\/span>)*/)[0];
    assert.doesNotMatch(entry, /P5/, `menu entry, switch ${on}`); assert.match(entry, /ptag mini new/);
  }
  P.setProposed(false);
  assert.match(P.sideHtml(''), /href="#\/SMD\/saaf"[^>]*>Seller Awarding Acknowledgement<span class="ptag mini new"[^>]*>New<\/span><span class="cnt">\d+<\/span>/);
  assert.match(P.homeLayout(), /href="#\/SMD\/saaf">Seller Awarding Acknowledgement<span class="ptag mini new"/);
});
test('SAAF sample data loads with the switch off: 4 approved, 3 sent and waiting, and the screen works as an update screen', () => {
  const P = load(), scr = P.byId['SMD/saaf'], rows = scr.rows();
  assert.strictEqual(P.isProposed(), false);
  assert.strictEqual(rows.filter(r => r.saaf_approved).length, 4); assert.strictEqual(rows.filter(r => r.saaf_sent && !r.saaf_approved).length, 3);
  assert.deepStrictEqual(P.colsOf(scr).map(c => c.key + (c.edit ? '*' : '')), ['seller', 'auction', 'lot', 'plate', 'model', 'price', 'for_saaf*', 'saaf_sent', 'saaf_approved*']);
  assert.deepStrictEqual((scr.buttons || []).filter(P.shown).map(b => b.act), ['emailSaaf', 'save']);
  assert.deepStrictEqual(P.selectedRows(scr, 'for_saaf'), [], 'switch off: nothing is pre-ticked for the SAAF');
  const sent = rows.find(r => r.id === 'V087'); P.U(scr.id).edits[sent.id] = { saaf_approved: P.TODAY };
  assert.deepStrictEqual(P.validateEdits(scr), []); assert.strictEqual(P.applyEdits(scr), 1); assert.strictEqual(sent._raw.saaf_approved, P.TODAY);
});
test('P5 now covers only the pre-tick of approved lots and the Finance-only dispatch copy; everything else of the SAAF is standard', () => {
  const P = load(), p5 = P.PROPOSALS.find(p => p[0] === 'P5');
  assert.match(p5[1], /pre-ticked/); assert.match(p5[1], /Finance/);
  assert.doesNotMatch(p5[1], /SMD sends the SAAF|records the seller approval/, 'the SAAF screen itself is no longer a proposal');
  assert.strictEqual(p5[2], 'FAD/pending-awarding');
  const pa = P.byId['FAD/pending-awarding'], sa = pa.cols.find(c => c.key === 'saaf_approved');
  assert.ok(!sa.proposed && !sa.tag && sa.isNew, 'Seller Approved on Pending Awarding is part of the standard SAAF flow, marked New');
  assert.strictEqual(pa.ruleP[0], 'P5'); assert.match(pa.ruleP[1], /pre-ticked/);
  assert.match(P.byId['FAD/for-dispatch'].ruleP[1], /copied to Finance only \(P5\)/);
  assert.ok(!P.byId['SMD/saaf'].ruleP, 'no P5 note on the SAAF screen');
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'app.js'), 'utf8');
  assert.strictEqual((src.match(/tag: 'P5'/g) || []).length, 0, 'no screen or column carries the P5 tag any more');
  assert.doesNotMatch(P.byId['SMD/saaf'].rule, /pre-ticked/, 'the SAAF screen does not promise the pre-tick');
  assert.doesNotMatch(P.byId['log-activity'].rule, /with the proposed improvements on, the SAAF/);
  P.U('log-activity').applied.module = 'SMD'; assert.doesNotMatch(P.byId['log-activity'].emptyNote(), /proposed improvements/);
});
test('seed: 4 lots approved by the seller, 3 sent and awaiting the seller', () => {
  const rows = load().byId['SMD/saaf'].rows();
  assert.deepStrictEqual(rows.filter(r => r.saaf_approved).map(r => r.id).sort(), ['V092', 'V096', 'V102', 'V103']);
  assert.deepStrictEqual(rows.filter(r => r.saaf_sent && !r.saaf_approved).map(r => r.id).sort(), ['V017', 'V087', 'V097']);
});
test('sending the SAAF records SAAF Sent under SMD; the approval makes the lot ready for FAD', () => {
  const P = load(), scr = P.byId['SMD/saaf']; P.setProposed(true);
  const r = scr.rows().find(x => !x.saaf_sent), before = P.S.log.length;
  P.recordSaafSent(scr, [r]);
  assert.strictEqual(r._raw.saaf_sent, P.TODAY); assert.ok(P.S.log.slice(before).every(e => e.module === 'SMD'));
  P.U(scr.id).edits[r.id] = { saaf_approved: P.TODAY }; P.applyEdits(scr);
  assert.ok(P.selectedRows(P.byId['FAD/pending-awarding'], 'for_baaf').some(x => x.id === r.id));
});
test('approval date: not before SAAF Sent, not without a SAAF, not in the future', () => {
  const P = load(), scr = P.byId['SMD/saaf'], rows = scr.rows(), sent = rows.find(r => r.id === 'V087'), unsent = rows.find(r => !r.saaf_sent);
  assert.match(scr.validate(sent, { saaf_approved: '2026-09-01' }).saaf_approved, /SAAF Sent/);
  assert.match(scr.validate(unsent, { saaf_approved: P.TODAY }).saaf_approved, /sent first/);
  assert.match(scr.validate(sent, { saaf_approved: '2026-12-01' }).saaf_approved, /after today/);
  assert.strictEqual(scr.validate(sent, { saaf_approved: P.TODAY }).saaf_approved, null);
});
test('SAAF form: seller, lots, total, placeholder note; no buyer names', () => {
  const P = load(), lots = P.byId['SMD/saaf'].rows().filter(r => r.seller === 'SBC').slice(0, 2);
  const h = P.REPORTS.saaf('SBC', lots, P.TODAY);
  assert.match(h, /Seller Awarding Acknowledgement Form/); assert.match(h, /Layout to be confirmed/); assert.match(h, /SMD staff/);
  for (const r of lots) { assert.ok(h.includes(r.plate)); assert.ok(!r.customer || !h.includes(r.customer)); }
});
test('Pending Awarding shows Seller Approved (New) with the switch off and on, read only; the pre-tick of approved lots needs the switch', () => {
  const P = load(), scr = P.byId['FAD/pending-awarding'];
  assert.ok(P.colsOf(scr).some(c => c.key === 'saaf_approved' && c.isNew && !c.edit && !c.tag), 'switch off');
  assert.match(P.dataCard(scr, 'x'), /<span>Seller Approved<\/span><span class="ptag new"/);
  assert.ok(!P.selectedRows(scr, 'for_baaf').some(r => r.saaf_approved), 'switch off: approved lots are not pre-ticked');
  P.setProposed(true);
  assert.ok(P.colsOf(scr).some(c => c.key === 'saaf_approved' && !c.tag), 'switch on: no P5 tag on the column either');
  assert.ok(P.selectedRows(scr, 'for_baaf').some(r => r.saaf_approved), 'switch on: approved lots arrive pre-ticked');
  assert.match(P.pageHead(scr), /Proposed P5<\/span> Lots the seller approved/, 'and the page names the P5 part');
});
test('dispatch email is copied to Finance only with the switch on', () => {
  const P = load(); assert.strictEqual(P.dispatchCc(), 'sales@jbap.com.ph; vwd@jbap.com.ph; finance@jbap.com.ph');
  P.setProposed(true); assert.strictEqual(P.dispatchCc(), 'finance@jbap.com.ph');
});
test('F2: an approved lot cannot be ticked for SAAF and Email SAAF skips it', () => {
  const P = load(), scr = P.byId['SMD/saaf']; P.setProposed(true);
  const col = scr.cols.find(c => c.key === 'for_saaf'), rows = scr.rows(), approved = rows.find(r => r.id === 'V102'), sent = rows.find(r => r.id === 'V087');
  assert.ok(approved.saaf_approved && sent && !sent.saaf_approved);
  assert.strictEqual(!!col.disabledWhen?.(approved), true, 'the tick is disabled on an approved lot');
  assert.strictEqual(!!col.disabledWhen?.(sent), false, 'a sent lot awaiting the seller can still be re-sent');
  // only the approved lot is ticked: Email SAAF finds nothing to send (the harness DOM stub throws after the message is set)
  rows.forEach(r => { P.U(scr.id).edits[r.id] = { for_saaf: r.id === 'V102' }; });
  assert.deepStrictEqual(P.selectedRows(scr, 'for_saaf').map(r => r.id), ['V102'], 'the approved lot is ticked');
  try { P.ACTIONS.emailSaaf(scr); } catch (e) { /* DOM stub */ }
  const m = P.U(scr.id).msg; assert.ok(m && m.type === 'error' && /at least one lot/.test(m.html), 'nothing to send');
});

test('the SAAF screen has no pre-tick (switch off or on); its P6 count is the lots whose SAAF has not been sent yet', () => {
  const P = load(), scr = P.byId['SMD/saaf'];
  assert.ok(!scr.ready, 'no ready rule'); assert.strictEqual(typeof scr.queue, 'function', 'a count the screen gives');
  for (const on of [false, true]) { P.setProposed(on); assert.deepStrictEqual(P.selectedRows(scr, 'for_saaf'), [], 'switch ' + on + ': nothing is pre-ticked'); }
  assert.strictEqual(P.isProposed(), true);
  const unsent = () => scr.rows().filter(r => !r.saaf_sent).length, all = scr.rows().length;
  assert.ok(unsent() > 0 && unsent() < all, 'sample: some lots sent (7), most not');
  assert.deepStrictEqual(P.queueCounts(scr), { ready: unsent(), late: 0 }, 'SMD still has to send these');
  assert.strictEqual(P.queueCounts(scr).ready, all - 7, '7 lots have a SAAF sent (4 approved, 3 waiting): they are not counted');
  const r = scr.rows().find(x => !x.saaf_sent); P.recordSaafSent(scr, [r]);   // sending one lot takes it off the count
  assert.strictEqual(P.queueCounts(scr).ready, all - 8);
  assert.match(P.homeLayout(), new RegExp('Seller Awarding Acknowledgement<span class="cnt">' + (all - 8) + '</span>'), 'Waiting for you on Home shows the same number');
  const eight = P.sideHtml(''); assert.match(eight, new RegExp('aria-label="Seller Awarding Acknowledgement: ' + (all - 8) + ' waiting, 0 overdue"'));
  scr.rows().forEach(x => { P.U(scr.id).edits[x.id] = { for_saaf: x.id === 'V087' }; });   // a saved or typed tick still works
  assert.deepStrictEqual(P.selectedRows(scr, 'for_saaf').map(x => x.id), ['V087']);
});
test('the P4 text and the README P4 row name the lists still tagged P4 (Pending Awarding\'s pre-tick is tagged P5)', () => {
  const P = load(), p4 = P.SCREENS.filter(s => s.ready && s.ruleP && s.ruleP[0] === 'P4'), p4text = P.PROPOSALS.find(p => p[0] === 'P4')[1];
  assert.deepStrictEqual(p4.map(s => s.id).sort(), ['FAD/billing-monitoring', 'FAD/cancellation-billing', 'FAD/commission-billing', 'FAD/document-monitoring', 'FAD/for-dispatch', 'FAD/payment-seller']);
  assert.match(p4text, /pre-ticked on 6 lists/); assert.doesNotMatch(p4text, /7 lists/);
  assert.deepStrictEqual(P.SCREENS.filter(s => s.ready).map(s => s.id).sort(), [...p4.map(s => s.id), 'FAD/pending-awarding'].sort(), 'the other screen with a pre-tick is Pending Awarding (P5)');
  const row = require('fs').readFileSync(require('path').join(__dirname, '..', 'README.md'), 'utf8').split('\n').find(l => l.startsWith('| P4 |')), where = row.split('|')[2];
  for (const t of ['Payment Seller', 'Commission Billing', 'Billing Monitoring', 'For Dispatch', 'Document Monitoring', 'Cancellation Billing']) assert.ok(where.includes(t), t);
  assert.ok(!where.includes('Pending Awarding'), 'README P4 row: Pending Awarding is in the P5 row');
  assert.match(row, /6 lists|six lists/);
});
test('data-extra.js comments the SAAF sample as Q11, not P5', () => {
  const t = require('fs').readFileSync(require('path').join(__dirname, '..', 'data-extra.js'), 'utf8');
  assert.doesNotMatch(t, /\[MOCK\] P5: SAAF state/); assert.match(t, /\[MOCK\] Q11: SAAF state/);
});
