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
  assert.match(P.byId['FAD/liability-to-seller'].cols.find(c => c.key === 'total').label, /Security Bond/);
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
