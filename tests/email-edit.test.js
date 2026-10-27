const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness');
test('Email body is wrapped for editing; edited flag; edit logged', () => {
  const P = load();
  const html = P.REPORTS.email({ from: 'a@x', to: 'b@x', cc: 'c@x', subject: 'S', body: '<p>Hello</p>' });
  assert.match(html, /data-em-body/); assert.match(html, /Edit/); assert.match(html, /Reset to standard text/);
  assert.strictEqual(P.editedFlag('<p>Hello</p>', '<p>Hello</p>\n'), false);
  assert.strictEqual(P.editedFlag('<p>Hello</p>', '<p>Hello, please call us</p>'), true);
  const scr = P.byId['FAD/document-monitoring'], v = scr.rows()[0];
  P.logEmailEdit(scr, [v]); assert.strictEqual(P.S.log.at(-1).field, 'Email body edited'); assert.strictEqual(P.S.log.at(-1).new, 'Yes');
});
// ---- more checks ----
const fs = require('fs'), path = require('path');
const mail = (o = {}) => Object.assign({ from: 'finance@x', to: 'Some Buyer <buyer@x>', cc: 'sales@x', subject: 'JBAP TEST - SOME BUYER', body: '<p>Hello</p>' }, o);
test('Email preview: toolbar buttons named by recipient, body labelled, standard text kept, header and attachments not editable', () => {
  const P = load(), html = P.REPORTS.email(mail({ atts: [{ key: 'k1', name: 'A.pdf' }] }));
  assert.match(html, /<button type="button" class="em-btn" data-em-edit aria-label="Edit email to Some Buyer &lt;buyer@x&gt; \(JBAP TEST - SOME BUYER\)">Edit<\/button><span class="ptag mini new" title="Added or changed after JBAP's feedback of 26 Oct 2026">New<\/span><button /);
  assert.match(html, /<button type="button" class="em-btn gh" data-em-reset aria-label="Reset to standard text, email to Some Buyer &lt;buyer@x&gt; \(JBAP TEST - SOME BUYER\)">Reset to standard text<\/button>/);
  assert.match(html, /<div class="em-body" data-em-body data-std="&lt;p&gt;Hello&lt;\/p&gt;" role="group" aria-label="Email body, to Some Buyer &lt;buyer@x&gt; \(JBAP TEST - SOME BUYER\)" spellcheck="false"><p>Hello<\/p><\/div>/);
  assert.match(html, /class="mail-tools no-print"/, 'the toolbar is hidden when printing');
  assert.doesNotMatch(html, /contenteditable/, 'nothing is editable until Edit is pressed');
  const head = html.slice(html.indexOf('<div class="mail-h">'), html.indexOf('<div class="mail-tools'));
  assert.ok(head.includes('<b>From</b><span>finance@x</span>') && head.includes('<b>CC</b><span>sales@x</span>') && head.includes('data-att="k1"'), 'From, CC and the attachment sit in the header, outside the editable body');
  assert.strictEqual((html.match(/data-em-body/g) || []).length, 1);
});
test('Email preview: the standard text is stored escaped, so quotes and tags in a body cannot break out of the attribute', () => {
  const P = load(), body = `<p class="x">It's "quoted" &amp; <b>bold</b></p>`, html = P.REPORTS.email(mail({ body, to: 'O"Neil <o@x>' }));
  const std = /data-std="([^"]*)"/.exec(html)[1];
  assert.ok(!/[<>]/.test(std) && !std.includes("'"), 'no raw markup in the attribute');
  assert.strictEqual(std.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&'), body, 'the attribute decodes to the exact standard body');
  assert.match(html, /aria-label="Edit email to O&quot;Neil &lt;o@x&gt; \(/, 'the recipient is escaped in the button name');
  assert.strictEqual((html.match(/aria-label="Email body, to O&quot;Neil &lt;o@x&gt; \(/g) || []).length, 1, 'the body name is escaped too');
});
test('Two emails to the same recipients get different button names (Return to Seller: one email per seller)', () => {
  const P = load(), a = P.REPORTS.email(mail({ to: 'finance@x; vwd@x', subject: 'RETURN TO SELLER - A' })), b = P.REPORTS.email(mail({ to: 'finance@x; vwd@x', subject: 'RETURN TO SELLER - B' }));
  const name = h => /data-em-edit aria-label="([^"]*)"/.exec(h)[1]; assert.notStrictEqual(name(a), name(b));
});
test('editedFlag: whitespace is collapsed and trimmed, a real change is not', () => {
  const P = load(), std = '<p>Dear Client,</p>\n    <p>Thank you.</p>';
  assert.strictEqual(P.editedFlag(std, '<p>Dear Client,</p> <p>Thank   you.</p>\n\n'), false);
  assert.strictEqual(P.editedFlag(std, '  <p>Dear Client,</p>\t<p>Thank you.</p>'), false);
  assert.strictEqual(P.editedFlag('<p>a b</p>', '<p>a&nbsp;b</p>'), false, 'a non-breaking space typed by an editor is a space');
  assert.strictEqual(P.editedFlag(std, '<p>Dear Client,</p><p>Thank you!</p>'), true);
  assert.strictEqual(P.editedFlag(std, ''), true); assert.strictEqual(P.editedFlag('', '  \n '), false); assert.strictEqual(P.editedFlag(null, undefined), false);
});
test('logEmailEdit logs "Email body edited" No → Yes on every lot of the email, under the screen that sent it', () => {
  const P = load(), scr = P.byId['FAD/document-monitoring'], lots = scr.rows().slice(0, 3), n = P.S.log.length;
  P.logEmailEdit(scr, lots);
  const added = P.S.log.slice(n); assert.strictEqual(added.length, 3);
  added.forEach((e, i) => { assert.deepStrictEqual([e.field, e.old, e.new, e.action, e.screen, e.module], ['Email body edited', 'No', 'Yes', 'Update', scr.title, scr.dept]); assert.match(e.record, new RegExp(`Lot ${lots[i].lot}`)); });
  P.logEmailEdit(scr, []); assert.strictEqual(P.S.log.length, n + 3, 'an email with no lots logs nothing');
});
test('Every send handler logs the edited emails before it records the lots', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8'), rpt = fs.readFileSync(path.join(__dirname, '..', 'reports.js'), 'utf8');
  for (const act of ['emailBaaf', 'emailSaaf', 'emailDoas', 'emailDispatch', 'printReturn', 'printDocTrans']) {
    const start = Math.max(src.indexOf(`\n  ${act}(scr) {`), src.indexOf(`\n  ${act}(scr, el) {`)), end = src.indexOf('\n  },', start), fn = src.slice(start, end);
    assert.ok(start > 0 && /logEmailEdits\(scr, /.test(fn), `${act} logs edited emails`);
    assert.ok(fn.indexOf('logEmailEdits(') < fn.search(/record(Awarding|SaafSent|DoasEmail|Dispatch|ReturnClearance|DocTransmittal)\(/), `${act}: edits are logged before the lots are recorded`);
  }
  assert.ok(rpt.includes('data-std="${esc(body)}"'), 'the standard body is only ever stored escaped');
});
// ---- fix round 1 ----
test('New badge sits beside Edit in every email preview, outside the button; the four opener buttons carry none', () => {
  const P = load(), html = P.REPORTS.email(mail());
  const tools = html.slice(html.indexOf('<div class="mail-tools'), html.indexOf('<div class="mail-b">'));
  assert.strictEqual((tools.match(/ptag mini new/g) || []).length, 1, 'one New badge in the toolbar');
  assert.ok(tools.includes('>Edit</button><span class="ptag mini new"'), 'right after the Edit button, outside it');
  assert.match(tools, /data-em-edit aria-label="Edit email to Some Buyer &lt;buyer@x&gt; \(JBAP TEST - SOME BUYER\)">Edit<\/button>/, 'the button name is unchanged');
  const all = P.SCREENS.flatMap(s => s.buttons || []);
  for (const act of ['emailBaaf', 'emailDispatch', 'printReturn']) { const b = all.filter(x => x.act === act); assert.ok(b.length, act); b.forEach(x => assert.ok(!x.isNew, `${act} opener has no New badge`)); }
  assert.doesNotMatch(P.saafAuctionCard(P.byId['SMD/saaf']), /ptag mini new/, 'the SAAF row buttons carry none either (27 Oct 2026: Email SAAF sits on each auction row)');
});
test('Each email body has its own name, the same recipient and subject as its Edit button', () => {
  const P = load(), a = P.REPORTS.email(mail({ to: 'finance@x; vwd@x', subject: 'RETURN TO SELLER - A' })), b = P.REPORTS.email(mail({ to: 'finance@x; vwd@x', subject: 'RETURN TO SELLER - B' }));
  const body = h => /data-em-body[^>]* aria-label="([^"]*)"/.exec(h)[1], btn = h => /data-em-edit aria-label="Edit email to ([^"]*)"/.exec(h)[1];
  assert.notStrictEqual(body(a), body(b)); assert.strictEqual(body(a), `Email body, to ${btn(a)}`); assert.strictEqual(body(b), `Email body, to ${btn(b)}`);
});
test('Email body: spell-check off', () => { assert.match(load().REPORTS.email(mail()), /<div class="em-body" data-em-body [^>]*spellcheck="false">/); });
test('emailsDirty: a body in edit mode or different from its standard text keeps the dialog open on a backdrop click; drops are refused', () => {
  const P = load(), std = '<p>Dear Client,</p>\n<p>Thank you.</p>', same = { editing: false, std, html: '<p>Dear Client,</p> <p>Thank you.</p>  ' };
  assert.strictEqual(P.emailsDirty([]), false, 'a dialog with no email body (a report, a form) closes as before');
  assert.strictEqual(P.emailsDirty([same, same]), false);
  assert.strictEqual(P.emailsDirty([same, Object.assign({}, same, { editing: true })]), true, 'in edit mode');
  assert.strictEqual(P.emailsDirty([same, Object.assign({}, same, { html: '<p>Dear Mr X,</p><p>Thank you.</p>' })]), true, 'edited text');
  const src = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.match(src, /ev\.target === bg && downOn === bg && !emailsDirty\(/, 'the backdrop rule asks emailsDirty');
  assert.ok(src.includes("bg.addEventListener('drop', ev => { if (ev.target.closest?.('[data-em-body]')) ev.preventDefault(); });"), 'drops into an email body are refused');
});
