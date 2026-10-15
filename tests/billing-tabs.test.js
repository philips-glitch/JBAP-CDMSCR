const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness');
const BM = 'FAD/billing-monitoring', UB = 'FAD/unpaid-billing';
test('FAD shows one Billing entry for the two billing screens, active on both', () => {
  const P = load();
  for (const id of [BM, UB]) {
    const h = P.sideHtml(id);
    assert.match(h, /<a class="mis is-active" href="#\/FAD\/billing-monitoring" aria-current="page"[^>]*>Billing</);
    assert.ok(!h.includes(`href="#/${UB}"`), 'no separate Unpaid Billing entry');
    assert.doesNotMatch(h, />Billing Monitoring</); assert.doesNotMatch(h, />Unpaid Billing</);
  }
  assert.doesNotMatch(P.sideHtml('FAD/unpaid'), /is-active" href="#\/FAD\/billing-monitoring/);
});
test('the Billing badge adds up both tabs (switch on)', () => {
  const P = load(); P.setProposed(true);
  const q = [BM, UB].map(id => P.queueCounts(P.byId[id])).filter(Boolean), ready = q.reduce((a, x) => a + x.ready, 0), late = q.reduce((a, x) => a + x.late, 0);
  assert.match(P.sideHtml(''), new RegExp(`aria-label="Billing: ${ready} waiting, ${late} overdue"`));
});
test('both billing screens show the Billing heading, breadcrumb and tab bar; other screens have none', () => {
  const P = load();
  for (const [id, other] of [[BM, UB], [UB, BM]]) {
    const s = P.byId[id], h = P.pageHead(s);
    assert.match(h, /<h1>Billing</);
    assert.ok(h.includes(`<span>FAD</span>›<span>Billing</span>›<b>${s.title}</b>`));
    assert.ok(h.includes(`<a href="#/${id}" class="tab is-active" aria-current="page">${s.title}<span class="cnt">${s.rows().length}</span></a>`));
    assert.ok(h.includes(`<a href="#/${other}" class="tab">`));
    assert.deepStrictEqual(P.groupOf(s).map(x => x.id), [BM, UB]);
  }
  assert.doesNotMatch(P.pageHead(P.byId['FAD/unpaid']), /class="tabs"/);
  assert.strictEqual(P.groupOf(P.byId['FAD/unpaid']), null);
});
test('Home labels the grouped screens "Billing › …"', () => {
  const h = load().homeLayout();
  assert.match(h, /Billing › Billing Monitoring/); assert.match(h, /Billing › Unpaid Billing/);
});
