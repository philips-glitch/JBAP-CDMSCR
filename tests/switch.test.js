const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path');
const { load } = require('./harness');
// Columns (key, * = editable) and buttons of every screen on step1-step3-rules-reports @ 8a0b743, updated for JBAP's feedback of 15 Oct 2026 the rebate report download and Customer Inquiry (16 Oct); JBAP feedback round 2 (16 Oct 2026), the rebate approval column (Q5) and the SAAF standard (Q11, 20 Oct 2026: SMD/saaf and Seller Approved now show with the switch off) and Rebate Payable moved to SMD with SMD's Rebate Monitoring on the live list (20 Oct 2026). JBAP feedback of 26 Oct 2026: Cancellation Entry removed, SMD › Result Price added; Approval › Rebate Approval added and Pending Awarding shows the approved rebate and its status (the editable rebate columns are gone). With the switch off they must not change.
const BASE = {"SMD/saaf":{"cols":"seller,auction,lot,plate,model,price,for_saaf*,saaf_sent,saaf_approved*","btns":"emailSaaf,save"},"FAD/pending-awarding":{"cols":"auction,lot,customer,for_baaf*,saaf_approved,awarding*,rebate_ok,rebate_status,seller,plate,model,price,transfer_fee,security_bond*","btns":"emailBaaf,save"},"FAD/unpaid":{"cols":"auction,lot,customer,cid,seller,model,plate,total,buyer_paid*,buyer_deadline","btns":"save"},"FAD/payment-seller":{"cols":"seller,customer,auction,plate,total,to_jbap,payable,pay_seller*,pay_deadline,print_seller*","btns":"printSeller,save"},"FAD/seller-acknowledgement":{"cols":"seller,customer,cid,plate,seller_ack*,pay_deadline","btns":"save"},"FAD/for-dispatch":{"cols":"seller,customer,auction,model,plate,buyer_paid,release_cond,for_dispatch_email*,dispatch*","btns":"emailDispatch,save"},"FAD/document-monitoring":{"cols":"auction,lot,customer,seller,plate,pay_seller,ewb_callout*,ewb_signed*,ewb_place*,rcv_doas*,doas_aging,buyer_doas*,seller_doas*,orig_docs*,to_buyer*,docs_aging,doc_status,doc_remarks*,atf_no,print_doc_trans*,change_date","btns":"printDocTrans,save"},"FAD/unreleased-unit":{"cols":"customer,auction,model,plate,location,dispatch_deadline,penalty,penalty_paid,id,extend","btns":""},"report/liability-to-seller":{"cols":"seller,auction,lot,customer,plate,buyer_paid,pay_deadline,total","btns":""},"report/rebate-monitoring":{"cols":"auction,lot,plate,model,seller,customer,min_bid,highest_offer,rebate,rebate_approved,com,rebate_revenue,rebate_paid","btns":"downloadRebate"},"FAD/rebate-payable":{"cols":"adate,lot,customer,rebate,buyer_paid,rebate_paid*","btns":"save"},"FAD/billing-monitoring":{"cols":"no,customer,particular,bdate,total,trans,print_trans*","btns":"printTransmittal,save"},"FAD/unpaid-billing":{"cols":"customer,particular,bdate,bill,vat,total,trans,due,pay*,cr*","btns":"save"},"FAD/commission-billing":{"cols":"customer,seller,auction,adate,plate,print_comm*,pay_seller,price,com,cvat,ctotal","btns":"printComm,save"},"FAD/cancellation-billing":{"cols":"auction,plate,customer,dcancel,penalty,pen_seller,pen_jbap,for_print*,bill_date,paid_date*,amount*","btns":"printCancel,save"},"SMD/result-price":{"cols":"auction,lot,plate,model,seller,customer,price,rebate*,rebate_status,awarding,cancel","btns":"save"},"approval/rebate-approval":{"cols":"auction,lot,plate,model,seller,customer,price,rebate,rebate_requested,rebate_status,rebate_decided,rebate_reject_reason,approve,reject","btns":""},"SMD/pending-awarding":{"cols":"auction,lot,customer,for_baaf,awarding,rebate,seller,plate,model,price,tfee","btns":""},"SMD/unpaid":{"cols":"auction,lot,customer,cid,seller,model,plate,total,buyer_paid,buyer_deadline","btns":""},"SMD/seller-acknowledgement":{"cols":"seller,customer,cid,plate,seller_ack,pay_deadline","btns":""},"SMD/for-dispatch":{"cols":"seller,customer,auction,model,plate,buyer_paid,dispatch","btns":""},"SMD/unreleased-unit":{"cols":"customer,auction,model,plate,location,dispatch_deadline,penalty,penalty_paid","btns":""},"VWD/unreleased-unit":{"cols":"customer,auction,model,plate,location,dispatch_deadline,id","btns":""},"VWD/for-dispatch":{"cols":"vcn,plate,auction,customer,seller,awarding,buyer_paid,pay_seller,seller_ack","btns":""},"VWD/unreleased-unit-overdue":{"cols":"customer,auction,model,plate,location,dispatch_deadline,penalty,id","btns":""},"report/result-summary":{"cols":"auction,units,total,avg,comm,rebates,month","btns":""},"report/auction-monitoring":{"cols":"auction,lot,plate,customer,seller,status,price,awarding,buyer_paid,pay_seller,seller_ack,dispatch,release,rcv_doas,buyer_doas,seller_doas,orig_docs,to_buyer","btns":""},"customer-inquiry":{"cols":"cid,customer,email,lots,total_bought,unpaid,cancels,last_auction","btns":""},"log-activity":{"cols":"at,user,module,screen,action,record,field,old,new","btns":""}};
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
  assert.deepStrictEqual(P.byId['log-activity'].filters.find(f => f.key === 'action').options(), ['Update', 'Create', 'Cancel', 'Delete']);   // Delete: a holiday removed in Settings (20 Oct 2026)
});
test('P3: NOAH numbers stay typed until JBAP\'s existing NOAH integration is re-routed to CDMS', () => {
  const P = load(), p3 = P.PROPOSALS.find(p => p[0] === 'P3')[1];
  assert.match(p3, /existing NOAH integration will be re-routed from Access to CDMS/);
  for (const id of ['FAD/payment-seller', 'FAD/unpaid-billing', 'FAD/commission-billing']) assert.match(P.byId[id].ruleP[1], /NOAH integration/, id);
});
