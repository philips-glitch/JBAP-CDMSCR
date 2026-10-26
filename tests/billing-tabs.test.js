const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness');
// Menu groups: screens shown as tabs of one menu entry, in tab order (user requests of 15 and 16 Oct 2026; the Rebate group is gone since JBAP's feedback of 26 Oct 2026: Rebate Monitoring is in Report, Rebate Payable in FAD)
const GROUPS = { Billing: { dept: 'FAD', ids: ['FAD/commission-billing', 'FAD/billing-monitoring', 'FAD/unpaid-billing'] } };
const deptMenu = (h, dept) => h.split(`id="grp-${dept}"`)[1].split('data-group=')[0];
test('a department shows one entry per group, linking to its first tab and active on every tab', () => {
  const P = load();
  for (const [group, { dept, ids }] of Object.entries(GROUPS)) {
    for (const id of ids) {
      const h = deptMenu(P.sideHtml(id), dept);
      assert.match(h, new RegExp(`<a class="mis is-active" href="#/${ids[0]}" aria-current="page"[^>]*>${group}<`), `${group} active on ${id}`);
      for (const other of ids.slice(1)) assert.ok(!h.includes(`href="#/${other}"`), `no separate entry for ${other}`);
      for (const x of ids) assert.doesNotMatch(h, new RegExp(`>${P.byId[x].title}<`), `${P.byId[x].title} is not a menu entry`);
    }
  }
  assert.doesNotMatch(deptMenu(P.sideHtml('FAD/unpaid'), 'FAD'), /mis is-active" href="#\/FAD\/commission-billing/, 'other screens leave the FAD entries inactive');
});
test('the Billing badge adds up its tabs (switch on)', () => {
  const P = load(); P.setProposed(true);
  const q = GROUPS.Billing.ids.map(id => P.queueCounts(P.byId[id])).filter(Boolean);
  assert.ok(q.length >= 2, 'Commission Billing and Billing Monitoring both count');
  const ready = q.reduce((a, x) => a + x.ready, 0), late = q.reduce((a, x) => a + x.late, 0);
  assert.match(P.sideHtml(''), new RegExp(`aria-label="Billing: ${ready} waiting, ${late} overdue"`));
});
test('every grouped screen shows the group heading, breadcrumb and tab bar in tab order; other screens have none', () => {
  const P = load();
  for (const [group, { dept, ids }] of Object.entries(GROUPS)) {
    for (const id of ids) {
      const s = P.byId[id], h = P.pageHead(s);
      assert.ok(h.includes(`<h1>${group}${P.newHtml({ isNew: ids.some(x => P.byId[x].isNew) })}</h1>`), `${id} h1`);   // the group heading shows New when one of its tabs is new
      assert.ok(h.includes(`<span>${dept}</span>›<span>${group}</span>›<b>${s.title}</b>`), `${id} breadcrumb`);
      assert.ok(h.includes(`<a href="#/${id}" class="tab is-active" aria-current="page">${s.title}${P.newMini(s)}<span class="cnt">${s.rows().length.toLocaleString()}</span></a>`), `${id} active tab`);
      for (const other of ids.filter(x => x !== id)) assert.ok(h.includes(`<a href="#/${other}" class="tab">`), `${id} links to ${other}`);
      const order = ids.map(x => h.indexOf(`href="#/${x}" class="tab`)); assert.deepStrictEqual([...order].sort((a, b) => a - b), order, `${group} tab order`);
      assert.deepStrictEqual(P.groupOf(s).map(x => x.id), ids);
    }
  }
  assert.doesNotMatch(P.pageHead(P.byId['FAD/unpaid']), /class="tabs"/);
  assert.strictEqual(P.groupOf(P.byId['FAD/unpaid']), null);
  assert.strictEqual(P.groupOf(P.byId['FAD/rebate-payable']), null, 'FAD Rebate Payable is not grouped');
  assert.doesNotMatch(P.pageHead(P.byId['FAD/rebate-payable']), /class="tabs"/, 'FAD Rebate Payable has no tabs');
});
test('Home labels the grouped screens "<group> › …"', () => {
  const P = load(), h = P.homeLayout();
  for (const [group, { ids }] of Object.entries(GROUPS)) for (const id of ids) assert.ok(h.includes(`${group} › ${P.byId[id].title}`), id);
});
