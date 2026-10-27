const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness');
// Guard for the New badge (user, 26 Oct 2026): it marks only what was added or changed after JBAP's feedback of 26 Oct 2026 (round 5).
// The sets below are the whole inventory, written out on purpose: a badge that appears on anything else, or one that goes missing, fails here.
// To mark a new item in a later round, change the code and this list together (and README: the "New badge" bullet).
const NEW_SCREENS = ['FAD/for-dispatch', 'FAD/return-approval', 'FAD/document-monitoring', 'FAD/rebate-payable', 'Auction/result-price',
  'approval/rebate-approval', 'customer/sales-actions', 'report/liability-to-seller', 'report/rebate-monitoring'];
const NEW_ITEMS = ['buttons FAD/document-monitoring emailDoas', 'buttons FAD/document-monitoring printDocTrans',
  'cols FAD/document-monitoring change_date', 'cols FAD/document-monitoring for_doas_email',
  'cols FAD/pending-awarding rebate_ok', 'cols FAD/pending-awarding rebate_status'];
const NEW_SIDEBAR = ['Document Monitoring', 'Liability to Seller', 'Rebate Approval', 'Rebate Monitoring', 'Rebate Payable', 'Result Price', 'Sales Actions', 'Vehicle Dispatch'];
const NEW_HOME = ['Document Monitoring', 'Liability to Seller', 'Rebate Monitoring', 'Rebate Payable', 'Result Price', 'Vehicle Dispatch › For Dispatch', 'Vehicle Dispatch › Return to Seller Approval'];
const MARK = /class="ptag[^"]*\bnew\b/g;
const marks = html => (html.match(MARK) || []).length;
const sorted = a => [...a].sort();
const both = fn => { for (const on of [false, true]) { const P = load(); P.setProposed(on); fn(P, on); } };   // the badge is not tied to the Proposed improvements switch

test('New badge: exactly the round-5 screens carry isNew', () => {
  both((P, on) => {
    assert.deepStrictEqual(sorted(P.SCREENS.filter(s => s.isNew).map(s => s.id)), sorted(NEW_SCREENS), `switch ${on ? 'on' : 'off'}`);
  });
});

test('New badge: exactly the round-5 columns, buttons and filters carry isNew', () => {
  both((P, on) => {
    const found = [];
    for (const s of P.SCREENS) for (const [prop, list] of Object.entries(s)) {
      if (Array.isArray(list)) list.forEach(o => { if (o && typeof o === 'object' && o.isNew) found.push(`${prop} ${s.id} ${o.key || o.act || o.label}`); });
    }
    assert.deepStrictEqual(sorted(found), sorted(NEW_ITEMS), `switch ${on ? 'on' : 'off'}`);
  });
});

test('New badge: rendered page titles, list cards, sidebar and Home show the badge only on those items', () => {
  both((P, on) => {
    const at = `switch ${on ? 'on' : 'off'}`;
    // page titles: a badge in the h1 exactly for the new screens (a group shows it for a new tab, and both Vehicle Dispatch tabs are new)
    for (const s of P.SCREENS) {
      const h1 = /<h1>[^]*?<\/h1>/.exec(P.pageHead(s))[0];
      assert.strictEqual(marks(h1) > 0, NEW_SCREENS.includes(s.id), `${s.id} title, ${at}`);
    }
    // list cards: one badge per new column or button, none elsewhere
    for (const s of P.SCREENS) {
      let card; try { card = P.dataCard(s, 'x'); } catch (e) { assert.fail(`${s.id}: dataCard threw ${e.message}`); }
      const want = NEW_ITEMS.filter(i => i.split(' ')[1] === s.id).length;
      assert.strictEqual(marks(card), want, `${s.id} card, ${at}`);
    }
    // sidebar: the entries with a badge
    const side = P.sideHtml('').split('<a class="mis').slice(1).map(c => c.slice(0, c.indexOf('</a>')));
    const sideNew = side.filter(c => marks(c)).map(c => />([^<]+)</.exec(c)[1]);
    assert.deepStrictEqual(sorted(sideNew), sorted(NEW_SIDEBAR), `sidebar, ${at}`);
    // Home: the links with a badge (Home has cards for FAD, SMD, VWD and Report only)
    const home = P.homeLayout().split('<li><a href="#/').slice(1).map(c => c.slice(0, c.indexOf('</a>')));
    const homeNew = home.filter(c => marks(c)).map(c => />([^<]+)</.exec(c)[1]);
    assert.deepStrictEqual(sorted(homeNew), sorted(NEW_HOME), `Home, ${at}`);
  });
});

test('New badge: a customer page shows it only on the Sales Actions tab, whatever the buyer and the tab', () => {
  const P = load(), pick = [];
  // buyers: with sales actions, with a vehicle for release, with a cancellation, with a lot waiting for the DOAS or the documents, with none of these, and an unknown one
  for (const cid of ['B9034', 'B0313', 'B0193']) pick.push(cid);
  const rows = P.buyerRows().map(r => P.buyerOf(r.cid)).filter(Boolean);
  for (const f of [b => b.for_release.length, b => b.cancels.length, b => b.pending_doas.length, b => b.docs_release.length, b => !b.sales.length && !b.sold.length]) { const b = rows.find(f); if (b) pick.push(b.cid); }
  pick.push('B0000-none');
  assert.ok(new Set(pick).size >= 6, 'a spread of buyers: ' + pick.join(', '));
  const tabs = ['sold', 'pending-awarding', 'unpaid', 'vehicle-release', 'pending-doas', 'docs-release', 'cancellation', 'sales-actions'];
  for (const cid of new Set(pick)) {
    const unknown = !P.buyerOf(cid);
    for (const tab of tabs) {
      const html = P.customerPage(cid, tab);
      if (unknown) { assert.strictEqual(marks(html), 0, `${cid} (no such buyer) ${tab}`); continue; }
      assert.strictEqual(marks(html), 1, `${cid} ${tab}: one badge on the page`);
      assert.match(html, /<a href="#\/customer\/[^"]+\/sales-actions" class="tab[^"]*"[^>]*>Sales Actions<span class="ptag mini new"/, `${cid} ${tab}: it sits on the Sales Actions tab`);
      assert.ok((html.match(/<th[^>]*>[^]*?<\/th>/g) || []).every(th => !marks(th)), `${cid} ${tab}: no badge on a column head`);
    }
  }
  // the lists behind the customer menu: Customer Inquiry has no badge, Customer › Sales Actions is a new screen (title and menu only)
  assert.strictEqual(marks(P.dataCard(P.byId[P.CUST_ID], 'x')), 0);
  assert.strictEqual(marks(P.dataCard(P.byId['customer/sales-actions'], 'x')), 0, 'columns of the Sales Actions list carry none: the screen is new as a whole');
});

test('New badge: the Edit button of an email preview carries it, and nothing else in the email does', () => {
  both(P => {
    const html = P.REPORTS.email({ from: 'finance@x', to: 'Some Buyer <buyer@x>', cc: 'sales@x', subject: 'JBAP TEST - SOME BUYER', body: '<p>Hello</p>', atts: [{ key: 'k1', name: 'A.pdf' }] });
    assert.strictEqual(marks(html), 1);
    assert.match(html, /data-em-edit aria-label="[^"]*">Edit<\/button><span class="ptag mini new"/);
  });
});
