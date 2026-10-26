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
  for (const [slug, label, n] of [['sold', 'Sold', b.sold.length], ['pending-awarding', 'Pending Awarding', b.pending.length], ['unpaid', 'Unpaid', b.unpaid.length], ['vehicle-release', 'Vehicle for release', b.for_release.length], ['pending-doas', 'Pending DOAS signature', b.pending_doas.length], ['docs-release', 'Documents for release', b.docs_release.length], ['cancellation', 'Cancellation', b.cancels.length]])
    assert.match(html, new RegExp(`href="#/customer/${cid}${slug === 'sold' ? '' : '/' + slug}"[^>]*>${label}<span class="cnt">${n}</span>`), slug);   // the New marks of 19 and 20 Oct (Pending DOAS signature, Vehicle for release) are gone since 26 Oct 2026
  assert.doesNotMatch(html, /Sales Actions/, 'no Sales Actions tab');
  for (const h of ['Auction Month', 'Auction No.', 'Lot', 'Plate', 'Make/Model', 'Result Price', 'Notarial', 'Commission', 'Total', 'Step', 'Date of Release / Return']) assert.ok(html.includes(`>${h}<`), h);
  const lotTable = html.slice(html.indexOf('aria-label="Lot lists"'));
  assert.strictEqual((lotTable.match(/<tr data-lot=/g) || []).length, b.sold.length, 'one row per sold lot');
  assert.match(lotTable, new RegExp(`<tfoot><tr><td[^>]*>Total \\(${b.sold.length}\\)</td>`));
  const cx = P.customerPage(cid, 'cancellation').slice(html.indexOf('aria-label="Lot lists"'));
  for (const h of ['Date Cancelled', 'Waived?', 'Penalty', 'Billing Date', 'Paid Date']) assert.ok(cx.includes(`>${h}<`), h);
  assert.match(P.customerPage('NO-SUCH-ID', 'sold'), /No buyer with Buyer ID NO-SUCH-ID/);
});

test('customer page: Pending DOAS signature and Documents for release (JBAP, 16 Oct 2026)', () => {
  const P = load(), all = P.V().filter(v => v.cid && v.status === 'Sold'), cid = all.find(v => v.rcv_doas && !v.buyer_doas && !v.seller_doas)?.cid;
  assert.ok(cid, 'a buyer with a DOAS waiting for signature');
  const b = P.buyerOf(cid), mine = all.filter(v => v.cid === cid);
  assert.ok(b.pending_doas.length > 0 && b.pending_doas.every(v => v.rcv_doas || (v.doas === 'branch' && v.ewb_callout)), 'Receipt of DOAS is filled on every row (EWB: or called out)');
  assert.deepStrictEqual(b.docs_release.map(v => v.id).sort(), mine.filter(v => v.orig_docs && !v.to_buyer).map(v => v.id).sort());
  const h = P.customerPage(cid, 'pending-doas'), t = h.slice(h.indexOf('aria-label="Lot lists"'));
  for (const x of ['Seller Payment', 'Receipt of DOAS', 'EWB Call Out', 'Working Days Since Receipt / Call Out']) assert.ok(t.includes(`>${x}<`), x);
  assert.ok(t.indexOf('>Receipt of DOAS<') < t.indexOf('>EWB Call Out<') && t.indexOf('>EWB Call Out<') < t.indexOf('>Working Days Since Receipt / Call Out<'), 'EWB Call Out sits after Receipt of DOAS');
  assert.strictEqual((t.match(/<tr data-lot=/g) || []).length, b.pending_doas.length);
  assert.match(t, /aria-current="page">Pending DOAS signature<span class="cnt">/);
  const withDocs = all.find(v => v.orig_docs && !v.to_buyer).cid, d = P.customerPage(withDocs, 'docs-release');
  assert.ok(d.includes('>JBAP Receipt of Documents<') && d.includes('>ATF No.<'));
  assert.deepStrictEqual(P.custRoute(`customer/${cid}/docs-release`), { cid, tab: 'docs-release' });
});

