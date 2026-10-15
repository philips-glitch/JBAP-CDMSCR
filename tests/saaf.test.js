const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness');
test('SAAF screen shows only with the switch on and lists the same lots as FAD Pending Awarding', () => {
  const P = load(), scr = P.byId['SMD/saaf'];
  assert.ok(scr && !P.shown(scr)); P.setProposed(true); assert.ok(P.shown(scr));
  assert.deepStrictEqual(scr.rows().map(r => r.id).sort(), P.byId['FAD/pending-awarding'].rows().map(r => r.id).sort());
  assert.ok(scr.actions.includes('Update') && scr.tag === 'P5');
});
test('seed: 4 lots approved by the seller, 3 sent and awaiting the seller', () => {
  const rows = load().byId['SMD/saaf'].rows();
  assert.deepStrictEqual(rows.filter(r => r.saaf_approved).map(r => r.id).sort(), ['V092', 'V096', 'V102', 'V103']);
  assert.deepStrictEqual(rows.filter(r => r.saaf_sent && !r.saaf_approved).map(r => r.id).sort(), ['V017', 'V087', 'V097']);
});
test('sending the SAAF records SAAF Sent under SMD; the approval makes the lot ready for FAD', () => {
  const P = load(), scr = P.byId['SMD/saaf']; P.setProposed(true);
  const sel = P.selectedRows(scr, 'for_saaf'); assert.ok(sel.length > 0 && sel.every(r => !r.saaf_sent), 'unsent lots are pre-ticked');
  const r = sel[0], before = P.S.log.length;
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
test('Pending Awarding shows Seller Approved only with the switch on', () => {
  const P = load(), scr = P.byId['FAD/pending-awarding'];
  assert.ok(!P.colsOf(scr).some(c => c.key === 'saaf_approved')); P.setProposed(true);
  assert.ok(P.colsOf(scr).some(c => c.key === 'saaf_approved' && c.tag === 'P5'));
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
