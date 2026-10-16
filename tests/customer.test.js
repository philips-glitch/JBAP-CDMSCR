const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness');
const money = n => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// A buyer with lots from more than one seller, so the per-seller roll-up has several rows
const pickBuyer = P => { const by = {}; P.V().filter(v => v.cid && v.status === 'Sold').forEach(v => (by[v.cid] ||= new Set()).add(v.seller)); return Object.keys(by).find(k => by[k].size >= 2); };

test('Customer Inquiry: one row per Buyer ID from the lots and the cancellations, with the buyer\'s figures', () => {
  const P = load(), scr = P.byId[P.CUST_ID], rows = scr.rows();
  assert.strictEqual(P.CUST_ID, 'customer-inquiry');
  assert.deepStrictEqual([scr.dept, scr.title, scr.actions.join(',')], ['Customer', 'Customer Inquiry', 'View,Filter,Sort']);
  assert.deepStrictEqual(scr.cols.map(c => c.key), ['cid', 'customer', 'email', 'lots', 'total_bought', 'unpaid', 'cancels', 'last_auction']);
  const ids = new Set([...P.S.veh.map(v => v.cid), ...P.S.cancels.map(c => c.cid)].filter(Boolean));
  assert.deepStrictEqual(rows.map(r => r.id).sort(), [...ids].sort(), 'every Buyer ID once, none without an ID');
  const cid = pickBuyer(P), r = rows.find(x => x.cid === cid), sold = P.V().filter(v => v.cid === cid && v.status === 'Sold');
  assert.strictEqual(r.lots, sold.length);
  assert.strictEqual(r.total_bought, Math.round(sold.reduce((a, v) => a + (v.price || 0), 0) * 100) / 100);
  assert.strictEqual(r.unpaid, sold.filter(v => v.awarding && !v.buyer_paid).length);
  assert.strictEqual(r.cancels, P.CX().filter(c => c.cid === cid).length);
  assert.strictEqual(r.last_auction, Math.max(...P.S.veh.filter(v => v.cid === cid).map(v => +v.auction), ...P.S.cancels.filter(c => c.cid === cid).map(c => +c.auction)));
  const cxOnly = rows.find(x => !P.S.veh.some(v => v.cid === x.cid));
  assert.ok(cxOnly && cxOnly.lots === 0 && cxOnly.cancels > 0, 'a buyer known only from a cancellation is listed too');
  assert.strictEqual(scr.totals(rows).customer, `${rows.length} buyers`);
});

test('stepOf: how far a sold lot has got', () => {
  const P = load(), sold = { status: 'Sold', seller: Object.keys(P.SELLER).find(k => P.releaseOf({ seller: k }) === 'ack') };   // released after Seller Acknowledgement
  const at = o => P.stepOf(Object.assign({}, sold, o));
  assert.strictEqual(at({}), 'Pending award');
  assert.strictEqual(at({ awarding: '2026-10-01' }), 'Unpaid');
  assert.strictEqual(at({ awarding: '2026-10-01', buyer_paid: '2026-10-02' }), 'Paid');
  assert.strictEqual(at({ awarding: '2026-10-01', buyer_paid: '2026-10-02', pay_seller: '2026-10-03' }), 'Seller Ack.');
  assert.strictEqual(at({ awarding: '2026-10-01', buyer_paid: '2026-10-02', pay_seller: '2026-10-03', seller_ack: '2026-10-04' }), 'For Dispatch');
  assert.strictEqual(at({ awarding: '2026-10-01', buyer_paid: '2026-10-02', dispatch: '2026-10-05' }), 'Unreleased');
  assert.strictEqual(at({ dispatch: '2026-10-05', release: '2026-10-06' }), 'Released');
  assert.strictEqual(at({ dispatch: '2026-10-05', release: '2026-10-06', release_type: 'Return to Seller' }), 'Returned');
  const payNow = Object.keys(P.SELLER).find(k => P.releaseOf({ seller: k }) === 'payment');
  if (payNow) assert.strictEqual(P.stepOf({ status: 'Sold', seller: payNow, awarding: '2026-10-01', buyer_paid: '2026-10-02' }), 'For Dispatch', 'sellers released on Buyer Payment are ready for dispatch once paid');
});

test('buyerOf: the cards, the per-seller roll-up and the lot lists', () => {
  const P = load(), cid = pickBuyer(P), b = P.buyerOf(cid);
  const sold = P.V().filter(v => v.cid === cid && v.status === 'Sold');
  assert.deepStrictEqual(b.sold.map(v => v.id).sort(), sold.map(v => v.id).sort());
  assert.deepStrictEqual(b.pending.map(v => v.id).sort(), sold.filter(v => !v.awarding).map(v => v.id).sort());
  assert.deepStrictEqual(b.unpaid.map(v => v.id).sort(), sold.filter(v => v.awarding && !v.buyer_paid).map(v => v.id).sort());
  assert.deepStrictEqual(b.cancels.map(c => c.id).sort(), P.CX().filter(c => c.cid === cid).map(c => c.id).sort());
  const keys = b.sold.map(v => [+v.auction, v.lot]);
  assert.deepStrictEqual(keys, [...keys].sort((x, y) => y[0] - x[0] || x[1].localeCompare(y[1])), 'newest auction first, then lot');
  assert.ok(b.sold.every(v => v.step === P.stepOf(v) && typeof v.amonth === 'string'));
  assert.strictEqual(b.sellers.reduce((a, s) => a + s.units, 0), sold.length);
  assert.strictEqual(Math.round(b.sellers.reduce((a, s) => a + s.amount, 0) * 100), Math.round(sold.reduce((a, v) => a + (v.price || 0), 0) * 100));
  for (const s of b.sellers) {
    const mine = sold.filter(v => v.seller === s.seller);
    assert.deepStrictEqual([s.units, s.unpaid, s.last, s.seller_full], [mine.length, mine.filter(v => v.awarding && !v.buyer_paid).length, Math.max(...mine.map(v => +v.auction)), P.SELLER[s.seller]?.name || s.seller]);
  }
  assert.strictEqual(P.buyerOf('NO-SUCH-ID'), null);
});

