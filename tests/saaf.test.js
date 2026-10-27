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
test('SAAF sample data loads with the switch off: 3 auctions approved, 1 sent and waiting; Seller Approved is saved per auction row for all its lots', () => {
  const P = load(), scr = P.byId['SMD/saaf'], rows = scr.rows(), ui = P.U(scr.id);
  assert.strictEqual(P.isProposed(), false);
  const list = P.saafAuctions(scr);
  assert.deepStrictEqual(list.filter(a => a.approved).map(a => a.key).sort(), ['215|EWB', '216|EWB', '217|EWB']);
  assert.deepStrictEqual(list.filter(a => a.sent && !a.approved).map(a => a.key), ['218|SBC']);
  assert.deepStrictEqual(P.colsOf(scr).map(c => c.key + (c.edit ? '*' : '')), ['lot', 'plate', 'model', 'customer', 'price'], 'the vehicle list is view only');
  assert.deepStrictEqual((scr.buttons || []).filter(P.shown).map(b => b.act), []);
  const card = P.saafAuctionCard(scr);
  assert.match(card, /data-pair="218\|SBC"/, 'the sent auction has a Seller Approved box');
  assert.doesNotMatch(card, /data-pair="219\|SBC"/, 'an auction whose SAAF is not sent has none');
  assert.match(card, /data-act="emailSaaf" data-saaf="219\|SBC"[^>]*>[^]*?Email SAAF</, 'Email SAAF on the row');
  assert.match(card, /data-act="emailSaaf" data-saaf="218\|SBC"[^>]*>[^]*?Resend SAAF</, 'a sent, unapproved SAAF can be sent again');
  assert.doesNotMatch(card, /data-act="emailSaaf" data-saaf="215\|EWB"/, 'an approved SAAF is not sent again');
  ui.pedits = { '218|SBC': P.TODAY }; const before = P.S.log.length;
  try { P.ACTIONS.saafSave(scr); } catch (x) { /* DOM stub */ }
  const lots = rows.filter(r => P.saafKey(r) === '218|SBC');
  assert.strictEqual(lots.length, 3); assert.ok(lots.every(r => r._raw.saaf_approved === P.TODAY), 'every lot of the auction gets the date');
  assert.strictEqual(P.S.log.length - before, 3); assert.ok(P.S.log.slice(before).every(x => x.module === 'SMD' && x.field === 'Seller Approved'));
  assert.deepStrictEqual(ui.pedits, {});
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
test('seed: one SAAF state per auction and seller (3 lots approved, 3 sent and awaiting the seller)', () => {
  const rows = load().byId['SMD/saaf'].rows();
  assert.deepStrictEqual(rows.filter(r => r.saaf_approved).map(r => r.id).sort(), ['V092', 'V102', 'V103']);
  assert.deepStrictEqual(rows.filter(r => r.saaf_sent && !r.saaf_approved).map(r => r.id).sort(), ['V087', 'V096', 'V097']);
});
test('sending the SAAF records SAAF Sent under SMD; the approval makes the lot ready for FAD', () => {
  const P = load(), scr = P.byId['SMD/saaf']; P.setProposed(true);
  const r = scr.rows().find(x => !x.saaf_sent), before = P.S.log.length;
  P.recordSaafSent(scr, [r]);
  assert.strictEqual(r._raw.saaf_sent, P.TODAY); assert.ok(P.S.log.slice(before).every(e => e.module === 'SMD'));
  P.recordSaafApproved(scr, P.saafKey(r), P.TODAY);
  assert.ok(P.selectedRows(P.byId['FAD/pending-awarding'], 'for_baaf').some(x => x.id === r.id));
});
test('approval date: not before SAAF Sent, not without a SAAF, not in the future; a refused date is not saved', () => {
  const P = load(), scr = P.byId['SMD/saaf'], ui = P.U(scr.id);
  assert.match(P.saafApprovedError('2026-09-10', '2026-09-01'), /SAAF Sent/);
  assert.match(P.saafApprovedError('', P.TODAY), /sent first/);
  assert.match(P.saafApprovedError('2026-09-10', '2026-12-01'), /after today/);
  assert.strictEqual(P.saafApprovedError('2026-09-10', P.TODAY), null);
  ui.pedits = { '218|SBC': '2026-09-01' };
  try { P.ACTIONS.saafSave(scr); } catch (x) { /* DOM stub */ }
  assert.match(ui.perrs['218|SBC'], /SAAF Sent/); assert.strictEqual(ui.pmsg.type, 'error');
  assert.ok(scr.rows().filter(r => P.saafKey(r) === '218|SBC').every(r => !r.saaf_approved), 'nothing saved');
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
test('auction list: one row per auction and seller, newest first, filtered by Seller; the vehicle list shows only the pair clicked', () => {
  const P = load(), scr = P.byId['SMD/saaf'], ui = P.U(scr.id), rows = scr.rows();
  const pairs = new Set(rows.map(P.saafKey)); const list = P.saafAuctions(scr);
  assert.strictEqual(list.length, pairs.size); assert.ok(list.length > 1);
  for (let i = 1; i < list.length; i++) assert.ok(Number(list[i - 1].auction) >= Number(list[i].auction), 'newest auction first');
  assert.strictEqual(list.reduce((a, x) => a + x.lots, 0), rows.length, 'every waiting lot is in one pair');
  assert.deepStrictEqual(P.colsOf(scr).filter(c => c.key === 'seller' || c.key === 'auction'), [], 'the vehicle list does not repeat Seller and Auction No.');
  assert.strictEqual(scr.filters[0].key, 'seller', 'Seller is the first filter');
  assert.match(P.dataCard(scr, scr.detailTitle()), /Click an Auction No\./, 'nothing picked: the vehicle list asks for a click');
  assert.strictEqual(scr.detailTitle(), 'Vehicle list');
  ui.applied.seller = ['SBC']; const sbc = P.saafAuctions(scr); assert.ok(sbc.length && sbc.every(a => a.seller === 'SBC'), 'filtered by Seller');
  const pick = sbc.find(a => String(a.auction) === '219'); ui.pick = pick.key;
  assert.match(P.saafAuctionCard(scr), /class="is-sel"[^]*?aria-pressed="true"[^>]*>219</);
  assert.strictEqual(scr.detailTitle(), 'Vehicles: Auction 219, SBC');
  const shown = [...P.dataCard(scr, 'x').matchAll(/data-tr="([^"]+)"/g)].map(m => m[1]).sort();
  assert.deepStrictEqual(shown, rows.filter(r => P.saafKey(r) === pick.key).map(r => r.id).sort());
  ui.applied.seller = ['EWB']; assert.strictEqual(P.saafPick(scr), null, 'a filter that hides the pair drops the pick');
});
test('Email SAAF on an auction row sends one SAAF with every vehicle of that auction and seller, no ticking', () => {
  const P = load(), scr = P.byId['SMD/saaf'], ui = P.U(scr.id), key = '219|SBC', lots = scr.rows().filter(r => P.saafKey(r) === key);
  assert.strictEqual(lots.length, 8);
  try { P.ACTIONS.emailSaaf(scr, { dataset: { saaf: key } }); } catch (x) { /* DOM stub: openModal */ }
  assert.strictEqual(ui.pick, key, 'the vehicles of that auction show below');
  const src = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8'); assert.doesNotMatch(src, /for_saaf/, 'no For SAAF tick anywhere');
  P.recordSaafSent(scr, lots); assert.ok(lots.every(r => r._raw.saaf_sent === P.TODAY));
  assert.strictEqual(P.saafAuctions(scr).find(a => a.key === key).sent, P.TODAY);
  ui.pmsg = null; try { P.ACTIONS.emailSaaf(scr, { dataset: { saaf: '215|EWB' } }); } catch (x) { /* DOM stub */ }
  assert.match(ui.pmsg.html, /already approved/, 'an approved SAAF is not sent again');
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
  for (const on of [false, true]) { P.setProposed(on); assert.ok(!P.colsOf(scr).some(c => c.type === 'check'), 'switch ' + on + ': no tick column'); }
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
