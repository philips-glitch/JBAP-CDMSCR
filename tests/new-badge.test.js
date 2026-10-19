const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness');
// User, 19 Oct 2026: one "New" badge, always on, on everything added or changed in rounds 2b + 3
test('New badge on screens, menu items, columns and buttons marked isNew; nothing else', () => {
  const P = load(), scr = P.byId['FAD/unpaid'];
  assert.match(P.newHtml({ isNew: true }), /<span class="ptag new" title="Added or changed after JBAP's feedback of 19 Oct 2026">New<\/span>/);
  assert.strictEqual(P.newHtml({}), ''); assert.match(P.newMini({ isNew: true }), /ptag mini new/);
  scr.isNew = true; scr.cols[0].isNew = true; scr.buttons[0].isNew = true;
  assert.match(P.pageHead(scr), /<h1>Unpaid[^<]*<span class="ptag new"/);
  assert.match(P.sideHtml(''), /href="#\/FAD\/unpaid"[^>]*>Unpaid<span class="ptag mini new"/);
  const card = P.dataCard(scr, 'x');
  assert.match(card, /<span>Auction Number<\/span>[^]*?<span class="ptag new"/);
  assert.match(card, /data-act="save">[^]*?Save changes<span class="ptag new"/);
  assert.doesNotMatch(P.pageHead(P.byId['FAD/payment-seller']), /ptag new/);
  P.byId['FAD/rebate-payable'].isNew = true;
  assert.match(P.sideHtml(''), />Rebate<span class="ptag mini new"/, 'a group shows New when one of its screens is new');
});