test('custRoute reads #/customer/<Buyer ID>[/<list>]; other hashes are not customer pages', () => {
  const P = load();
  assert.deepStrictEqual(P.custRoute('customer/B0313'), { cid: 'B0313', tab: 'sold' });
  assert.deepStrictEqual(P.custRoute('customer/B0313/unpaid'), { cid: 'B0313', tab: 'unpaid' });
  assert.deepStrictEqual(P.custRoute('customer/B0313/nonsense'), { cid: 'B0313', tab: 'sold' });
  assert.strictEqual(P.custRoute('customer-inquiry'), null);
  assert.strictEqual(P.custRoute('FAD/unpaid'), null);
});

test('customer page: Customer Information is disabled, Transaction History shows the cards, sellers and lot lists', () => {
  const P = load(), cid = pickBuyer(P), b = P.buyerOf(cid), html = P.customerPage(cid, 'sold');
  assert.ok(html.includes(`${cid} · ${b.name}`), 'header with Buyer ID and name');
  assert.match(html, /class="tab is-disabled"[^>]*aria-disabled="true"[^>]*>Customer Information/);
  assert.match(html, /<a [^>]*class="tab is-active"[^>]*aria-current="page"[^>]*>Customer Transaction History/);
  for (const k of ['Lots bought', 'Total bought (PHP)', 'Pending awarding', 'Unpaid', 'Cancellations']) assert.ok(html.includes(`>${k}<`), k);
  assert.ok(html.includes(money(b.sold.reduce((a, v) => a + (v.price || 0), 0))), 'total bought');
  for (const h of ['Seller', 'Seller Name', 'Units Bought', 'Total Amount (PHP)', 'Unpaid Units', 'Last Auction']) assert.ok(html.includes(`>${h}<`), h);
  for (const [slug, label, n] of [['sold', 'Sold', b.sold.length], ['pending-awarding', 'Pending Awarding', b.pending.length], ['unpaid', 'Unpaid', b.unpaid.length], ['cancellation', 'Cancellation', b.cancels.length]])
    assert.match(html, new RegExp(`href="#/customer/${cid}${slug === 'sold' ? '' : '/' + slug}"[^>]*>${label}<span class="cnt">${n}</span>`), slug);
  assert.doesNotMatch(html, /Sales Actions/, 'no Sales Actions tab');
  for (const h of ['Auction Month', 'Auction No.', 'Lot', 'Plate', 'Make/Model', 'Result Price', 'Notarial', 'Commission', 'Total', 'Step']) assert.ok(html.includes(`>${h}<`), h);
  const lotTable = html.slice(html.indexOf('aria-label="Lot lists"'));
  assert.strictEqual((lotTable.match(/<tr data-lot=/g) || []).length, b.sold.length, 'one row per sold lot');
  assert.match(lotTable, new RegExp(`<tfoot><tr><td[^>]*>Total \\(${b.sold.length}\\)</td>`));
  const cx = P.customerPage(cid, 'cancellation').slice(html.indexOf('aria-label="Lot lists"'));
  for (const h of ['Date Cancelled', 'Waived?', 'Penalty', 'Billing Date', 'Paid Date']) assert.ok(cx.includes(`>${h}<`), h);
  assert.match(P.customerPage('NO-SUCH-ID', 'sold'), /No buyer with Buyer ID NO-SUCH-ID/);
});

test('buyer names and Buyer IDs link to the customer page when the lot has a Buyer ID', () => {
  const P = load(), up = P.byId['FAD/unpaid'], r = up.rows().find(x => x.cid);
  const name = P.cellHtml(up, r, up.cols.find(c => c.key === 'customer'), false), id = P.cellHtml(up, r, up.cols.find(c => c.key === 'cid'), false);
  assert.ok(name.includes(`<a class="blink" href="#/customer/${r.cid}">`), name);
  assert.ok(id.includes(`<a class="blink" href="#/customer/${r.cid}">${r.cid}</a>`), id);
  const plain = P.cellHtml(up, Object.assign({}, r, { cid: '' }), up.cols.find(c => c.key === 'customer'), false);
  assert.doesNotMatch(plain, /blink/, 'no Buyer ID: plain text');
  const unknown = P.cellHtml(up, Object.assign({}, r, { cid: 'NO-SUCH-ID' }), up.cols.find(c => c.key === 'customer'), false);
  assert.doesNotMatch(unknown, /blink/, 'unknown Buyer ID: plain text');
});

test('sidebar: Customer is active with Customer Inquiry; Sales Actions stays disabled', () => {
  const P = load(), side = P.sideHtml('customer-inquiry');
  assert.match(side, /data-group="Customer"/);
  assert.match(side, /<a class="mis is-active" href="#\/customer-inquiry" aria-current="page">Customer Inquiry<span class="cnt">\d+<\/span><\/a>/);
  assert.match(side, /data-disabled="Sales Actions"/);
  assert.doesNotMatch(side, /data-disabled="Customer"/, 'Customer is no longer a disabled menu');
  assert.match(P.sideHtml('customer/B0313'), /<a class="mis is-active" href="#\/customer-inquiry" aria-current="page">/, 'a customer page keeps Customer Inquiry highlighted');
  assert.match(P.pageHead(P.byId[P.CUST_ID]), /Home<\/a>›<span>Customer<\/span>›<b>Customer Inquiry<\/b>/);
});
