const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness');
// JBAP, 19 Oct 2026: filter on 2 or more values
test('a dropdown filter takes several values (any of them passes); a single string still works', () => {
  const P = load(), scr = P.byId['FAD/unpaid'], rows = scr.rows();
  const two = [...new Set(rows.map(r => r.seller))].slice(0, 2); assert.strictEqual(two.length, 2);
  P.U(scr.id).applied = { seller: two };
  assert.deepStrictEqual(P.applyFilters(scr, rows).map(r => r.id).sort(), rows.filter(r => two.includes(r.seller)).map(r => r.id).sort());
  P.U(scr.id).applied = { seller: [two[0]] }; assert.ok(P.applyFilters(scr, rows).every(r => r.seller === two[0]));
  P.U(scr.id).applied = { seller: two[0] }; assert.ok(P.applyFilters(scr, rows).every(r => r.seller === two[0]), 'string');
  P.U(scr.id).applied = { seller: [] }; assert.strictEqual(P.applyFilters(scr, rows).length, rows.length, 'empty = All');
});
test('filters with their own rule run per picked value', () => {
  const P = load(), scr = P.byId['FAD/document-monitoring'], rows = scr.rows();
  P.U(scr.id).applied = { doc_status: ['Complete', 'For Releasing'] };
  assert.ok(P.applyFilters(scr, rows).every(r => ['Complete', 'For Releasing'].includes(r.doc_status)));
});
test('the filter card renders tick boxes for dropdown filters, with the picked values checked', () => {
  const P = load(), scr = P.byId['FAD/unpaid']; P.U(scr.id).filters = { seller: ['EWB'] };
  const h = P.filterCard(scr);
  assert.match(h, /<details class="msel"/); assert.match(h, /data-mfilter="seller" value="EWB" checked/);
  assert.match(h, /<summary class="ctl"[^>]*title="EWB"[^>]*><span class="msel-t" id="f-seller-s">EWB<\/span><\/summary>/);
  assert.match(h, /<summary[^>]*aria-labelledby="f-seller-l f-seller-s"/, 'the button is announced as its label plus the picks'); assert.doesNotMatch(h, /ptag mini new/, 'the New mark of the filter card (19 Oct) is gone');
});
test('a rule filter with 2 picks gives the rows of both picks, and an empty tick list is not treated as a filter', () => {
  const P = load(), scr = P.byId['FAD/document-monitoring'], rows = scr.rows(), all = r => P.applyFilters(scr, rows).map(x => x.id).sort();
  const of = st => rows.filter(r => r.doc_status === st).map(r => r.id);
  P.U(scr.id).applied = { doc_status: ['Complete', 'For Releasing'] };
  assert.deepStrictEqual(all(), [...of('Complete'), ...of('For Releasing')].sort()); assert.ok(all().length > 0, 'not an empty list');
  P.U(scr.id).applied = { doc_status: ['Open', 'Complete'] };
  assert.ok(all().length > rows.filter(r => r.doc_status !== 'Complete').length, 'Open or Complete');
  scr.rows = () => []; P.U(scr.id).applied = { doc_status: [] };
  assert.match(P.dataCard(scr, 'x'), /Nothing is waiting/, 'an empty list is not a filter'); P.U(scr.id).applied = { doc_status: ['Complete'] };
  assert.match(P.dataCard(scr, 'x'), /No records match the filter/);
});
test('Log Activity: the "no activity yet" note works with a picked-value list', () => {
  const P = load(), scr = P.byId['log-activity'];
  P.U(scr.id).applied = { module: ['SMD'] }; assert.match(scr.emptyNote(), /SMD/);
  P.U(scr.id).applied = { module: ['SMD', 'VWD'] }; assert.strictEqual(scr.emptyNote(), null);
});
test('every dropdown panel carries its own Apply filter button, so an open panel never hides the way to apply', () => {
  const P = load();
  for (const id of ['report/cancellation-monitoring', 'FAD/unpaid', 'report/inventory-monitoring']) {
    const scr = P.byId[id], h = P.filterCard(scr), selects = scr.filters.filter(f => f.type === 'select').length, panels = h.split('<div class="msel-p"').slice(1);
    assert.strictEqual(panels.length, selects, id);
    for (const p of panels) {
      const body = p.split('</details>')[0];
      assert.match(body, /<div class="msel-f"><button type="button" class="btn gh" data-act="resetFilter">[^]*Reset<\/button><button type="submit" class="btn pr">[^]*Apply filter<\/button><\/div><\/div>$/, `${id}: the footer (Reset, then Apply) is the last thing inside the panel`);
      assert.ok(body.indexOf('class="msel-f"') > body.lastIndexOf('data-mfilter'), `${id}: below the tick boxes`);
    }
    const form = h.split('<form class="fb" data-form="filter">')[1].split('</form>')[0];
    assert.strictEqual(form.split('class="msel-f"').length - 1, selects, `${id}: the panels sit inside the filter form, so their submit button applies every filter`);
    assert.match(form, /<div class="btns">[^]*Reset[^]*<button type="submit" class="btn pr">[^]*Apply filter<\/button><\/div>$/, `${id}: the form's own Reset and Apply stay`);
  }
  const plain = P.byId['customer-inquiry']; assert.ok(plain.filters.length && !plain.filters.some(f => f.type === 'select')); assert.doesNotMatch(P.filterCard(plain), /msel-f/, 'no dropdown, no panel footer');
});
test('an open dropdown never hides Reset: the panel footer has its own Reset, which runs the same action as the form button', () => {
  const P = load(), scr = P.byId['FAD/unpaid'], h = P.filterCard(scr), form = h.split('<form class="fb" data-form="filter">')[1].split('</form>')[0];
  const resets = form.match(/<button type="button" class="btn gh" data-act="resetFilter">/g) || [];
  assert.strictEqual(resets.length, scr.filters.filter(f => f.type === 'select').length + 1, "one Reset per dropdown panel plus the form's own");
  assert.strictEqual(typeof P.ACTIONS.resetFilter, 'function', 'the click handler finds the action by data-act');
  const foot = form.split('<div class="msel-f">')[1].split('</div>')[0];
  assert.ok(foot.indexOf('resetFilter') > -1 && foot.indexOf('resetFilter') < foot.indexOf('type="submit"'), 'Reset sits before Apply, as in the form');
});
test('after a filter is applied focus goes back to the dropdown the keyboard user was in, else to the form Apply button (not the first submit button, which sits inside a closed dropdown); harmless without a page', () => {
  const P = load(), el = (inside, key) => ({ closest: sel => sel === '[data-msel]' && inside ? { dataset: { msel: key } } : null });
  assert.strictEqual(P.filterFocusKey(el(true, 'seller')), 'seller'); assert.strictEqual(P.filterFocusKey(el(false)), null);
  assert.strictEqual(P.filterFocusKey(null), null); assert.strictEqual(P.filterFocusKey(undefined), null); assert.strictEqual(P.filterFocusKey({}), null, 'a node without closest()');
  const seen = [], mk = name => ({ focus() { seen.push(name); } });
  const root = { querySelector: sel => /data-msel="seller"/.test(sel) && /summary/.test(sel) ? mk('summary') : /card\.filter .btns button\[type="submit"\]/.test(sel) ? mk('apply') : null };
  P.refocusFilter(root, 'seller'); P.refocusFilter(root, null); P.refocusFilter(root, 'gone');
  assert.deepStrictEqual(seen, ['summary', 'apply', 'apply'], "the picked dropdown's button, else Apply (also when that dropdown is gone)");
  P.refocusFilter(null, 'seller'); P.refocusFilter({ querySelector: () => null }, null);   // nothing to focus: no error
});
