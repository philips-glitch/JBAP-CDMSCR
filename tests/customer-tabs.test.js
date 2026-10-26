const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness');
// JBAP's SMD buyer search (Q21, 20 Oct 2026): Sales Action, Sold units, Pending Awarding, Unpaid, Vehicle for release, Cancellation; "+ Date of release/return".
// Sales Actions stays out (Q22, user decision).
const onRelease = P => P.V().filter(v => v.cid && v.status === 'Sold' && v.dispatch && !v.release);
const lotTable = h => h.slice(h.indexOf('aria-label="Lot lists"'));
const heads = h => [...lotTable(h).matchAll(/<th scope="col"><span class="hb">([^<]*)/g)].map(m => m[1]);

test('tab order: Sold, Pending Awarding, Unpaid, Vehicle for release, Pending DOAS signature, Documents for release, Cancellation', () => {
  const P = load(), cid = onRelease(P)[0].cid, h = P.customerPage(cid, 'sold'), bar = h.slice(h.indexOf('aria-label="Lot lists"'), h.indexOf('</nav>', h.indexOf('aria-label="Lot lists"')));
  assert.deepStrictEqual([...bar.matchAll(/class="tab[^"]*"[^>]*>([A-Za-z ]+?)(?:<span class="ptag|<span class="cnt)/g)].map(m => m[1]),
    ['Sold', 'Pending Awarding', 'Unpaid', 'Vehicle for release', 'Pending DOAS signature', 'Documents for release', 'Cancellation']);
  assert.doesNotMatch(h, /Sales Action/, 'Sales Actions stays out of the customer page');
});

test('custRoute reads the Vehicle for release list', () => {
  const P = load();
  assert.deepStrictEqual(P.custRoute('customer/B9026/vehicle-release'), { cid: 'B9026', tab: 'vehicle-release' });
  assert.strictEqual(P.custRoute('customer/B9026/vehicle-release/x'), null);
});

test('buyerOf.for_release: the buyer\'s sold lots with a Dispatch Date and no release yet', () => {
  const P = load(), cid = onRelease(P)[0].cid, b = P.buyerOf(cid);
  const want = P.V().filter(v => v.cid === cid && v.status === 'Sold' && v.dispatch && !v.release).map(v => v.id).sort();
  assert.ok(want.length > 0);
  assert.deepStrictEqual(b.for_release.map(v => v.id).sort(), want);
  assert.ok(b.for_release.every(v => v.step === 'Unreleased'), 'the same lots Step calls Unreleased');
  // a release (any type) takes the lot out of the list; a lot not yet dispatched is not on it
  const lot = b.for_release[0]; lot._raw.release = P.TODAY; lot._raw.release_type = 'Sold';
  assert.ok(!P.buyerOf(cid).for_release.some(v => v.id === lot.id), 'released: gone');
  lot._raw.release_type = 'Return to Seller'; assert.ok(!P.buyerOf(cid).for_release.some(v => v.id === lot.id), 'returned: gone');
  delete lot._raw.release; delete lot._raw.release_type;
  const d = lot._raw.dispatch; delete lot._raw.dispatch; assert.ok(!P.buyerOf(cid).for_release.some(v => v.id === lot.id), 'no Dispatch Date: not on the list'); lot._raw.dispatch = d;
  assert.ok(P.buyerOf(cid).for_release.some(v => v.id === lot.id), 'back once dispatched and unreleased again');
  const none = P.V().find(v => v.cid && v.status === 'Sold' && !P.buyerOf(v.cid).for_release.length);
  assert.match(P.customerPage(none.cid, 'vehicle-release'), /No vehicle waiting for release/);
});

test('Vehicle for release tab: the Sold columns plus Dispatch Date, Dispatch Deadline and Penalty; one row per lot, totals', () => {
  const P = load(), cid = onRelease(P)[0].cid, b = P.buyerOf(cid), h = P.customerPage(cid, 'vehicle-release');
  assert.deepStrictEqual(heads(h), ['Auction Month', 'Auction No.', 'Lot', 'Seller', 'Plate', 'Make/Model', 'Result Price', 'Notarial', 'Commission', 'Total', 'Step', 'Dispatch Date', 'Dispatch Deadline', 'Penalty']);
  const t = lotTable(h);
  assert.strictEqual((t.match(/<tr data-lot=/g) || []).length, b.for_release.length);
  assert.match(h, /aria-current="page">Vehicle for release<span class="cnt">\d+<\/span>/, 'no New mark: the 20 Oct mark is gone');
  const lot = b.for_release.find(v => v.penalty > 0) || b.for_release[0], row = t.slice(t.indexOf(`data-lot="${lot.id}"`), t.indexOf('</tr>', t.indexOf(`data-lot="${lot.id}"`)));
  assert.ok(row.includes(`>${P.fmtDate(lot.dispatch)}<`), 'Dispatch Date');
  assert.ok(row.includes(P.fmtDate(lot.dispatch_deadline)), 'Dispatch Deadline');
  if (lot.penalty) assert.ok(row.includes(lot.penalty.toLocaleString('en-US', { minimumFractionDigits: 2 })), 'Penalty');
  assert.match(t, new RegExp(`<tfoot><tr><td[^>]*>Total \\(${b.for_release.length}\\)</td>`));
  const pen = b.for_release.reduce((a, v) => a + (v.penalty || 0), 0);
  assert.ok(t.slice(t.indexOf('<tfoot>')).includes(pen.toLocaleString('en-US', { minimumFractionDigits: 2 })), 'penalty total');
  // the deadline of an overdue lot is shown late, like the FAD lists
  const late = b.for_release.find(v => v.dispatch_deadline < P.TODAY);
  if (late) assert.match(t, new RegExp(`<td class=" c late">${P.fmtDate(late.dispatch_deadline)}</td>`));
});

test('Sold tab: Date of Release / Return is the release date of the lot, any release type, blank while in the yard', () => {
  const P = load(), cid = onRelease(P)[0].cid, h = P.customerPage(cid, 'sold');
  const hs = heads(h); assert.strictEqual(hs.at(-1), 'Date of Release / Return', 'after Step');
  assert.match(h, /<th scope="col"><span class="hb">Date of Release \/ Return<\/span>/, 'no New mark: the 20 Oct mark is gone');
  const b = P.buyerOf(cid), yard = b.sold.find(v => !v.release), rowOf = (html, v) => { const t = lotTable(html); const i = t.indexOf(`data-lot="${v.id}"`); return t.slice(i, t.indexOf('</tr>', i) + 5); };
  assert.ok(yard, 'a lot still in the yard'); assert.match(rowOf(h, yard), /<td class=" c"><\/td><\/tr>$/, 'blank');
  const lot = b.sold[0]; lot._raw.release = '2026-10-02'; lot._raw.release_type = 'Sold';
  assert.match(rowOf(P.customerPage(cid, 'sold'), lot), /<td class=" c">10\/02\/2026<\/td><\/tr>$/, 'a release to the buyer');
  lot._raw.release_type = 'Return to Seller';
  assert.match(rowOf(P.customerPage(cid, 'sold'), lot), /<td class=" c">10\/02\/2026<\/td><\/tr>$/, 'a return to the seller');
  lot._raw.release_type = 'Others';
  assert.match(rowOf(P.customerPage(cid, 'sold'), lot), /<td class=" c">10\/02\/2026<\/td><\/tr>$/, 'any other release type');
  // only the Sold tab has the column
  for (const tab of ['pending-awarding', 'unpaid', 'vehicle-release', 'pending-doas', 'docs-release', 'cancellation']) assert.ok(!heads(P.customerPage(cid, tab)).includes('Date of Release / Return'), tab);
});

test('customer page rule sentence names Vehicle for release and Date of Release / Return', () => {
  const P = load(), h = P.customerPage(onRelease(P)[0].cid, 'sold'), rule = h.slice(h.indexOf('<p class="rule">'), h.indexOf('</p>', h.indexOf('<p class="rule">')));
  assert.match(rule, /Vehicle for release = dispatched \(Dispatch Date filled\) and not released yet, with its dispatch deadline and storage penalty/);
  assert.match(rule, /Date of Release \/ Return on the Sold list = the release date of the lot \(any release type\), blank while the unit is in the yard/);
  assert.match(rule, /Pending DOAS signature = /, 'the Q82 sentence stays');
});

test('the New marks of 20 Oct on the customer page are gone since 26 Oct 2026: no column head carries one on Sold or Vehicle for release', () => {
  const P = load(), cid = onRelease(P)[0].cid;
  for (const tab of ['sold', 'vehicle-release']) assert.doesNotMatch(P.customerPage(cid, tab), /<th scope="col"><span class="hb">[^<]*<span class="ptag new"/, tab);
});
