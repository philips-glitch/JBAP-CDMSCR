const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path');
const { load } = require('./harness');
// Columns (key, * = editable) and buttons of every screen on step1-step3-rules-reports @ 8a0b743, updated for JBAP's feedback of 15 Oct 2026. With the switch off they must not change.
const BASE = {"FAD/result-summary":{"cols":"auction,units,total,avg,comm,rebates,month","btns":""},"FAD/auction-monitoring":{"cols":"auction,lot,plate,customer,seller,status,price,awarding,buyer_paid,pay_seller,seller_ack,dispatch,release,rcv_doas,buyer_doas,seller_doas,orig_docs,to_buyer","btns":""},"FAD/pending-awarding":{"cols":"auction,lot,customer,for_baaf*,awarding*,rebate,seller,plate,model,price,transfer_fee*,security_bond*","btns":"emailBaaf,save"},"FAD/unpaid":{"cols":"auction,lot,customer,cid,seller,model,plate,total,buyer_paid*,buyer_deadline","btns":"save"},"FAD/payment-seller":{"cols":"seller,customer,adate,plate,total,to_jbap,payable,pay_seller*,pay_deadline,print_seller*","btns":"printSeller,save"},"FAD/seller-acknowledgement":{"cols":"seller_full,customer,cid,plate,seller_ack*,pay_deadline","btns":"save"},"FAD/for-dispatch":{"cols":"seller_full,customer,adate,model,plate,buyer_paid,release_cond,for_dispatch_email*,dispatch*","btns":"emailDispatch,save"},"FAD/document-monitoring":{"cols":"auction,lot,customer,seller,plate,pay_seller,ewb_callout*,ewb_signed*,ewb_place*,rcv_doas*,doas_aging,buyer_doas*,seller_doas*,orig_docs*,to_buyer*,docs_aging,doc_status,doc_remarks*,atf_no,print_doc_trans*","btns":"printDocTrans,save"},"FAD/unreleased-unit":{"cols":"customer,adate,model,plate,location,dispatch_deadline,penalty","btns":""},"FAD/liability-to-seller":{"cols":"seller_full,auction,lot,customer,plate,buyer_paid,pay_deadline,total","btns":""},"FAD/rebate-monitoring":{"cols":"adate,lot,customer,plate,rebate,buyer_paid,rebate_paid","btns":""},"FAD/rebate-payable":{"cols":"adate,lot,customer,rebate,buyer_paid,rebate_paid*","btns":"save"},"FAD/billing-monitoring":{"cols":"no,customer,particular,bdate,total,trans,print_trans*","btns":"printTransmittal,save"},"FAD/unpaid-billing":{"cols":"customer,particular,bdate,bill,vat,total,trans,due,pay*,cr*","btns":"save"},"FAD/commission-billing":{"cols":"customer,plate,print_comm*,pay_seller,price,com,cvat,ctotal","btns":"printComm,save"},"FAD/cancellation-monitoring":{"cols":"auction,lot,customer,cid,plate,dcancel,waived,just,remitted","btns":""},"FAD/cancellation-entry":{"cols":"lot,adate,customer,status,dcancel,waived,just,plate","btns":""},"FAD/cancellation-billing":{"cols":"auction,plate,customer,dcancel,penalty,pen_seller,pen_jbap,bill_date,for_print*","btns":"printCancel,save"},"FAD/cancellation-payment":{"cols":"auction,plate,customer,dcancel,bill_date,penalty,pen_seller,pen_jbap,paid_date*,amount*","btns":"save"},"SMD/result-summary":{"cols":"auction,units,total,avg,comm,rebates,month","btns":""},"SMD/auction-monitoring":{"cols":"auction,lot,plate,customer,seller,status,price,awarding,buyer_paid,pay_seller,seller_ack,dispatch,release,rcv_doas,buyer_doas,seller_doas,orig_docs,to_buyer","btns":""},"SMD/pending-awarding":{"cols":"auction,lot,customer,for_baaf,awarding,rebate,seller_full,plate,model,price,tfee","btns":""},"SMD/unpaid":{"cols":"auction,lot,customer,cid,seller,model,plate,total,buyer_paid,buyer_deadline","btns":""},"SMD/seller-acknowledgement":{"cols":"seller_full,customer,cid,plate,seller_ack,pay_deadline","btns":""},"SMD/for-dispatch":{"cols":"seller_full,customer,adate,model,plate,buyer_paid,dispatch","btns":""},"SMD/unreleased-unit":{"cols":"customer,adate,model,plate,dispatch_deadline,penalty","btns":""},"SMD/rebate-monitoring":{"cols":"adate,lot,customer,plate,rebate,buyer_paid,rebate_paid","btns":""},"SMD/cancellation-monitoring":{"cols":"auction,lot,customer,cid,plate,dcancel,waived,just,remitted","btns":""},"VWD/unreleased-unit":{"cols":"customer,auction,model,plate,location,dispatch_deadline,id","btns":""},"VWD/for-dispatch":{"cols":"vcn,plate,auction,customer,seller_full,awarding,buyer_paid,pay_seller,seller_ack","btns":""},"VWD/unreleased-unit-overdue":{"cols":"customer,adate,model,plate,location,dispatch_deadline,penalty,id","btns":""},"VWD/auction-monitoring":{"cols":"auction,lot,plate,customer,seller,status,awarding,buyer_paid,pay_seller,seller_ack,dispatch,release","btns":""},"log-activity":{"cols":"at,user,module,screen,action,record,field,old,new","btns":""}};
test('switch is off by default and can be turned on and off', () => {
  const P = load(); assert.strictEqual(P.isProposed(), false);
  P.setProposed(true); assert.strictEqual(P.isProposed(), true);
  P.setProposed(false); assert.strictEqual(P.isProposed(), false);
});
test('switch off: every base screen shows exactly its base columns and buttons', () => {
  const P = load();
  for (const [id, b] of Object.entries(BASE)) {
    const scr = P.byId[id]; assert.ok(scr, `${id} exists`); assert.ok(P.shown(scr), `${id} visible`);
    assert.strictEqual(P.colsOf(scr).map(c => c.key + (c.edit ? '*' : '')).join(','), b.cols, `${id} columns`);
    assert.strictEqual((scr.buttons || []).filter(P.shown).map(x => x.act).join(','), b.btns, `${id} buttons`);
  }
});
test('tags: "Proposed P#" only with the switch on, "Wish list" always', () => {
  const P = load();
  assert.strictEqual(P.tagHtml({ tag: 'P2' }), ''); assert.match(P.tagHtml({ tag: 'Wish' }), /Wish list/); assert.strictEqual(P.tagHtml({}), '');
  P.setProposed(true); assert.match(P.tagHtml({ tag: 'P2' }), /Proposed P2/);
  assert.ok(P.shown({ proposed: true })); P.setProposed(false); assert.ok(!P.shown({ proposed: true }));
});
test('data-extra.js adds role titles for the new forms', () => {
  const r = load().D.meta.company.roles;
  assert.deepStrictEqual([r.smdStaff, r.smdManager, r.fadManager], ['SMD staff', 'SMD Manager', 'FAD Manager']);
});
test('P1 is withdrawn (JBAP feedback, 15 Oct 2026): Unpaid is the CR screen with the switch on too', () => {
  const P = load(), up = P.byId['FAD/unpaid']; P.setProposed(true);
  assert.strictEqual(P.colsOf(up).map(c => c.key).join(','), 'auction,lot,customer,cid,seller,model,plate,total,buyer_paid,buyer_deadline');
  assert.deepStrictEqual(up.buttons.filter(P.shown).map(b => b.act), ['save']);
  assert.ok(!up.queue && !up.ready && !up.ruleP && !up.saveWarn);
  const src = ['app.js', 'data-extra.js', 'index.html'].map(f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8')).join('\n');
  assert.doesNotMatch(src, /cdmsPaid|cdms_full|cdms_confirm|cdmsPayments|confirmPaid|saveWarn|P1–P6|P1 to P6/);
  assert.deepStrictEqual(P.byId['log-activity'].filters.find(f => f.key === 'action').options(), ['Update', 'Create', 'Cancel']);
});
test('P3: NOAH numbers stay typed until JBAP\'s existing NOAH integration is re-routed to CDMS', () => {
  const P = load(), p3 = P.PROPOSALS.find(p => p[0] === 'P3')[1];
  assert.match(p3, /existing NOAH integration will be re-routed from Access to CDMS/);
  for (const id of ['FAD/payment-seller', 'FAD/unpaid-billing', 'FAD/commission-billing']) assert.match(P.byId[id].ruleP[1], /NOAH integration/, id);
});
