const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness');
test('Email DOAS for signature: JBAP-signed DOAS lots, sets Receipt of DOAS', () => {
  const P = load(), scr = P.byId['FAD/document-monitoring'];
  const col = scr.cols.find(c => c.key === 'for_doas_email'); assert.ok(col && col.isNew);
  const cand = scr.rows().filter(r => P.doasOf(r) === 'jbap' && !r.rcv_doas); assert.ok(cand.length);
  assert.ok(scr.buttons.some(b => b.act === 'emailDoas' && b.isNew));
  const v = cand[0], mail = P.REPORTS.doasForSignatureEmail(P.buyerOf(v.cid) || { customer: v.customer }, [v]);
  assert.match(mail.subject, /^JBAP DOAS FOR SIGNATURE - /); assert.match(mail.html || mail.body, /available in our main office for your signature/);
  assert.match(mail.html || mail.body, new RegExp(v.plate));
  assert.match(mail.cc, /sales@/); assert.match(mail.from, /finance@/);
  P.recordDoasEmail(scr, [v]); assert.strictEqual(v._raw.rcv_doas, P.TODAY);
  assert.strictEqual(scr.rows().find(r => r.id === v.id).doc_status, 'DOAS for Signing');
});
test('Print Transmittal also emails Documents Release and sets JBAP Receipt of Documents', () => {
  const P = load(), scr = P.byId['FAD/document-monitoring'];
  const v = scr.rows().find(r => r.doc_status === 'Pending Documents' && !r.orig_docs); assert.ok(v);
  const mail = P.REPORTS.documentsReleaseEmail({ customer: v.customer }, [v]);
  assert.match(mail.subject, /^JBAP DOCUMENTS RELEASE - /); assert.match(mail.html || mail.body, /readily available for pick up in our Main Office/);
  P.recordDocTransmittal(scr, v, ['OR/CR'], '', '');
  assert.strictEqual(v._raw.orig_docs, P.TODAY); assert.strictEqual(scr.rows().find(r => r.id === v.id).doc_status, 'For Releasing');
  assert.deepStrictEqual(P.makeModel('TOYOTA VIOS 1.3 XLE'), { make: 'TOYOTA', model: 'VIOS 1.3 XLE' });
});
// ---- more checks ----
const docmon = P => P.byId['FAD/document-monitoring'];
const txt = html => html.replace(/<[^>]+>/g, '|').replace(/\|+/g, '|');
const aLot = (P, f) => docmon(P).rows().find(f);
test('For DOAS Email? tick: only DOAS signed at JBAP with Receipt of DOAS blank; the button sits before Print document transmittal', () => {
  const P = load(), scr = docmon(P), col = scr.cols.find(c => c.key === 'for_doas_email');
  assert.strictEqual(col.label, 'For DOAS Email?'); assert.strictEqual(col.edit, 'check'); assert.strictEqual(col.type, 'check');
  const rows = scr.rows(), ok = rows.filter(r => P.doasOf(r) === 'jbap' && !r.rcv_doas);
  assert.ok(ok.length && ok.every(r => !col.disabledWhen(r) && P.doasEmailOk(r)));
  const no = rows.filter(r => !(P.doasOf(r) === 'jbap' && !r.rcv_doas));
  assert.ok(no.some(r => P.doasOf(r) === 'branch') && no.some(r => P.doasOf(r) === 'none') && no.some(r => P.doasOf(r) === 'jbap' && r.rcv_doas), 'sample has EWB, TFS and filled lots');
  assert.ok(no.every(r => col.disabledWhen(r) && !P.doasEmailOk(r)));
  assert.deepStrictEqual(scr.buttons.map(b => b.act), ['emailDoas', 'printDocTrans', 'save']);
  const b = scr.buttons[0]; assert.deepStrictEqual([b.label, b.kind, b.icon, b.count, b.isNew], ['Email DOAS for signature', 'ol', 'mail', 'for_doas_email', true]);
  assert.strictEqual(typeof P.ACTIONS.emailDoas, 'function');
  const dis = no.find(r => P.doasOf(r) === 'branch');
  assert.doesNotMatch(P.cellHtml(scr, ok[0], col, true), /disabled/); assert.match(P.cellHtml(scr, dis, col, true), /type="checkbox"[^>]* disabled/);
});
test('DOAS for signature email: From Finance, To the buyer, CC Sales, JBAP wording, unit table without Color, no attachment', () => {
  const P = load(), v = aLot(P, r => P.doasOf(r) === 'jbap' && !r.rcv_doas && r.year && r.model), w = aLot(P, r => P.doasOf(r) === 'jbap' && !r.rcv_doas);
  const buyer = { customer: 'Test Buyer <b>', cid: 'B1', email: 'buyer@example.com' };
  const mail = P.REPORTS.doasForSignatureEmail(buyer, [v, w]);
  assert.strictEqual(mail.from, 'finance@jbap.com.ph'); assert.strictEqual(mail.cc, 'sales@jbap.com.ph'); assert.strictEqual(mail.to, 'Test Buyer <b> <buyer@example.com>');
  assert.strictEqual(mail.subject, 'JBAP DOAS FOR SIGNATURE - TEST BUYER <B>'); assert.deepStrictEqual(mail.atts, []);
  const t = txt(mail.body);
  for (const s of ['Dear Client,', 'Please be informed that the DOAS for the following units are available in our main office for your signature. You may sign from Monday to Friday, 9am to 5pm. Unit details are as follows:',
    "*Please note that original documents will be processed upon the seller's receipt of the signed DOAS.", 'Thank you.', 'JBAP Finance and Admin']) assert.ok(t.includes(s), s);
  assert.match(mail.body, /<th>Seller<\/th><th>Buyer<\/th><th>Year<\/th><th>Make<\/th><th>Model<\/th><th>Plate Number<\/th><\/tr>/); assert.doesNotMatch(mail.body, /Color/);
  const mm = P.makeModel(v.model);
  assert.ok(mail.body.includes(`<td>${v.seller_full}</td>`) && mail.body.includes(`<td>${v.year}</td><td>${mm.make}</td><td>${mm.model}</td><td>${v.plate}</td></tr>`), 'one row per lot with Year, Make, Model, Plate');
  assert.strictEqual((mail.body.match(/<tbody>[^]*<\/tbody>/)[0].match(/<tr>/g) || []).length, 2);
  const html = P.REPORTS.email(mail); assert.match(html, /class="mail"/); assert.doesNotMatch(html, /Attached/); assert.match(html, /<b>CC<\/b><span>sales@jbap\.com\.ph/);
  assert.match(html, /Test Buyer &lt;b&gt;/); assert.doesNotMatch(html, /Test Buyer <b>/, 'the buyer name is escaped');
  assert.strictEqual(P.REPORTS.doasForSignatureEmail({ customer: 'Nobody' }, [v]).to, 'Nobody', 'no email on file: the name only');
});
test('Documents release email: JBAP wording, unit table with Color, Year and Color blank when unknown', () => {
  const P = load(), v = aLot(P, r => r.doc_status === 'Pending Documents' && !r.year);
  const mail = P.REPORTS.documentsReleaseEmail({ customer: 'Test Buyer', email: 'buyer@example.com' }, [v]), mm = P.makeModel(v.model);
  assert.strictEqual(mail.from, 'finance@jbap.com.ph'); assert.strictEqual(mail.cc, 'sales@jbap.com.ph'); assert.strictEqual(mail.to, 'Test Buyer <buyer@example.com>'); assert.strictEqual(mail.subject, 'JBAP DOCUMENTS RELEASE - TEST BUYER');
  const t = txt(mail.body);
  for (const s of ['Dear Client,', 'This is to inform you that the original documents for the following units are readily available for pick up in our Main Office. You may pick up the documents from Monday through Friday, 9 a.m. to 5 p.m.',
    '*If through a representative, please provide a hard copy of the signed Authorization Letter together with a copy of your valid ID and your representative. Kindly note that the documents will not be released without the submission of the original authorization letter.',
    'Thank you.', 'JBAP Finance and Admin']) assert.ok(t.includes(s), s);
  assert.match(mail.body, /<th>Plate Number<\/th><th>Color<\/th><\/tr>/);
  assert.ok(mail.body.includes(`<td></td><td>${mm.make}</td><td>${mm.model}</td><td>${v.plate}</td><td></td></tr>`), 'blank Year and Color');
});
test('makeModel: Make = first word, Model = the rest', () => {
  const P = load();
  assert.deepStrictEqual(P.makeModel('TOYOTA VIOS 1.3 XLE'), { make: 'TOYOTA', model: 'VIOS 1.3 XLE' });
  assert.deepStrictEqual(P.makeModel('  Toyota   Wigo 1.0 G '), { make: 'Toyota', model: 'Wigo 1.0 G' });
  assert.deepStrictEqual(P.makeModel('Isuzu'), { make: 'Isuzu', model: '' });
  assert.deepStrictEqual(P.makeModel(''), { make: '', model: '' }); assert.deepStrictEqual(P.makeModel(null), { make: '', model: '' });
});
test('byBuyer: one group per Buyer ID, the name when a lot has no Buyer ID', () => {
  const P = load(), g = P.byBuyer([{ id: 'a', cid: 'B1', customer: 'X', email: 'x@e' }, { id: 'b', customer: 'Y' }, { id: 'c', cid: 'B1', customer: 'X', email: 'x@e' }, { id: 'd', customer: 'Y' }, { id: 'e' }]);
  assert.deepStrictEqual(g.map(x => [x.buyer.customer, x.buyer.cid, x.buyer.email, x.lots.map(l => l.id)]), [['X', 'B1', 'x@e', ['a', 'c']], ['Y', undefined, undefined, ['b', 'd']], [undefined, undefined, undefined, ['e']]]);
});
test('Send DOAS email: Receipt of DOAS = today, logged, tick cleared, a stale typed date is dropped, other edits stay, a locked date is never overwritten', () => {
  const P = load(), scr = docmon(P), ed = P.U(scr.id).edits, [v, w] = scr.rows().filter(r => P.doasOf(r) === 'jbap' && !r.rcv_doas), done = aLot(P, r => r.rcv_doas && P.doasOf(r) === 'jbap');
  ed[v.id] = { for_doas_email: true, rcv_doas: '2026-10-01', doc_remarks: 'call buyer' }; ed[w.id] = { for_doas_email: true };
  const keep = done._raw.rcv_doas, n0 = P.S.log.length;
  P.recordDoasEmail(scr, [v, w, done]);
  assert.strictEqual(v._raw.rcv_doas, P.TODAY); assert.strictEqual(w._raw.rcv_doas, P.TODAY); assert.strictEqual(done._raw.rcv_doas, keep, 'a filled date is locked');
  assert.deepStrictEqual(ed[v.id], { doc_remarks: 'call buyer' }); assert.ok(!(w.id in ed));
  assert.strictEqual(P.applyEdits(scr), 1); assert.strictEqual(v._raw.rcv_doas, P.TODAY, 'the next Save does not bring the typed date back');
  const added = P.S.log.slice(n0).filter(l => l.field === 'Receipt of DOAS');
  assert.strictEqual(added.length, 2); assert.ok(added.every(l => l.action === 'Update' && l.new === P.fmtDate(P.TODAY) && l.old === '' && l.screen === 'Document Monitoring' && l.module === 'FAD'));
  assert.deepStrictEqual(added.map(l => l.record), [v, w].map(r => `Auction ${r.auction}, Lot ${r.lot || '-'}${r.plate ? ` · ${r.plate}` : ''}`));
  const after = scr.rows(); assert.ok([v, w].every(r => after.find(x => x.id === r.id).doc_status === 'DOAS for Signing' && !after.find(x => x.id === r.id).for_doas_email));
});
test('Send DOAS email: a saved tick is logged as Yes to No', () => {
  const P = load(), scr = docmon(P), v = aLot(P, r => P.doasOf(r) === 'jbap' && !r.rcv_doas); v._raw.for_doas_email = true;
  const n0 = P.S.log.length; P.recordDoasEmail(scr, [v]);
  const tick = P.S.log.slice(n0).find(l => l.field === 'For DOAS Email?'); assert.deepStrictEqual([tick.old, tick.new], ['Yes', 'No']); assert.strictEqual(v._raw.for_doas_email, false);
});
test('Print Transmittal: records JBAP Receipt of Documents once (logged), drops a stale typed date, keeps other date edits; a reprint changes nothing more', () => {
  const P = load(), scr = docmon(P), ed = P.U(scr.id).edits, [v, w] = scr.rows().filter(r => r.doc_status === 'Pending Documents' && !r.orig_docs && !r.atf_no);
  ed[v.id] = { print_doc_trans: true, orig_docs: '2026-10-01', to_buyer: '2026-10-02' };
  const n0 = P.S.log.length; P.recordDocTransmittal(scr, v, ['Spare Key'], '', '');
  assert.strictEqual(v._raw.orig_docs, P.TODAY); assert.deepStrictEqual(ed[v.id], { to_buyer: '2026-10-02' }, 'only the typed JBAP Receipt of Documents goes; the tick goes; to_buyer stays');
  const rec = P.S.log.slice(n0).filter(l => l.field === 'JBAP Receipt of Documents'); assert.strictEqual(rec.length, 1);
  assert.deepStrictEqual([rec[0].action, rec[0].old, rec[0].new, rec[0].screen], ['Update', '', P.fmtDate(P.TODAY), 'Document Monitoring']);
  assert.ok(P.S.log.slice(n0).some(l => l.field === 'ATF Control No.'), 'the existing fields are still logged');
  const n1 = P.S.log.length; P.recordDocTransmittal(scr, v, ['Spare Key'], '', '');
  assert.ok(!P.S.log.slice(n1).some(l => l.field === 'JBAP Receipt of Documents'), 'not logged again'); assert.strictEqual(v._raw.orig_docs, P.TODAY);
  assert.strictEqual(scr.rows().find(r => r.id === v.id).doc_status, 'For Releasing');
  w._raw.orig_docs = '2026-10-05'; P.recordDocTransmittal(scr, w, [], ''); assert.strictEqual(w._raw.orig_docs, '2026-10-05', 'a recorded date is never replaced');
});
test('Print Transmittal? tick: Pending Documents or For Releasing with no ATF No.; it is also the P4 ready rule', () => {
  const P = load(), scr = docmon(P), col = scr.cols.find(c => c.key === 'print_doc_trans'), rows = scr.rows();
  const ok = rows.filter(r => ['Pending Documents', 'For Releasing'].includes(r.doc_status) && !r.atf_no);
  assert.ok(ok.some(r => r.doc_status === 'Pending Documents') && ok.some(r => r.doc_status === 'For Releasing'));
  assert.ok(ok.every(r => P.printTransOk(r) && !col.disabledWhen(r) && scr.ready.when(r)));
  const no = rows.filter(r => !ok.includes(r)); assert.ok(no.some(r => r.doc_status === 'Pending DOAS') && no.some(r => r.doc_status === 'Complete'));
  assert.ok(no.every(r => !P.printTransOk(r) && col.disabledWhen(r) && !scr.ready.when(r)));
  const atf = rows.find(r => r.doc_status === 'Pending Documents'); atf._raw.atf_no = 'HRAD-ATF-1'; assert.ok(!P.printTransOk(P.enrichV(atf._raw)), 'an ATF No. ends it');
  assert.strictEqual(scr.ready.key, 'print_doc_trans'); assert.strictEqual(typeof P.ACTIONS.printDocTrans, 'function');
  assert.strictEqual(scr.buttons.find(b => b.act === 'printDocTrans').count, 'print_doc_trans');
});
