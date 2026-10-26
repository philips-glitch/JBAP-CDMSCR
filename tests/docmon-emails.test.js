const test = require('node:test'), assert = require('node:assert'), fs = require('fs');
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
  assert.match(mail.body, /<th scope="col">Seller<\/th><th scope="col">Buyer<\/th><th scope="col">Year<\/th><th scope="col">Make<\/th><th scope="col">Model<\/th><th scope="col">Plate Number<\/th><\/tr>/); assert.doesNotMatch(mail.body, /Color/);
  assert.match(mail.body, /<div class="utbl" tabindex="0" role="region" aria-label="Units"><table>/, 'the scrolling table wrapper is a focusable region');
  assert.doesNotMatch(mail.body, /<th>/, 'every header cell has a scope');
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
  assert.match(mail.body, /<th scope="col">Plate Number<\/th><th scope="col">Color<\/th><\/tr>/); assert.match(mail.body, /<div class="utbl" tabindex="0" role="region" aria-label="Units">/); assert.doesNotMatch(mail.body, /<th>/);
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
test('Print Transmittal? tick: first print (Pending Documents or For Releasing, no ATF No.) or a reprint (any lot with an ATF No.)', () => {
  const P = load(), scr = docmon(P), col = scr.cols.find(c => c.key === 'print_doc_trans'), rows = scr.rows();
  const first = rows.filter(r => ['Pending Documents', 'For Releasing'].includes(r.doc_status) && !r.atf_no);
  assert.ok(first.some(r => r.doc_status === 'Pending Documents') && first.some(r => r.doc_status === 'For Releasing'));
  assert.ok(first.every(r => P.printTransOk(r) && P.printFirst(r) && !col.disabledWhen(r)));
  const no = rows.filter(r => !first.includes(r)); assert.ok(no.some(r => r.doc_status === 'Pending DOAS') && no.some(r => r.doc_status === 'DOAS for Signing') && no.some(r => r.doc_status === 'Complete'));
  assert.ok(no.every(r => !P.printTransOk(r) && col.disabledWhen(r) && !scr.ready.when(r)));   // no ATF and not at the document steps: not tickable, not ready
  // a lot with an ATF No. stays tickable in every status (reprint), but is a reprint, not a first print, and is never pre-ticked
  for (const st of ['Pending DOAS', 'Pending Documents', 'For Releasing', 'Complete']) {
    const r = rows.find(x => x.doc_status === st); r._raw.atf_no = 'HRAD-ATF-1'; const v = P.enrichV(r._raw);
    assert.ok(P.printTransOk(v) && !P.printFirst(v) && !col.disabledWhen(v) && !scr.ready.when(v), st);
  }
  assert.strictEqual(scr.ready.key, 'print_doc_trans'); assert.strictEqual(typeof P.ACTIONS.printDocTrans, 'function');
  assert.strictEqual(scr.buttons.find(b => b.act === 'printDocTrans').count, 'print_doc_trans');
});
test('Reprint (the lot has an ATF No.): same ATF No., no JBAP Receipt of Documents change, no receipt logged, documents still saved', () => {
  const P = load(), scr = docmon(P), v = scr.rows().find(r => r.doc_status === 'Pending Documents' && !r.orig_docs); v._raw.atf_no = 'HRAD-ATF-0042';
  const n0 = P.S.log.length, next = P.D.meta.company.next.atf;
  const atf = P.recordDocTransmittal(scr, v, ['Spare Key'], '', 'reprint');
  assert.strictEqual(atf, 'HRAD-ATF-0042'); assert.strictEqual(P.D.meta.company.next.atf, next, 'no new number is used');
  assert.ok(!v._raw.orig_docs, 'JBAP Receipt of Documents is untouched'); assert.strictEqual(scr.rows().find(r => r.id === v.id).doc_status, 'Pending Documents');
  const added = P.S.log.slice(n0).map(l => l.field); assert.ok(!added.includes('JBAP Receipt of Documents') && added.includes('Documents Received'), added.join());
});
test('Print dialog: a first print of a lot with JBAP Receipt of Documents blank needs a document ticked or Others typed', () => {
  const P = load(), scr = docmon(P), blank = scr.rows().find(r => r.doc_status === 'Pending Documents' && !r.orig_docs), done = scr.rows().find(r => r.doc_status === 'For Releasing');
  assert.match(P.docsNeededError(blank, [], '') || '', /^Tick at least one document received, or type Others/);
  assert.strictEqual(P.docsNeededError(blank, ['Spare Key'], ''), null); assert.strictEqual(P.docsNeededError(blank, [], 'Extra key'), null);
  assert.ok(done.orig_docs); assert.strictEqual(P.docsNeededError(done, [], ''), null, 'the date is already recorded: nothing is needed');
  const re = P.enrichV(Object.assign({}, blank._raw, { atf_no: 'HRAD-ATF-0042' })); assert.strictEqual(P.docsNeededError(re, [], ''), null, 'a reprint records no receipt');
  const src = fs.readFileSync(require('path').join(__dirname, '..', 'app.js'), 'utf8');
  assert.match(src, /id="dt-err-\$\{n\}" role="alert" hidden/); assert.match(src, /<fieldset class="dt-lot" aria-describedby="dt-err-\$\{n\}">/);
  assert.match(src, /if \(bad\) \{ \$\(`#dt-\$\{bad\.n\}-0`\)\.focus\(\); return; \}/, 'the dialog stays open on the error');
});
test('Stale saved ticks (the lot is not eligible any more) are not ticks: not counted, not acted on, shown unticked, dropped and logged on save', () => {
  const P = load(), scr = docmon(P), rows = scr.rows(), doasCol = scr.cols.find(c => c.key === 'for_doas_email'), printCol = scr.cols.find(c => c.key === 'print_doc_trans');
  const signed = rows.find(r => P.doasOf(r) === 'jbap' && r.rcv_doas), pendDoas = rows.find(r => r.doc_status === 'Pending DOAS' && P.doasOf(r) === 'jbap');
  signed._raw.for_doas_email = true; pendDoas._raw.print_doc_trans = true;   // saved ticks on lots that cannot use them
  assert.ok(!P.selectedRows(scr, 'for_doas_email').some(r => r.id === signed.id)); assert.ok(!P.selectedRows(scr, 'print_doc_trans').some(r => r.id === pendDoas.id));
  assert.strictEqual(P.effectiveCount(scr, 'for_doas_email'), 0); assert.strictEqual(P.effectiveCount(scr, 'print_doc_trans'), 0);
  assert.doesNotMatch(P.cellHtml(scr, scr.rows().find(r => r.id === signed.id), doasCol, true), /checked/); assert.match(P.cellHtml(scr, scr.rows().find(r => r.id === signed.id), doasCol, true), /disabled/);
  assert.doesNotMatch(P.cellHtml(scr, scr.rows().find(r => r.id === pendDoas.id), printCol, true), /checked/);
  // a good tick still counts
  const ok = rows.find(r => r.doc_status === 'Pending DOAS' && P.doasOf(r) === 'jbap' && r.id !== pendDoas.id); P.U(scr.id).edits[ok.id] = { for_doas_email: true };
  assert.strictEqual(P.effectiveCount(scr, 'for_doas_email'), 1); assert.deepStrictEqual(P.selectedRows(scr, 'for_doas_email').map(r => r.id), [ok.id]);
  // tick and date saved together: the tick is dropped in the same save and both steps are logged
  delete P.U(scr.id).edits[ok.id]; const n0 = P.S.log.length;
  P.U(scr.id).edits[ok.id] = { for_doas_email: true, rcv_doas: P.TODAY }; P.applyEdits(scr, [ok.id]);
  assert.strictEqual(ok._raw.rcv_doas, P.TODAY); assert.strictEqual(ok._raw.for_doas_email, false);
  assert.deepStrictEqual(P.S.log.slice(n0).filter(l => l.field === 'For DOAS Email?').map(l => [l.old, l.new]), [['No', 'Yes'], ['Yes', 'No']]);
  // a tick on an eligible lot survives a save of another field
  const keep = rows.find(r => r.doc_status === 'Pending DOAS' && P.doasOf(r) === 'jbap' && r.id !== ok.id && r.id !== pendDoas.id);
  P.U(scr.id).edits[keep.id] = { for_doas_email: true, doc_remarks: 'x' }; P.applyEdits(scr, [keep.id]); assert.strictEqual(keep._raw.for_doas_email, true);
  // Print Transmittal? saved on a lot outside its statuses (Pending DOAS) is dropped on save
  P.U(scr.id).edits[pendDoas.id] = { print_doc_trans: true, doc_remarks: 'y' }; P.applyEdits(scr, [pendDoas.id]);
  assert.strictEqual(pendDoas._raw.print_doc_trans, false, 'a Pending DOAS lot cannot keep a Print Transmittal? tick');
});
test('Email DOAS eligibility: only Pending DOAS (JBAP-signed DOAS, no Receipt of DOAS, no signed DOAS yet)', () => {
  const P = load(), scr = docmon(P), rows = scr.rows(), col = scr.cols.find(c => c.key === 'for_doas_email');
  const ok = rows.filter(r => P.doasOf(r) === 'jbap' && !r.rcv_doas && r.doc_status === 'Pending DOAS'); assert.ok(ok.length);
  assert.ok(ok.every(r => P.doasEmailOk(r) && !col.disabledWhen(r)));
  const v = ok[0]; v._raw.buyer_doas = P.TODAY;   // a signed DOAS is already back (JBAP sheet data), Receipt of DOAS blank
  const signed = P.enrichV(v._raw); assert.strictEqual(signed.doc_status, 'Pending Documents'); assert.ok(!signed.rcv_doas);
  assert.ok(!P.doasEmailOk(signed) && col.disabledWhen(signed), 'not Pending DOAS: not eligible');
  const n0 = P.S.log.length; P.recordDoasEmail(scr, [signed]); assert.ok(!v._raw.rcv_doas && P.S.log.length === n0, 'recordDoasEmail leaves it alone');
  const orig = ok[1]; orig._raw.orig_docs = P.TODAY; assert.ok(!P.doasEmailOk(P.enrichV(orig._raw)), 'documents already at JBAP: For Releasing');
});
test('Rule text: Email DOAS for signature and the Print transmittal email are explained', () => {
  const P = load(), rule = docmon(P).rule;
  assert.match(rule, /Email DOAS for signature emails the buyer for lots whose DOAS is signed at JBAP \(Pending DOAS\) and records Receipt of DOAS as today\./);
  assert.match(rule, /Print document transmittal also emails the buyer the Documents Release notice and records JBAP Receipt of Documents as today; printing a lot that already has an ATF No\. is a reprint and sends no email\./);
});
test('P4 pre-tick for Print Transmittal? covers only For Releasing lots without an ATF No.; a Pending Documents lot is never pre-ticked', () => {
  const P = load(), scr = docmon(P), rows = scr.rows();
  const pending = rows.filter(r => r.doc_status === 'Pending Documents' && !r.atf_no), releasing = rows.filter(r => r.doc_status === 'For Releasing' && !r.atf_no);
  assert.ok(pending.length && releasing.length, 'sample has both');
  assert.ok(pending.every(r => !scr.ready.when(r) && !P.printReady(r) && P.printTransOk(r)), 'a Pending Documents lot may be ticked by hand, but is not ready');
  assert.ok(releasing.every(r => scr.ready.when(r) && P.printReady(r)));
  assert.match(scr.ruleP[1], /^Lots whose documents are at JBAP \(For Releasing\) and have no ATF No\. yet arrive pre-ticked\./); assert.match(scr.ruleP[1], /A Pending Documents lot is ticked by hand/);
  assert.doesNotMatch(scr.ruleP[1], /waiting for the documents or holding/, 'the old scope (Pending Documents arrive pre-ticked) is gone from the rule text');
  const ids = list => list.map(r => r.id).sort();
  assert.deepStrictEqual(ids(P.selectedRows(scr, 'print_doc_trans')), [], 'switch off: nothing is pre-ticked');
  P.setProposed(true);
  const sel = P.selectedRows(scr, 'print_doc_trans');
  assert.deepStrictEqual(ids(sel), ids(releasing), 'switch on: only the For Releasing lots without an ATF No.');
  assert.ok(!sel.some(r => r.doc_status === 'Pending Documents'));
  assert.ok(pending.every(r => !P.tickDefault(scr, r, 'print_doc_trans')));
  P.U(scr.id).edits[pending[0].id] = { print_doc_trans: true };   // FAD ticks it by hand when the documents arrive
  assert.ok(P.selectedRows(scr, 'print_doc_trans').some(r => r.id === pending[0].id), 'a hand tick is allowed and counted');
});
