const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness');
const fmt = n => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
test('bondOf: the lot amount, else the seller setting ([MOCK] INSPIRO, ORICO, ASIALINK), else 0', () => {
  const P = load();
  assert.deepStrictEqual(['INSPIRO', 'ORICO', 'ASIALINK', 'EWB'].map(s => P.bondOf({ seller: s })), [20000, 20000, 20000, 0]);
  assert.strictEqual(P.bondOf({ seller: 'ORICO', security_bond: 0 }), 0); assert.strictEqual(P.bondOf({ seller: 'EWB', security_bond: 5000 }), 5000);
});
test('the buyer total and Payable to Seller include the bond', () => {
  const P = load(), v = P.V().find(x => x.id === 'V054'), raw = v._raw;   // ORICO, paid
  assert.strictEqual(v.security_bond, 20000);
  assert.strictEqual(v.total, raw.price + (raw.transfer_fee || 0) + 20000);
  assert.strictEqual(Math.round((v.payable - P.sellerMoney(Object.assign({}, raw, { security_bond: 0 })).payable) * 100) / 100, 20000);
  for (const id of ['FAD/unpaid', 'FAD/payment-seller']) assert.strictEqual(P.byId[id].cols.find(c => c.key === 'total').label, 'Total (Awarded Price + Transfer Fees + Security Bond)', id);
  assert.match(P.byId['report/liability-to-seller'].cols.find(c => c.key === 'total').label, /Security Bond/);
  assert.strictEqual(P.byId['SMD/unpaid'].cols.find(c => c.key === 'total').label, 'Total (Awarded Price + Transfer Fees)', 'SMD Unpaid is the legacy Access snapshot: no bond');
});
test('Pending Awarding: Security Bond is editable, and sending the BAAF keeps it on the lot', () => {
  const P = load(), scr = P.byId['FAD/pending-awarding'];
  assert.strictEqual(scr.cols.find(c => c.key === 'security_bond').edit, 'money');
  assert.match(scr.validate({}, { security_bond: '-1' }).security_bond, /0 or more/);
  const [a, b] = scr.rows().filter(x => x.seller === 'ORICO'), plain = scr.rows().find(x => !P.bondOf(x._raw)), before = P.S.log.length;
  assert.strictEqual(a.security_bond, 20000);
  P.recordAwarding(scr, [a, plain]);
  assert.strictEqual(a._raw.security_bond, 20000); assert.strictEqual(plain._raw.security_bond, undefined, 'no bond: nothing stored');
  const bondLog = P.S.log.slice(before).filter(e => e.field === 'Security Bond');
  assert.deepStrictEqual(bondLog.map(e => [e.old, e.new]), [['', '20,000.00']]);
  P.U(scr.id).edits[b.id] = { security_bond: '0' }; P.recordAwarding(scr, [b]);
  assert.strictEqual(b._raw.security_bond, 0); assert.strictEqual(P.bondOf(b._raw), 0, 'an override to 0 sticks');
});
test('BAAF: a Security Bond column only when a lot has a bond; Payable to Seller puts it under Notarial / Transfer / Bond', () => {
  const P = load(), b = { customer: 'X', cid: 'B1', email: 'x@example.com' }, base = { adate: '', model: 'M', plate: 'P1', year: 2020, price: 100000, transfer_fee: 1000 };
  const without = P.REPORTS.awarding(b, [Object.assign({ security_bond: 0 }, base)], P.TODAY), withBond = P.REPORTS.awarding(b, [Object.assign({ security_bond: 20000 }, base)], P.TODAY);
  assert.doesNotMatch(without, /Security Bond/); assert.match(without, /101,000\.00/);
  assert.match(withBond, /<th class="r">Security Bond<\/th>/); assert.match(withBond, /121,000\.00/); assert.match(withBond, /colspan="7"/);
  const v = P.V().find(x => x.id === 'V054'), h = P.REPORTS.payableToSeller('ORICO', [v], P.TODAY);
  assert.ok(h.includes(`<td class="r">${fmt((v.transfer_fee || 0) + 20000)}</td>`));
});
test('bondStatus: the furthest step reached', () => {
  const P = load(), s = P.bondStatus;
  assert.strictEqual(s({ bond_forfeited: '2026-10-01', bond_refund_jbap: '2026-09-30' }), 'Forfeited');
  assert.strictEqual(s({ bond_refund_buyer: '2026-10-01' }), 'Complete');
  assert.strictEqual(s({ bond_refund_jbap: '2026-10-01' }), 'Pending Refund');
  assert.strictEqual(s({ bond_orcr_seller: '2026-10-01', to_buyer: '2026-09-01' }), 'Pending Refund');
  assert.strictEqual(s({ to_buyer: '2026-09-01' }), 'Waiting ORCR');
  assert.strictEqual(s({}), 'Pending Documents');
});
test('Security Bond screen: paid bond lots, sample statuses, the Open view, shown with the switch off', () => {
  const P = load(), scr = P.byId['FAD/security-bond'], rows = scr.rows(), st = Object.fromEntries(rows.map(r => [r.id, r.bond_status]));
  assert.ok(P.shown(scr)); assert.strictEqual(scr.tag, 'Wish');
  assert.deepStrictEqual(rows.map(r => r.id).sort(), ['V030', 'V050', 'V054', 'V058', 'V063']);
  assert.deepStrictEqual([st.V030, st.V050, st.V054, st.V063], ['Complete', 'Pending Refund', 'Forfeited', 'Pending Documents']);
  assert.deepStrictEqual(scr.initial, { bond_status: 'Open' });
  const open = P.applyFilters(scr, rows).map(r => r.id).sort();
  assert.ok(!open.some(id => ['V030', 'V054'].includes(id)), 'Open hides Complete and Forfeited'); assert.deepStrictEqual(open, ['V050', 'V058', 'V063'], 'Open shows the rest');
  assert.deepStrictEqual(scr.filters[0].options(), ['Open', 'Pending Documents', 'Waiting ORCR', 'Pending Refund', 'Complete', 'Forfeited']);
});
test('Waiting ORCR once the buyer has the documents (Document Monitoring)', () => {
  const P = load(), v = P.S.veh.find(x => x.id === 'V063');
  v.orig_docs = '2026-10-06'; v.to_buyer = '2026-10-07';
  assert.strictEqual(P.byId['FAD/security-bond'].rows().find(r => r.id === 'V063').bond_status, 'Waiting ORCR');
});
test('Refund Via is a select; saving it logs the change', () => {
  const P = load(), scr = P.byId['FAD/security-bond'], col = scr.cols.find(c => c.key === 'bond_refund_via'), r = scr.rows().find(x => x.id === 'V050');
  assert.strictEqual(r._raw.bond_refund_via, undefined, 'a row with no Refund Via yet');
  assert.strictEqual(col.edit, 'select'); assert.deepStrictEqual(col.options, ['Deposit c/o JBAP', 'Cheque', 'Seller deposited to buyer']);
  const h = P.cellHtml(scr, r, col, true); assert.match(h, /<select[^>]*data-key="bond_refund_via"/); assert.match(h, /<option>Cheque<\/option>/);
  const before = P.S.log.length; P.U(scr.id).edits[r.id] = { bond_refund_via: 'Cheque' }; P.applyEdits(scr);
  assert.strictEqual(r._raw.bond_refund_via, 'Cheque');
  assert.deepStrictEqual(P.S.log.slice(before).map(e => [e.screen, e.field, e.new]), [['Security Bond', 'Refund Via', 'Cheque']]);
});
test('Security Bond validation', () => {
  const P = load(), v = { buyer_paid: '2026-09-20' };
  assert.match(P.bondValidate(v, { bond_orcr_jbap: '2026-09-10' }).bond_orcr_jbap, /Buyer Paid/);
  assert.match(P.bondValidate(v, { bond_refund_buyer: '2026-12-01' }).bond_refund_buyer, /after today/);
  assert.match(P.bondValidate(v, { bond_orcr_jbap: '2026-10-01', bond_orcr_seller: '2026-09-30' }).bond_orcr_seller, /JBAP Receipt of Transferred ORCR/);
  assert.match(P.bondValidate(v, { bond_refund_buyer: '2026-10-01', bond_forfeited: '2026-10-02' }).bond_forfeited, /refund/);
  assert.deepStrictEqual(Object.values(P.bondValidate(v, { bond_orcr_jbap: '2026-09-25', bond_orcr_seller: '2026-09-28', bond_refund_jbap: '2026-10-01', bond_refund_buyer: '2026-10-02' })).filter(Boolean), []);
});
test('Access lots keep the amounts Access shows: the sample bond skips V166 (Liability to Seller, INSPIRO)', () => {
  const P = load(), v = P.V().find(x => x.id === 'V166');
  assert.strictEqual(v.security_bond, 0); assert.strictEqual(v.total, 372000);
});
