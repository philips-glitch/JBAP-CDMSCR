const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness');
// JBAP feedback of 16 Oct 2026: #1 Report menu, #2 VWD Auction Monitoring removed, #3 record counts
test('Report menu: Result Summary and Auction Monitoring moved out of FAD and SMD', () => {
  const P = load();
  for (const id of ['report/result-summary', 'report/auction-monitoring']) {
    const s = P.byId[id]; assert.ok(s, id); assert.strictEqual(s.dept, 'Report'); assert.deepStrictEqual(s.actions, ['View', 'Filter', 'Sort'], id);
  }
  for (const id of ['FAD/result-summary', 'SMD/result-summary', 'FAD/auction-monitoring', 'SMD/auction-monitoring', 'VWD/auction-monitoring']) assert.strictEqual(P.byId[id], undefined, id);
  assert.strictEqual(P.byId['report/auction-monitoring'].rows().length, P.V().length, 'live lots, not the SMD snapshot');
  assert.match(P.pageHead(P.byId['report/result-summary']), /Home<\/a>›<span>Report<\/span>›<b>Result Summary<\/b>/);
  const side = P.sideHtml('report/auction-monitoring');
  assert.match(side, /data-group="Report"/); assert.doesNotMatch(side, /data-disabled="Report"/);
  assert.match(side, /<a class="mis is-active" href="#\/report\/auction-monitoring" aria-current="page">Auction Monitoring<span class="cnt">\d+<\/span><\/a>/);
  assert.match(P.homeLayout(), /href="#\/report\/result-summary"/);
});
test('old links of moved or merged screens open their new place', () => {
  const P = load();
  const want = { 'FAD/result-summary': 'report/result-summary', 'SMD/result-summary': 'report/result-summary', 'FAD/auction-monitoring': 'report/auction-monitoring',
    'SMD/auction-monitoring': 'report/auction-monitoring', 'VWD/auction-monitoring': 'report/inventory-monitoring', 'FAD/cancellation-monitoring': 'FAD/cancellation-entry',
    'SMD/cancellation-monitoring': 'FAD/cancellation-entry', 'FAD/cancellation-payment': 'FAD/cancellation-billing' };
  for (const [from, to] of Object.entries(want)) assert.strictEqual(P.routeOf(from), to, from);
  assert.strictEqual(P.routeOf('FAD/unpaid'), 'FAD/unpaid'); assert.strictEqual(P.routeOf('nope'), ''); assert.strictEqual(P.routeOf('customer/B0313'), 'customer/B0313');
  for (const h of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) assert.strictEqual(P.routeOf(h), '', `'#/${h}' is not a screen (inherited object properties are not routes)`);
});
test('route(): an inherited property name in the address is not a moved screen, and nothing is written to the address bar', () => {
  const P = load(), calls = [], had = 'history' in globalThis, prev = globalThis.history;
  globalThis.history = { replaceState: (...a) => calls.push(a) };   // Node has no history: stub it so route() reaches the replaceState branch
  try {
    for (const h of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) { P.location.hash = `#/${h}`; assert.strictEqual(P.route(), '', h); }
    assert.deepStrictEqual(calls, [], 'a non-moved address is left as typed');
    P.location.hash = '#/FAD/result-summary'; assert.strictEqual(P.route(), 'report/result-summary');
    assert.deepStrictEqual(calls, [[null, '', '#/report/result-summary']], 'a moved address is rewritten to the new link');
  } finally { if (had) globalThis.history = prev; else delete globalThis.history; }
});
test('sidebar: every menu item shows its record count; grouped entries and Log Activity do not', () => {
  const P = load(), side = P.sideHtml('');
  for (const id of ['FAD/unpaid', 'FAD/document-monitoring', 'FAD/security-bond', 'SMD/unpaid', 'VWD/for-dispatch', 'customer-inquiry', 'report/result-summary']) {
    const s = P.byId[id];
    assert.match(side, new RegExp(`href="#/${id}"[^>]*>${s.title}(<span class="ptag[^<]*</span>)?<span class="cnt">${s.rows().length.toLocaleString()}</span></a>`), id);
  }
  assert.doesNotMatch(side, />Billing<span class="cnt">/); assert.doesNotMatch(side, />Rebate<span class="cnt">/); assert.doesNotMatch(side, /Log Activity<span class="cnt">/);
  P.setProposed(true); const on = P.sideHtml('');
  assert.doesNotMatch(on, /href="#\/FAD\/payment-seller"[^>]*>Payment Seller<span class="cnt">/, 'switch on: a P6 queue shows its badges instead');
  assert.match(on, /href="#\/FAD\/unpaid"[^>]*>Unpaid<span class="cnt">/, 'no queue: count stays');
});
