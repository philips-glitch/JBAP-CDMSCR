const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness');
// Reads a STORE-method zip (what xlsx.js writes) into { name: text }
const unzip = bytes => {
  const b = Buffer.from(bytes), files = {}; let p = 0;
  while (b.readUInt32LE(p) === 0x04034b50) {
    const size = b.readUInt32LE(p + 18), n = b.readUInt16LE(p + 26), name = b.toString('utf8', p + 30, p + 30 + n);
    files[name] = b.toString('utf8', p + 30 + n, p + 30 + n + size); p += 30 + n + size;
  }
  return files;
};
const cellText = (xml, ref) => { const m = xml.match(new RegExp(`<c r="${ref}"[^>]*>(.*?)</c>`)); return m ? m[1] : null; };
test('FAD Rebate Monitoring has a Download report button, shown although the screen is view-only; SMD (view only) has none', () => {
  const P = load(), fad = P.byId['FAD/rebate-monitoring'];
  assert.ok(!fad.actions.includes('Update'));
  assert.deepStrictEqual(fad.buttons.map(b => [b.act, b.view]), [['downloadRebate', true]]);
  assert.match(P.dataCard(fad, 'Rebate Monitoring list'), /data-act="downloadRebate"/);
  assert.ok(!(P.byId['SMD/rebate-monitoring'].buttons || []).length);
  assert.doesNotMatch(P.dataCard(P.byId['report/result-summary'], 'x'), /data-act=/, 'other view-only screens still show no buttons');
});
test('rebateRecord: one row per lot, with the derived columns', () => {
  const P = load(), v = P.byId['FAD/rebate-monitoring'].rows().find(r => r.price && r.rebate && r.model && r.model.includes(' '));
  const x = P.rebateRecord(v);
  assert.strictEqual(x.minBid, v.price); assert.strictEqual(x.awarded, v.price);
  assert.strictEqual(x.highestOffer, v.price - v.rebate);
  assert.strictEqual(x.revenue, Math.round((v.com - v.rebate) * 100) / 100);
  assert.strictEqual(x.commission, v.com);
  assert.strictEqual(x.brand + ' ' + x.model, v.model);
  assert.strictEqual(x.month, ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][+v.auction_start.slice(5, 7) - 1]);
  assert.deepStrictEqual([x.auction, x.lot, x.vcn, x.seller, x.cid, x.buyer, x.rebate, x.remitted], [Number(v.auction), v.lot, v.vcn, v.seller_full, v.cid, v.customer, v.rebate, v.rebate_paid || null]);
  const blank = P.rebateRecord(Object.assign({}, v, { price: null, com: null }));
  assert.deepStrictEqual([blank.minBid, blank.highestOffer, blank.awarded, blank.revenue], [null, null, null, null]);
});
test('rebateLotsIn keeps the lots of the auction range, both ends included', () => {
  const P = load(), lots = P.byId['FAD/rebate-monitoring'].rows(), auctions = [...new Set(lots.map(v => Number(v.auction)))].sort((a, b) => a - b);
  assert.ok(auctions.length >= 2);
  const [a, b] = [auctions[0], auctions[1]];
  assert.deepStrictEqual(P.rebateLotsIn(lots, a, b).map(v => v.id).sort(), lots.filter(v => +v.auction === a || +v.auction === b).map(v => v.id).sort());
  assert.strictEqual(P.rebateLotsIn(lots, b, a).length, 0);
});
test('rebate workbook: a valid .xlsx with title, headers, one row per lot and SUM totals', () => {
  const P = load(), lots = P.byId['FAD/rebate-monitoring'].rows(), auctions = [...new Set(lots.map(v => Number(v.auction)))].sort((a, b) => a - b);
  const from = auctions[0], to = auctions.at(-1), bytes = P.REPORTS.rebateWorkbook(lots, from, to), files = unzip(bytes);
  assert.strictEqual(Buffer.from(bytes).toString('latin1', 0, 2), 'PK');
  for (const f of ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml']) assert.ok(files[f], f);
  assert.match(files['xl/workbook.xml'], /<sheet name="Rebate Monitoring"/);
  const sh = files['xl/worksheets/sheet1.xml'];
  assert.match(cellText(sh, 'A1'), new RegExp(`Auctions ${from} to ${to}`));
  const heads = ['Month', 'Auction No.', 'Lot', 'VCN', 'Year', 'Brand', 'Model', 'Color', 'Seller', 'Minimum Bid', 'Highest Offer', 'Awarded Price', 'Buyer ID', 'Buyer', 'Rebate', 'Date Remitted to Buyer', 'Commission', 'Revenue (Net of Rebate)'];
  heads.forEach((h, i) => assert.ok(cellText(sh, `${P.XLSX.colName(i)}4`).includes(`>${h}<`), h));
  const first = 5, last = first + lots.length - 1;
  assert.strictEqual((sh.match(/<row r=/g) || []).length, 4 + lots.length + 1, 'title, note, blank, header, one row per lot, total');
  assert.match(cellText(sh, `A${last + 1}`), /Total/);
  const sum = k => Math.round(lots.reduce((a, v) => a + (Number(P.rebateRecord(v)[k]) || 0), 0) * 100) / 100;
  for (const [col, k] of [['O', 'rebate'], ['Q', 'commission'], ['R', 'revenue']]) {
    const c = cellText(sh, `${col}${last + 1}`);
    assert.match(c, new RegExp(`<f>SUM\\(${col}${first}:${col}${last}\\)</f>`), col);
    assert.strictEqual(Math.round(Number(c.match(/<v>([^<]*)<\/v>/)[1]) * 100) / 100, sum(k), `${col} cached total`);
  }
  assert.match(sh, /<pane ySplit="4"/); assert.match(sh, new RegExp(`<autoFilter ref="A4:R${last}"/>`));
});
test('rebate workbook escapes text and writes dates as Excel dates', () => {
  const P = load(), v = P.byId['FAD/rebate-monitoring'].rows()[0];
  const lot = Object.assign({}, v, { customer: 'A & B <Motors>', rebate_paid: '2026-10-08' });
  const sh = unzip(P.REPORTS.rebateWorkbook([lot], +v.auction, +v.auction))['xl/worksheets/sheet1.xml'];
  assert.ok(sh.includes('A &amp; B &lt;Motors&gt;')); assert.ok(!sh.includes('A & B <Motors>'));
  assert.match(cellText(sh, 'P5'), /<v>46303<\/v>/, '08/10/2026 is Excel day 46303');
  assert.strictEqual(P.XLSX.serial('2026-10-08'), 46303); assert.deepStrictEqual([0, 25, 26, 27].map(P.XLSX.colName), ['A', 'Z', 'AA', 'AB']);
});
test('FAD Rebate Monitoring shows the key report columns with totals; SMD shows the same columns (20 Oct 2026)', () => {
  const P = load(), scr = P.byId['FAD/rebate-monitoring'], rows = scr.rows();
  assert.deepStrictEqual(scr.cols.map(c => c.label), ['Auction No.', 'Lot', 'Plate Number', 'Make/Model', 'Seller', 'Buyer', 'Minimum Bid', 'Highest Offer', 'Rebate', 'Rebate Approved (President)', 'Commission', 'Revenue (Net of Rebate)', 'Date Remitted']);
  assert.deepStrictEqual(P.byId['SMD/rebate-monitoring'].cols.map(c => c.key), scr.cols.map(c => c.key));
  const v = rows.find(r => r.price && r.com), x = P.rebateRecord(v);
  assert.deepStrictEqual([v.min_bid, v.highest_offer, v.rebate_revenue], [x.minBid, x.highestOffer, x.revenue], 'screen and download agree');
  assert.strictEqual(v.highest_offer, Math.round((v.price - v.rebate) * 100) / 100);
  const noPrice = rows.find(r => r.price === null || r.price === undefined);
  if (noPrice) assert.deepStrictEqual([noPrice.min_bid, noPrice.highest_offer], [null, null], 'no price: blank, not 0');
  const t = scr.totals(rows), fmt = n => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  assert.strictEqual(t.plate, `${rows.length} lots`);
  assert.strictEqual(t.rebate, fmt(rows.reduce((a, r) => a + (r.rebate || 0), 0)));
  assert.strictEqual(t.rebate_revenue, fmt(rows.reduce((a, r) => a + (Number(r.rebate_revenue) || 0), 0)));
});
