const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness'), fs = require('fs'), path = require('path');
// JBAP answer Q11 (20 Oct 2026): "Let's include this to minimize human intervention." The SAAF is standard; its pre-tick and the Finance-only dispatch copy stay proposed (P5).
test('SAAF screen is standard (shown with the switch off, no P5 tag) and lists the same lots as FAD Pending Awarding', () => {
  const P = load(), scr = P.byId['SMD/saaf'];
  assert.ok(scr && P.shown(scr), 'shown with the switch off'); assert.ok(!scr.proposed && !scr.tag && !scr.isNew);
  P.setProposed(true); assert.ok(P.shown(scr)); P.setProposed(false);
  assert.deepStrictEqual(scr.rows().map(r => r.id).sort(), P.byId['FAD/pending-awarding'].rows().map(r => r.id).sort());
  assert.ok(scr.actions.includes('Update'));
  for (const on of [false, true]) {   // no P5 tag on the screen, its menu entry or its page head
    P.setProposed(on);
    assert.doesNotMatch(P.pageHead(scr), /P5/, `page head, switch ${on}`);
    const entry = P.sideHtml('').match(/<a class="mis[^>]*>Seller Awarding Acknowledgement(?:<span[^>]*>[^<]*<\/span>)*/)[0];
    assert.doesNotMatch(entry, /P5/, `menu entry, switch ${on}`); assert.doesNotMatch(entry, /ptag mini new/, "no New mark since 26 Oct 2026");
  }
  P.setProposed(false);
  assert.match(P.sideHtml(''), /href="#\/SMD\/saaf"[^>]*>Seller Awarding Acknowledgement<span class="cnt">\d+<\/span>/, 'no New mark since 26 Oct 2026');
  assert.match(P.homeLayout(), /href="#\/SMD\/saaf">Seller Awarding Acknowledgement<span class="cnt">/);
});
test('SAAF list page: one row per auction and seller with counts (KYC Approved, Seller Approved) and View detail; no SAAF Sent column; no vehicle table on the list', () => {
  const P = load(), scr = P.byId['SMD/saaf'];
  assert.strictEqual(P.isProposed(), false);
  const list = P.saafAuctions(scr), at = k => list.find(a => a.key === k);
  assert.deepStrictEqual([at('215|EWB').kyc, at('215|EWB').sent, at('215|EWB').approved], [1, 1, 1]);
  assert.deepStrictEqual([at('218|SBC').kyc, at('218|SBC').sent, at('218|SBC').approved], [3, 3, 0]);
  assert.deepStrictEqual([at('219|SBC').lots, at('219|SBC').kyc, at('219|SBC').sent, at('219|SBC').approved], [8, 3, 0, 0]);
  const card = P.saafAuctionCard(scr);
  assert.deepStrictEqual([...card.matchAll(/<th scope="col">([^<]+)<\/th>/g)].map(m => m[1]), ['Auction No.', 'Auction Date', 'Seller', 'Lots', 'KYC Approved', 'Seller Approved', 'Detail'], 'no SAAF Sent column (29 Oct 2026)');
  assert.deepStrictEqual([at('221|EWB').lots, at('221|EWB').kyc], [20, 15], 'dummy data: Auction 221 of EWB has 20 lots, 15 KYC Approved');
  assert.match(card, /<a class="btn ol" href="#\/SMD\/saaf\/219\/SBC" aria-label="View detail: Auction 219, SBC">View detail<\/a>/);
  assert.doesNotMatch(card, /data-pair|data-act="emailSaaf"/, 'nothing to edit or send on the list');
  assert.deepStrictEqual(P.colsOf(scr).map(c => c.key + (c.edit ? '*' : '')), ['lot', 'plate', 'model', 'customer', 'price', 'kyc_status', 'kyc_approved', 'for_saaf*', 'saaf_approved*'], 'the detail page columns (no SAAF Sent)');
  assert.deepStrictEqual((scr.buttons || []).filter(P.shown).map(b => b.act), ['emailSaaf', 'save']);
});
test('SAAF detail page: #/SMD/saaf/<auction>/<seller> lists only that auction and seller, ignores the list filters, links back; an unknown pair opens the list', () => {
  const P = load(), scr = P.byId['SMD/saaf'], ui = P.U(scr.id);
  assert.strictEqual(P.saafRoute('SMD/saaf/219/SBC'), '219|SBC'); assert.strictEqual(P.routeOf('SMD/saaf/219/SBC'), 'SMD/saaf/219/SBC');
  assert.strictEqual(P.saafRoute('SMD/saaf/999/SBC'), null); assert.strictEqual(P.routeOf('SMD/saaf/999/SBC'), 'SMD/saaf', 'a pair with no lot waiting opens the list');
  ui.pick = '219|SBC'; ui.applied.seller = ['EWB'];
  const shown = [...P.dataCard(scr, 'x').matchAll(/data-tr="([^"]+)"/g)].map(m => m[1]).sort();
  assert.deepStrictEqual(shown, scr.rows().filter(r => P.saafKey(r) === '219|SBC').map(r => r.id).sort(), 'the 8 lots of Auction 219, SBC, whatever the list filter');
  const head = P.saafDetailHead(scr, '219|SBC');
  assert.match(head, /<a href="#\/SMD\/saaf">Seller Awarding Acknowledgement<\/a>›<b>Auction 219, SBC<\/b>/); assert.match(head, /Back to auction list/); assert.match(head, /3 with KYC Approved/);
  assert.match(head, /only a vehicle whose KYC Status is Approved|Only a vehicle whose KYC Status is Approved/);
});
test('P5 now covers only the pre-tick of approved lots and the Finance-only dispatch copy; everything else of the SAAF is standard', () => {
  const P = load(), p5 = P.PROPOSALS.find(p => p[0] === 'P5');
  assert.match(p5[1], /pre-ticked/); assert.match(p5[1], /Finance/);
  assert.doesNotMatch(p5[1], /SMD sends the SAAF|records the seller approval/, 'the SAAF screen itself is no longer a proposal');
  assert.strictEqual(p5[2], 'FAD/pending-awarding');
  const pa = P.byId['FAD/pending-awarding'], sa = pa.cols.find(c => c.key === 'saaf_approved');
  assert.ok(!sa.proposed && !sa.tag && !sa.isNew, 'Seller Approved on Pending Awarding is part of the standard SAAF flow (no New mark since 26 Oct 2026)');
  assert.strictEqual(pa.ruleP[0], 'P5'); assert.match(pa.ruleP[1], /pre-ticked/);
  assert.match(P.byId['FAD/for-dispatch'].ruleP[1], /copied to Finance only \(P5\)/);
  assert.ok(!P.byId['SMD/saaf'].ruleP, 'no P5 note on the SAAF screen');
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'app.js'), 'utf8');
  assert.strictEqual((src.match(/tag: 'P5'/g) || []).length, 0, 'no screen or column carries the P5 tag any more');
  assert.doesNotMatch(P.byId['SMD/saaf'].rule, /pre-ticked/, 'the SAAF screen does not promise the pre-tick');
  assert.doesNotMatch(P.byId['log-activity'].rule, /with the proposed improvements on, the SAAF/);
  P.U('log-activity').applied.module = 'SMD'; assert.doesNotMatch(P.byId['log-activity'].emptyNote(), /proposed improvements/);
});
test('seed: 3 lots approved by the seller, 3 sent and awaiting the seller; KYC approved on those, on 4 lots ready to send and on 15 dummy lots of Auction 221 EWB', () => {
  const rows = load().byId['SMD/saaf'].rows();
  assert.deepStrictEqual(rows.filter(r => r.saaf_approved).map(r => r.id).sort(), ['V092', 'V102', 'V103']);
  assert.deepStrictEqual(rows.filter(r => r.saaf_sent && !r.saaf_approved).map(r => r.id).sort(), ['V087', 'V096', 'V097']);
  assert.deepStrictEqual(rows.filter(r => r.kyc_status === 'Approved' && !/^V2[12]\d$/.test(r.id)).map(r => r.id).sort(), ['V017', 'V076', 'V087', 'V092', 'V093', 'V096', 'V097', 'V098', 'V102', 'V103']);
  const ewb = rows.filter(r => String(r.auction) === '221' && r.seller === 'EWB');
  assert.strictEqual(ewb.length, 20); assert.strictEqual(ewb.filter(r => r.kyc_status === 'Approved').length, 15); assert.strictEqual(ewb.filter(r => r.kyc_status === 'Pending').length, 5);
  assert.ok(ewb.filter(r => /^V2[12]\d$/.test(r.id)).every(r => /^SAMPLE BUYER [A-F]$/.test(r.customer) && /^D900[1-6]$/.test(r.cid) && /^XEW10\d\d$/.test(r.plate)), 'the 18 added lots use dummy buyers and plates');
  assert.ok(rows.every(r => r.kyc_status === 'Approved' || r.kyc_status === 'Pending'), 'every sold lot has a KYC Status, Pending by default');
});
test('sending the SAAF records SAAF Sent under SMD; the approval makes the lot ready for FAD', () => {
  const P = load(), scr = P.byId['SMD/saaf']; P.setProposed(true);
  const r = scr.rows().find(x => !x.saaf_sent), before = P.S.log.length;
  P.recordSaafSent(scr, [r]);
  assert.strictEqual(r._raw.saaf_sent, P.TODAY); assert.ok(P.S.log.slice(before).every(e => e.module === 'SMD'));
  P.U(scr.id).edits[r.id] = { saaf_approved: P.TODAY }; assert.deepStrictEqual(P.validateEdits(scr), []); P.applyEdits(scr);   // Seller Approved per vehicle
  assert.ok(P.selectedRows(P.byId['FAD/pending-awarding'], 'for_baaf').some(x => x.id === r.id));
});
test('Seller Approved per vehicle: not before SAAF Sent, not without a SAAF (locked), not in the future', () => {
  const P = load(), scr = P.byId['SMD/saaf'], rows = scr.rows(), sent = rows.find(r => r.id === 'V087'), unsent = rows.find(r => !r.saaf_sent);
  assert.match(scr.validate(sent, { saaf_approved: '2026-09-01' }).saaf_approved, /SAAF Sent/);
  assert.match(scr.validate(unsent, { saaf_approved: P.TODAY }).saaf_approved, /sent first/);
  assert.match(scr.validate(sent, { saaf_approved: '2026-12-01' }).saaf_approved, /after today/);
  assert.strictEqual(scr.validate(sent, { saaf_approved: P.TODAY }).saaf_approved, null);
  const col = scr.cols.find(c => c.key === 'saaf_approved'); assert.ok(col.lockWhen(unsent) && !col.lockWhen(sent), 'the date box shows once the SAAF is sent');
  P.U(scr.id).edits[sent.id] = { saaf_approved: P.TODAY }; assert.strictEqual(P.applyEdits(scr), 1); assert.strictEqual(sent._raw.saaf_approved, P.TODAY);
  assert.ok(P.byId['FAD/pending-awarding'].rows().find(r => r.id === 'V087').saaf_approved === P.TODAY, 'FAD Pending Awarding shows the same date');
});
test('SAAF form follows JBAP\'s paper form: title, seller and auction number, the 14 columns, release text, three role signatures', () => {
  const P = load(), lots = P.byId['SMD/saaf'].rows().filter(r => r.seller === 'SBC' && String(r.auction) === '219');
  assert.ok(lots.length > 1, 'sample: several SBC lots in Auction 219');
  const h = P.REPORTS.saaf('SBC', lots, P.TODAY);
  assert.match(h, /SELLER ACKNOWLEDGEMENT AWARDING FORM/); assert.match(h, /assets\/logo\.png/);
  assert.match(h, /<th scope="row">SELLER<\/th><td>[^<]+<\/td>/); assert.match(h, /<th scope="row">AUCTION NUMBER<\/th><td>219<\/td>/);
  const heads = [...h.matchAll(/<th scope="col">([^<]+)<\/th>/g)].map(m => m[1]);
  assert.deepStrictEqual(heads, ['LOT NUMBER', 'YEAR', 'BRAND', 'MODEL', 'TRANSMISSION', 'COLOR', 'MILEAGE', 'CS NUMBER', 'PLATE NUMBER', 'MINIMUM BID PRICE', 'WINNING BID PRICE', 'BUYER NAME', 'JBAP CUSTOMER ID', 'AUCTION DATE']);
  for (const r of lots) { assert.ok(h.includes(r.plate)); if (r.cid) assert.ok(h.includes(r.cid)); }
  assert.match(h, /WE HEREBY RELEASE JBA PHILIPPINES INC\. \("JBAP"\)/); assert.match(h, /MINIMUM KYC REQUIREMENTS/);
  for (const s of ['Printed name and signature / Seller Representative', 'Sales and Marketing Head', 'Finance and Admin Head']) assert.ok(h.includes(s), s);
  assert.doesNotMatch(h, /Layout to be confirmed/);
  const brand = lots[0].model.split(' ')[0]; assert.ok(h.includes(`<td>${brand}</td>`), 'Brand = first word of Make/Model');
  const rowsN = (P.REPORTS.saaf('SBC', lots.slice(0, 1), P.TODAY).match(/<tr>/g) || []).length; assert.ok(rowsN >= 1 + 2 + 8, 'blank lines pad the table to 8 rows');
});
test('auction list: one row per auction and seller, newest first, filtered by Seller', () => {
  const P = load(), scr = P.byId['SMD/saaf'], ui = P.U(scr.id), rows = scr.rows();
  const pairs = new Set(rows.map(P.saafKey)); const list = P.saafAuctions(scr);
  assert.strictEqual(list.length, pairs.size); assert.ok(list.length > 1);
  for (let i = 1; i < list.length; i++) assert.ok(Number(list[i - 1].auction) >= Number(list[i].auction), 'newest auction first');
  assert.strictEqual(list.reduce((a, x) => a + x.lots, 0), rows.length, 'every waiting lot is in one pair');
  assert.strictEqual(scr.filters[0].key, 'seller', 'Seller is the first filter');
  ui.applied.seller = ['SBC']; const sbc = P.saafAuctions(scr); assert.ok(sbc.length && sbc.every(a => a.seller === 'SBC'), 'filtered by Seller');
});
test('Email SAAF on the detail page: one SAAF with the vehicles ticked; only KYC Approved vehicles the seller has not approved can be ticked; resend allowed', () => {
  const P = load(), scr = P.byId['SMD/saaf'], ui = P.U(scr.id), key = '219|SBC', lots = scr.rows().filter(r => P.saafKey(r) === key);
  const col = scr.cols.find(c => c.key === 'for_saaf'), byId = id => scr.rows().find(r => r.id === id);
  assert.ok(!col.disabledWhen(byId('V017')), 'KYC Approved: can be ticked'); assert.ok(col.disabledWhen(lots.find(r => r.kyc_status === 'Pending')), 'KYC Pending: cannot');
  assert.ok(col.disabledWhen(byId('V102')), 'approved by the seller: cannot'); assert.ok(!col.disabledWhen(byId('V087')), 'sent, not approved yet: can be sent again');
  ui.pick = key; lots.forEach(r => { ui.edits[r.id] = { for_saaf: true }; });   // a stale tick on a Pending lot does not count
  assert.deepStrictEqual(P.selectedRows(scr, 'for_saaf').map(r => r.id).sort(), ['V017', 'V093', 'V098']);
  try { P.ACTIONS.emailSaaf(scr); } catch (x) { /* DOM stub: openModal */ }
  const sent = lots.filter(r => ['V017', 'V093'].includes(r.id)); P.recordSaafSent(scr, sent);
  assert.ok(sent.every(r => r._raw.saaf_sent === P.TODAY && !r._raw.for_saaf)); assert.strictEqual(P.saafAuctions(scr).find(a => a.key === key).sent, 2);
  const P2 = load(), s2 = P2.byId['SMD/saaf']; P2.U(s2.id).pick = key;
  try { P2.ACTIONS.emailSaaf(s2); } catch (x) { /* DOM stub */ }
  assert.match(P2.U(s2.id).msg.html, /KYC Status is Approved/, 'nothing ticked: the message names the rule');
});
test('KYC Status changes only in Auction › Result Price: the switch records or clears KYC Approved and logs under Auction; SMD only reads it', () => {
  const P = load(), rp = P.byId['auction/result-price'], v = rp.rows().find(r => r.id === 'V086'), col = rp.cols.find(c => c.key === 'kyc_status');
  assert.strictEqual(v.kyc_status, 'Pending'); assert.strictEqual(col.type, 'toggle');
  assert.match(P.cellHtml(rp, v, col, true), /<button type="button" class="tg" role="switch" aria-checked="false" data-act="kycToggle" data-rid="V086"[^>]*>[^]*Pending<\/button>/);
  assert.strictEqual(P.cellHtml(rp, rp.rows().find(r => r.status === 'Not Sold'), col, true), '<td class="c"></td>', 'no KYC on an unsold lot');
  const before = P.S.log.length;
  try { P.ACTIONS.kycToggle(rp, { dataset: { rid: 'V086' } }); } catch (x) { /* DOM stub */ }
  const raw = P.S.veh.find(x => x.id === 'V086'); assert.strictEqual(raw.kyc_status, 'Approved'); assert.strictEqual(raw.kyc_approved, P.TODAY);
  assert.deepStrictEqual(P.S.log.slice(before).map(l => [l.module, l.screen, l.field, l.old, l.new]), [['Auction', 'Result Price', 'KYC Status', 'Pending', 'Approved'], ['Auction', 'Result Price', 'KYC Approved', '', P.fmtDate(P.TODAY)]]);
  const s = P.byId['SMD/saaf'], sv = s.rows().find(r => r.id === 'V086');
  assert.strictEqual(sv.kyc_status, 'Approved'); assert.ok(!s.cols.find(c => c.key === 'for_saaf').disabledWhen(sv), 'SMD can now tick it');
  assert.ok(!s.cols.find(c => c.key === 'kyc_status').edit, 'no KYC change on the SAAF page');
  try { P.ACTIONS.kycToggle(rp, { dataset: { rid: 'V086' } }); } catch (x) { /* DOM stub */ }
  assert.strictEqual(raw.kyc_status, null); assert.strictEqual(raw.kyc_approved, null); assert.strictEqual(rp.rows().find(r => r.id === 'V086').kyc_status, 'Pending', 'back to Pending, date cleared');
});
test('Pending Awarding shows Seller Approved with the switch off and on, read only; the pre-tick of approved lots needs the switch', () => {
  const P = load(), scr = P.byId['FAD/pending-awarding'];
  assert.ok(P.colsOf(scr).some(c => c.key === 'saaf_approved' && !c.isNew && !c.edit && !c.tag), 'switch off');
  assert.doesNotMatch(P.dataCard(scr, 'x'), /<span>Seller Approved<\/span><span class="ptag new"/);
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
test('the SAAF screen has no pre-tick (switch off or on); its P6 count is the lots whose SAAF has not been sent yet', () => {
  const P = load(), scr = P.byId['SMD/saaf'];
  assert.ok(!scr.ready, 'no ready rule'); assert.strictEqual(typeof scr.queue, 'function', 'a count the screen gives');
  for (const on of [false, true]) { P.setProposed(on); assert.deepStrictEqual(P.selectedRows(scr, 'for_saaf'), [], 'switch ' + on + ': nothing is pre-ticked'); }
  assert.strictEqual(P.isProposed(), true);
  const unsent = () => scr.rows().filter(r => !r.saaf_sent).length, all = scr.rows().length;
  assert.ok(unsent() > 0 && unsent() < all, 'sample: some lots sent (6), most not');
  assert.deepStrictEqual(P.queueCounts(scr), { ready: unsent(), late: 0 }, 'SMD still has to send these');
  assert.strictEqual(P.queueCounts(scr).ready, all - 6, '6 lots have a SAAF sent (3 approved, 3 waiting): they are not counted');
  const au = scr.rows().filter(x => P.saafKey(x) === '221|TFS'); P.recordSaafSent(scr, au);   // sending one auction's SAAF takes its lots off the count
  assert.strictEqual(P.queueCounts(scr).ready, all - 6 - au.length);
  assert.match(P.homeLayout(), new RegExp('Seller Awarding Acknowledgement<span class="cnt">' + (all - 6 - au.length) + '</span>'), 'Waiting for you on Home shows the same number');
  assert.match(P.sideHtml(''), new RegExp('aria-label="Seller Awarding Acknowledgement: ' + (all - 6 - au.length) + ' waiting, 0 overdue"'));
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