test('Pending DOAS signature: a lot whose signed DOAS is back (buyer, seller or EWB branch) is never listed', () => {
  const P = load(), buyers = [...new Set(P.V().filter(v => v.cid && v.status === 'Sold').map(v => v.cid))];
  let listed = 0;
  for (const cid of buyers) for (const v of P.buyerOf(cid).pending_doas) {   // independent of the page rule: check each listed lot against the three ways a signed DOAS comes back
    listed++;
    assert.ok(v.rcv_doas || (v.doas === 'branch' && v.ewb_callout), `${v.id}: Receipt of DOAS filled (EWB: or called out)`);
    assert.ok(!v.buyer_doas, `${v.id}: buyer's signed DOAS not back`);
    assert.ok(!v.seller_doas, `${v.id}: seller's signed DOAS not back`);
    assert.ok(!(v.doas === 'branch' && v.ewb_signed), `${v.id}: not signed at the seller's branch (EWB)`);
  }
  assert.ok(listed > 0, 'some lots are pending');
  // a lot with Receipt of DOAS and the signed DOAS back from the seller is excluded; setting seller_doas on a pending lot drops it
  const back = P.V().find(v => v.cid && v.status === 'Sold' && v.rcv_doas && v.seller_doas && !v.buyer_doas);
  assert.ok(back, 'sample data has a lot whose signed DOAS came back from the seller');
  assert.ok(!P.buyerOf(back.cid).pending_doas.some(v => v.id === back.id), 'seller signed DOAS back: not pending');
  const pend = P.V().find(v => v.cid && v.status === 'Sold' && P.buyerOf(v.cid).pending_doas.some(x => x.id === v.id));
  assert.ok(pend, 'a pending lot');
  pend._raw.seller_doas = P.TODAY;
  assert.ok(!P.buyerOf(pend.cid).pending_doas.some(v => v.id === pend.id), 'seller_doas set on a pending lot: it drops out');
  const hold = P.V().find(v => v.cid && v.status === 'Sold' && v.rcv_doas && !v.buyer_doas && !v.seller_doas && !(v.doas === 'branch' && v.ewb_signed) && v.release);
  assert.ok(hold, 'sample data has a released lot still waiting for the buyer signed DOAS');
  assert.ok(P.buyerOf(hold.cid).pending_doas.some(v => v.id === hold.id), 'a released lot stays in the list');
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

// ─── JBAP 19 Oct 2026 (Q82): EWB lots called out but not signed are waiting too ───
test('Pending DOAS signature includes EWB lots called out but not signed (Q82)', () => {
  const P = load(), all = P.V().filter(v => v.cid && v.status === 'Sold');
  const ewb = all.filter(v => v.doas === 'branch' && v.ewb_callout && !v.ewb_signed && !v.buyer_doas && !v.seller_doas);
  assert.ok(ewb.length >= 1, 'sample EWB lot waiting');
  const b = P.buyerOf(ewb[0].cid); assert.ok(b.pending_doas.some(v => v.id === ewb[0].id));
  const t = P.customerPage(ewb[0].cid, 'pending-doas'); assert.ok(t.includes('>EWB Call Out<'));
  assert.doesNotMatch(t, /EWB Call Out<span class="ptag new"/, 'the 20 Oct New mark on the column is gone');
});

test('Pending DOAS signature: who is listed, and the working days (EWB: from Receipt of DOAS, else from EWB Call Out)', () => {
  const P = load(), sold = P.V().filter(v => v.cid && v.status === 'Sold');
  const ewb = sold.find(v => v.doas === 'branch' && v.ewb_callout && !v.ewb_signed && !v.buyer_doas && !v.seller_doas && !v.rcv_doas);
  assert.ok(ewb, 'sample EWB lot called out, no Receipt of DOAS');
  const row = () => P.buyerOf(ewb.cid).pending_doas.find(v => v.id === ewb.id);
  assert.strictEqual(row().doas_days, P.workdaysBetween(ewb.ewb_callout, P.TODAY), 'no receipt date: counted from EWB Call Out');
  assert.ok(row().doas_days > 0, 'a real number of working days');
  ewb._raw.rcv_doas = '2026-09-30';   // Receipt of DOAS filled as well: it takes over the count
  assert.strictEqual(row().doas_days, P.workdaysBetween('2026-09-30', P.TODAY), 'Receipt of DOAS wins over EWB Call Out');
  delete ewb._raw.rcv_doas;
  // a lot not yet called out and with no receipt is not waiting
  const id = ewb.id, raw = ewb._raw, callout = raw.ewb_callout;
  delete raw.ewb_callout;
  assert.ok(!P.buyerOf(ewb.cid).pending_doas.some(v => v.id === id), 'EWB lot not called out yet: not waiting');
  raw.ewb_callout = callout;
  // every one of the three signed routes takes the called-out EWB lot out of the list
  for (const [k, why] of [['ewb_signed', 'signed at the seller branch'], ['buyer_doas', "JBAP got the buyer's signed DOAS"], ['seller_doas', "the seller's signed DOAS is back"]]) {
    raw[k] = P.TODAY;
    assert.ok(!P.buyerOf(ewb.cid).pending_doas.some(v => v.id === id), `EWB lot ${why}: not waiting`);
    delete raw[k];
  }
  assert.ok(row(), 'back in the list once the dates are cleared');
  // EWB Call Out only counts for sellers who sign at their branch (the same test as Document Monitoring)
  const other = sold.find(v => v.doas !== 'branch' && !v.rcv_doas && !v.buyer_doas && !v.seller_doas);
  assert.ok(other, 'sample lot of a seller who does not sign at a branch, DOAS not received');
  other._raw.ewb_callout = '2026-09-01';
  assert.ok(!P.buyerOf(other.cid).pending_doas.some(v => v.id === other.id), 'a call-out date on a non-EWB lot does not make it wait');
  // the customer page and Document Monitoring agree on which EWB lots are signed: while the documents are not in yet, "Pending Documents" is exactly the signed state
  let checked = 0;
  for (const v of P.V().filter(x => x.doas === 'branch' && x.status === 'Sold' && x.cid && !x.orig_docs && !x.to_buyer)) {
    const signed = !!(v.ewb_signed || v.buyer_doas || v.seller_doas), listed = P.buyerOf(v.cid).pending_doas.some(x => x.id === v.id);
    assert.strictEqual(signed, v.doc_status === 'Pending Documents', `${v.id}: Document Monitoring (${v.doc_status}) agrees on signed`);
    if (signed) assert.ok(!listed, `${v.id}: signed, so not waiting`);
    checked++;
  }
  assert.ok(checked > 10, 'a fair number of EWB lots compared');
});

test('customer page: the New marks of 19 and 20 Oct (Vehicle for release and Pending DOAS signature tabs, EWB Call Out, working days and Date of Release / Return columns) are gone since 26 Oct 2026', () => {
  const P = load(), cid = P.V().find(v => v.doas === 'branch' && v.ewb_callout && !v.ewb_signed && v.cid && v.status === 'Sold').cid;
  for (const tab of ['sold', 'pending-doas']) {   // the tab bar is the same on every list
    const h = P.customerPage(cid, tab), bar = h.slice(h.indexOf('aria-label="Lot lists"'), h.indexOf('</nav>', h.indexOf('aria-label="Lot lists"')));
    assert.match(bar, /Vehicle for release<span class="cnt">\d+<\/span>/, `${tab}: no New mark on Vehicle for release`);
    assert.match(bar, /Pending DOAS signature<span class="cnt">\d+<\/span>/, `${tab}: no New mark on Pending DOAS signature`);
  }
  const t = P.customerPage(cid, 'pending-doas');
  assert.doesNotMatch(t, /<th scope="col"><span class="hb">[^<]*<span class="ptag new"/, 'no New mark on a column head');
  assert.doesNotMatch(P.customerPage(cid, 'docs-release'), /<span class="hb">EWB Call Out/, 'other lists do not get the column');
  assert.match(t, /EWB Call Out[\s\S]*Working Days Since Receipt \/ Call Out/);
  const rule = t.slice(t.indexOf('<p class="rule">'), t.indexOf('</p>', t.indexOf('<p class="rule">')));
  assert.match(rule, /called out/i, 'the page rule says EWB lots count once called out');
  const lot = P.V().find(v => v.cid === cid && v.doas === 'branch' && v.ewb_callout && !v.ewb_signed);
  assert.ok(t.includes(`<td class="">${P.fmtDate(lot.ewb_callout)}</td>`) || t.includes(`>${P.fmtDate(lot.ewb_callout)}<`), 'the call-out date is shown on the lot row');
});
