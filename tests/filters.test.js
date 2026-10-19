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
  P.U(scr.id).applied = { doc_status: ['Complete', 'Cancelled'] };
  assert.ok(P.applyFilters(scr, rows).every(r => ['Complete', 'Cancelled'].includes(r.doc_status)));
});
test('the filter card renders tick boxes for dropdown filters, with the picked values checked', () => {
  const P = load(), scr = P.byId['FAD/unpaid']; P.U(scr.id).filters = { seller: ['EWB'] };
  const h = P.filterCard(scr);
  assert.match(h, /<details class="msel"/); assert.match(h, /data-mfilter="seller" value="EWB" checked/);
  assert.match(h, /<summary class="ctl"[^>]*>EWB</); assert.match(h, /ptag mini new/, 'the filter card is marked New');
});
test('a rule filter with 2 picks gives the rows of both picks, and an empty tick list is not treated as a filter', () => {
  const P = load(), scr = P.byId['FAD/document-monitoring'], rows = scr.rows(), all = r => P.applyFilters(scr, rows).map(x => x.id).sort();
  const of = st => rows.filter(r => r.doc_status === st).map(r => r.id);
  P.U(scr.id).applied = { doc_status: ['Complete', 'Cancelled'] };
  assert.deepStrictEqual(all(), [...of('Complete'), ...of('Cancelled')].sort()); assert.ok(all().length > 0, 'not an empty list');
  P.U(scr.id).applied = { doc_status: ['Open', 'Complete'] };
  assert.ok(all().length > rows.filter(r => !['Complete', 'Cancelled'].includes(r.doc_status)).length, 'Open or Complete');
  scr.rows = () => []; P.U(scr.id).applied = { doc_status: [] };
  assert.match(P.dataCard(scr, 'x'), /Nothing is waiting/, 'an empty list is not a filter'); P.U(scr.id).applied = { doc_status: ['Complete'] };
  assert.match(P.dataCard(scr, 'x'), /No records match the filter/);
});
test('Log Activity: the "no activity yet" note works with a picked-value list', () => {
  const P = load(), scr = P.byId['log-activity'];
  P.U(scr.id).applied = { module: ['SMD'] }; assert.match(scr.emptyNote(), /SMD/);
  P.U(scr.id).applied = { module: ['SMD', 'VWD'] }; assert.strictEqual(scr.emptyNote(), null);
});
