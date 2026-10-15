const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness');
const P = load(), scr = () => P.byId['FAD/document-monitoring'];
const lot = (seller, f = {}) => Object.assign({ status: 'Sold', seller, buyer_paid: '2026-09-01' }, f);
test('doasOf: seller setting, sellers released on Buyer Payment, default', () => {
  assert.deepStrictEqual(['EWB', 'TFS', 'TFSPH', 'JACCS', 'SBC', undefined].map(s => P.doasOf(lot(s))), ['branch', 'none', 'none', 'jbap', 'jbap', 'jbap']);
});
test('docStatus: the furthest step reached, per DOAS signing type', () => {
  const s = (seller, f) => P.docStatus(lot(seller, f));
  assert.strictEqual(s('SBC', { status: 'Cancelled', to_buyer: '2026-09-20' }), 'Cancelled');
  assert.strictEqual(s('SBC', { orig_docs: '2026-09-15', to_buyer: '2026-09-20' }), 'Complete');
  assert.strictEqual(s('SBC', { orig_docs: '2026-09-15' }), 'For Releasing');
  assert.strictEqual(s('SBC', { seller_doas: '2026-09-10' }), 'Pending Documents', 'signed DOAS back even with no Seller Payment (JBAP sheet: SBC R0 T1 U1)');
  assert.strictEqual(s('SBC', { pay_seller: '2026-09-03', buyer_doas: '2026-09-08' }), 'Pending Documents');
  assert.strictEqual(s('SBC', { pay_seller: '2026-09-03', rcv_doas: '2026-09-05' }), 'DOAS for Signing');
  assert.strictEqual(s('SBC', { pay_seller: '2026-09-03' }), 'Pending DOAS');
  assert.strictEqual(s('SBC', {}), 'Pending Payment');
  assert.strictEqual(s('EWB', { pay_seller: '2026-09-03' }), 'DOAS for Signing', 'EWB buyers sign at EWB once the seller is paid');
  assert.strictEqual(s('EWB', { pay_seller: '2026-09-03', ewb_signed: '2026-09-10' }), 'Pending Documents');
  assert.strictEqual(s('JACCS', { pay_seller: '2026-09-03', ewb_signed: '2026-09-10' }), 'Pending DOAS', 'the EWB date counts only for branch sellers');
  assert.strictEqual(s('TFS', { pay_seller: '2026-09-03' }), 'Pending Documents', 'no DOAS: documents are next once the seller is paid');
  assert.strictEqual(s('TFS', {}), 'Pending Payment');
});
test('workdaysBetween counts Monday to Friday, both days included', () => {
  assert.strictEqual(P.workdaysBetween('2026-10-08', '2026-10-08'), 1, 'Thursday');
  assert.strictEqual(P.workdaysBetween('2026-10-02', '2026-10-08'), 5, 'Fri, Mon, Tue, Wed, Thu');
  assert.strictEqual(P.workdaysBetween('2026-10-03', '2026-10-04'), 0, 'weekend');
  assert.strictEqual(P.workdaysBetween(null, '2026-10-08'), null); assert.strictEqual(P.workdaysBetween('2026-10-09', '2026-10-08'), null);
});
test('aging counts working days to the demo day while a step waits, blank once done', () => {
  const v = (seller, f) => P.enrichV(lot(seller, f));
  assert.strictEqual(v('SBC', { pay_seller: '2026-10-02' }).doas_aging, 5, 'Pending DOAS');
  assert.strictEqual(v('SBC', { pay_seller: '2026-10-02', rcv_doas: '2026-10-05' }).doas_aging, null, 'DOAS received');
  assert.strictEqual(v('EWB', { pay_seller: '2026-10-02' }).doas_aging, 5, 'EWB: until the DOAS is signed');
  assert.strictEqual(v('EWB', { pay_seller: '2026-10-02', ewb_signed: '2026-10-06' }).doas_aging, null);
  assert.strictEqual(v('TFS', { pay_seller: '2026-10-02' }).doas_aging, null, 'no DOAS');
  assert.strictEqual(v('SBC', { pay_seller: '2026-09-01', seller_doas: '2026-10-02' }).docs_aging, 5);
  assert.strictEqual(v('EWB', { pay_seller: '2026-09-01', ewb_signed: '2026-10-02' }).docs_aging, 5);
  assert.strictEqual(v('TFS', { pay_seller: '2026-10-02' }).docs_aging, 5, 'TFS: from Seller Payment');
  assert.strictEqual(v('SBC', { buyer_doas: '2026-10-02' }).docs_aging, null, 'no start date: blank, not 33,000 days');
  assert.strictEqual(v('SBC', { pay_seller: '2026-09-01', seller_doas: '2026-10-02', orig_docs: '2026-10-05' }).docs_aging, null, 'documents received');
});
test('validation: order, Buyer Paid, future; EWB and DOAS columns only where they apply', () => {
  const r = P.enrichV(lot('SBC', { buyer_paid: '2026-09-20' })), ewb = P.enrichV(lot('EWB', { buyer_paid: '2026-09-20' })), tfs = P.enrichV(lot('TFS', { buyer_paid: '2026-09-20' }));
  assert.match(P.docValidate(r, { buyer_doas: '2026-09-22', rcv_doas: '2026-09-25' }).buyer_doas, /Receipt of DOAS/);
  assert.match(P.docValidate(r, { rcv_doas: '2026-09-10' }).rcv_doas, /Buyer Paid/);
  assert.match(P.docValidate(r, { orig_docs: '2026-12-01' }).orig_docs, /after today/);
  assert.match(P.docValidate(r, { orig_docs: '2026-09-30', to_buyer: '2026-09-25' }).to_buyer, /JBAP Receipt of Documents/);
  assert.match(P.docValidate(r, { rcv_doas: '2026-10-05', seller_doas: '2026-10-01' }).seller_doas || '', /Receipt of DOAS/);
  assert.deepStrictEqual(Object.values(P.docValidate(r, { rcv_doas: '2026-09-21', buyer_doas: '2026-09-22', seller_doas: '2026-09-23' })).filter(Boolean), []);
  assert.match(P.docValidate(ewb, { ewb_callout: '2026-09-25', ewb_signed: '2026-09-24' }).ewb_signed, /EWB Call Out/);
  assert.deepStrictEqual(Object.values(P.docValidate(ewb, { ewb_callout: '2026-09-24', ewb_signed: '2026-09-25', ewb_place: 'HO' })).filter(Boolean), []);
  assert.match(P.docValidate(r, { ewb_place: 'HO' }).ewb_place, /branch/);
  assert.match(P.docValidate(tfs, { rcv_doas: '2026-09-25' }).rcv_doas, /no DOAS/);
});
test('rows: every sold or cancelled lot, TFS included; the Open view hides Complete and Cancelled', () => {
  const s = scr(), rows = s.rows(), f = s.filters.find(x => x.key === 'doc_status');
  assert.strictEqual(rows.length, P.V().filter(v => ['Sold', 'Cancelled'].includes(v.status)).length);
  assert.ok(rows.some(r => r.seller === 'TFS') && rows.some(r => r.status === 'Cancelled'));
  assert.deepStrictEqual(s.initial, { doc_status: 'Open' });
  assert.ok(P.applyFilters(s, rows).every(r => !['Complete', 'Cancelled'].includes(r.doc_status)), 'Open view');
  assert.ok(rows.filter(r => f.match(r, 'Cancelled')).every(r => r.doc_status === 'Cancelled'));
  assert.deepStrictEqual(f.options(), ['Open', 'Pending Payment', 'Pending DOAS', 'DOAS for Signing', 'Pending Documents', 'For Releasing', 'Complete', 'Cancelled']);
});
test('JBAP column order, the editable fields and n/a cells', () => {
  const s = scr();
  assert.deepStrictEqual(s.cols.map(c => c.label).slice(5, 18), ['Seller Payment', 'EWB Call Out', 'Date DOAS Signed (EWB)', 'EWB HO/Store', 'Receipt of DOAS', 'DOAS Aging',
    'JBAP Receipt of Signed DOAS', 'Seller Receipt of Signed DOAS', 'JBAP Receipt of Documents', 'Buyer Receipt of Documents', 'Docs Aging', 'Status', 'Remarks']);
  assert.deepStrictEqual(s.cols.filter(c => c.edit && c.edit !== 'check').map(c => c.key), ['ewb_callout', 'ewb_signed', 'ewb_place', 'rcv_doas', 'buyer_doas', 'seller_doas', 'orig_docs', 'to_buyer', 'doc_remarks']);
  const col = k => s.cols.find(c => c.key === k), sbc = P.enrichV(lot('SBC')), ewb = P.enrichV(lot('EWB')), tfs = P.enrichV(lot('TFS'));
  assert.ok(col('ewb_signed').na(sbc) && !col('ewb_signed').na(ewb));
  assert.ok(col('rcv_doas').na(tfs) && !col('rcv_doas').na(sbc) && col('doas_aging').na(tfs));
  const h = P.cellHtml(s, sbc, col('ewb_signed'), true); assert.match(h, /n\/a/); assert.doesNotMatch(h, /<input/);
  assert.match(P.cellHtml(s, ewb, col('ewb_signed'), true), /<input type="date"/);
});
test('VWD release: an EWB lot signed at EWB counts as signed', () => {
  assert.strictEqual(P.releaseBlock(P.enrichV(lot('EWB', { ewb_signed: '2026-09-10' }))), null);
  assert.match(P.releaseBlock(P.enrichV(lot('EWB'))), /JBAP Receipt of Signed DOAS is missing/);
});
