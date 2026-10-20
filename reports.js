'use strict';
/* reports.js — printable reports and email previews laid out like the MS Access samples (spec step 3).
   Uses helpers from app.js (esc, money, fmtDate, toDate, addWorkdays, IC, D, SELLER, CANCEL_PENALTY).
   Every report returns HTML for one or more A4 pages (<section class="rpt">). Role titles and a placeholder bank account, no real names. */
const CO = () => D.meta.company;
const longDate = iso => toDate(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];   // fixed list: toLocaleDateString month names differ per Node/ICU version ("Sept")
const shortDate = iso => { const [y, m, d] = iso.split('-'); return `${d}-${MON[+m - 1]}-${y.slice(2)}`; };
const rptPage = (cls, html) => `<section class="rpt ${cls}">${html}</section>`;
const rptSum = (rows, k) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);
const rptSign = labels => `<div class="rsign">${labels.map(l => `<div>${esc(l)}</div>`).join('')}</div>`;
const rptBank = () => `${esc(CO().name)}<br>${esc(CO().bank)}`;
// Document types of the Access DocumentTransmittalPrint report
const DOC_TYPES = ['LTO Official Receipt', 'LTO Certificate of Registration', 'Deed of Motor Sale', 'Cancellation of Mortgage', 'Release of Mortgage', 'Promissory with Chattel Mortgage',
  'Voluntary surrender with SPA to sell', "Secretary's Certificate with ID", 'ID of Previous owner', 'Certificate of Sale', 'Lease Agreement', 'Car History and Used Car Waiver Form',
  'Extra-Judicial Foreclosure of Chattel', 'LRA - RD Official Receipt', 'Official Receipt representing notarial', 'Service Invoice from the seller', 'Spare Key', 'TPL Insurance Premium', 'Others'];
// [BEHAVIOR] Rebate report (FAD › Rebate Monitoring › Download report), modelled on JBAP's Rebate Monitoring file. CDMS keeps no minimum bid or
// highest offer, so they follow JBAP's file: Minimum Bid = Awarded Price (761 of 810 rows) and Highest Offer = Awarded Price − Rebate (797 of 810 rows).
// Revenue = Commission − Rebate, as in the file; Commission is CDMS's commission for the seller (the file's rate is open, Q63). Same figures as the screen (rebateMoney).
function rebateRecord(v) {
  const has = n => n !== null && n !== undefined && n !== '', words = String(v.model || '').trim().split(/\s+/), m = rebateMoney(v.price, v.rebate, v.com);
  return { month: v.auction_start ? MON[+v.auction_start.slice(5, 7) - 1].toUpperCase() : '', auction: Number(v.auction), lot: v.lot, vcn: v.vcn, year: v.year || null,
    brand: words[0] || '', model: words.slice(1).join(' '), color: v.color || '', seller: v.seller_full, minBid: m.min_bid,
    highestOffer: m.highest_offer, awarded: has(v.price) ? v.price : null, cid: v.cid, buyer: v.customer, rebate: v.rebate,
    remitted: v.rebate_paid || null, commission: has(v.com) ? v.com : null, revenue: m.revenue };
}
const rebateLotsIn = (lots, from, to) => lots.filter(v => +v.auction >= from && +v.auction <= to);
const REPORTS = {
  email({ from, to, cc, subject, body, atts }) {
    return `<article class="mail"><div class="mail-h"><b>From</b><span>${esc(from)}</span><b>To</b><span>${esc(to)}</span>${cc ? `<b>CC</b><span>${esc(cc)}</span>` : ''}<b>Subject</b><span>${esc(subject)}</span>
      <b>Attached</b><span>${atts.map(a => `<button type="button" class="att" data-att="${esc(a.key)}">${IC.clip}${esc(a.name)}</button>`).join(' ')}</span></div><div class="mail-b">${body}</div></article>`;
  },
  // 1. JBAP_AWARDING: Buyer's Winning Bid Confirmation
  awarding(b, lots, award) {
    const due = addWorkdays(award, 3), bond = lots.some(r => r.security_bond > 0), tot = r => r.price + (r.transfer_fee || 0) + (r.security_bond || 0);
    const rows = lots.map(r => `<tr><td>${esc(r.adate)}</td><td>${esc(r.model)}</td><td class="c">${esc(r.plate)}</td><td class="c">${esc(r.year || '')}</td><td class="r">${money(r.price)}</td><td class="r">${money(r.transfer_fee)}</td>${bond ? `<td class="r">${money(r.security_bond || 0)}</td>` : ''}<td class="r">${money(tot(r))}</td></tr>`).join('');
    return rptPage('portrait', `<h1>Buyer's Winning Bid Confirmation</h1>
      <div class="kv"><b>Date awarded</b><span>${longDate(award)}</span><b>Payment deadline</b><span>${longDate(due)}</span>
        <b>Buyer name</b><span>${esc(b.customer)}</span><b>Customer ID</b><span>${esc(b.cid)}</span><b>Email</b><span>${esc(b.email)}</span></div>
      <table><thead><tr><th>Auction Date</th><th>Make / Model</th><th>Plate Number</th><th>Year</th><th class="r">Result Price</th><th class="r">Notarial / Transfer Fee</th>${bond ? '<th class="r">Security Bond</th>' : ''}<th class="r">Total</th></tr></thead><tbody>${rows}</tbody>
      <tfoot><tr><td colspan="${bond ? 7 : 6}">Grand total</td><td class="r">${money(lots.reduce((a, r) => a + tot(r), 0))}</td></tr></tfoot></table>
      <h3>Terms and conditions</h3><p>This is to declare the undersigned Buyer as the official winner of the above-listed vehicles. The Winning Bid Amount is considered as the Vehicle Selling Price of the awarded vehicles. The Buyer fully understands that the full amount of the Vehicle Selling Price and other applicable fees must be settled within three (3) working days from the Winning Bid Confirmation date.</p>
      <h3>Bank account details</h3><p>${rptBank()}<br>Please send the proof of payment to ${esc(CO().emails.finance)}.</p>
      <h3>Penalties</h3><p>A Buyer that fails to make payment on or before the due date shall automatically forfeit the transaction and shall have no further claim as regards the right to purchase the Vehicle/s. Forfeiture of transaction is subject to a penalty of Php ${money(CANCEL_PENALTY)} per vehicle which will be withdrawn from the deposit. In the event that the total penalty exceeds the deposit amount, the outstanding penalty shall be settled within 48 hours from forfeiture. Failure to settle the prescribed penalty fee will result to the Buyer being banned from joining future JBAP Auctions.</p>
      ${rptSign([b.customer, CO().roles.financeHead])}`);
  },
  // 2. qryRebatePrint: Rebate Confirmation (attached to the awarding email)
  rebate(b, lots, payBy) {
    const rows = lots.map(r => `<tr><td>${esc(r.adate)}</td><td class="c">${esc(r.lot)}</td><td>${esc(r.model)}</td><td class="c">${esc(r.year || '')}</td><td class="c">${esc(r.plate)}</td><td class="r">${money(r.price)}</td><td class="r">${money(r.rebate)}</td></tr>`).join('');
    return rptPage('portrait', `<h1>Rebate Confirmation</h1><p>Dear ${esc(b.customer)},</p><p>Good day! We would like to thank you for your continuous support and engagement with JBAP.</p>
      <table><thead><tr><th>Auction Date</th><th>Lot</th><th>Make / Model</th><th>Year</th><th>Plate Number</th><th class="r">Result Price</th><th class="r">Rebate</th></tr></thead><tbody>${rows}</tbody>
      <tfoot><tr><td colspan="6">Grand total</td><td class="r">${money(rptSum(lots, 'rebate'))}</td></tr></tfoot></table>
      <p>You may now settle the total amount indicated in the Buyer's Winning Bid Confirmation sent separately. Once we have confirmed that you have settled the total payment, we will be processing your rebate immediately on the succeeding banking day*.</p>
      <p class="fn">*The timing of the rebate crediting to your account may vary per bank.</p>
      <p>This is a limited offer, and we look forward in releasing your unit! Please be reminded that you can settle via our bank account below on or before ${longDate(payBy)}.</p>
      <p>${rptBank()}<br>Please send your payment confirmation to ${esc(CO().emails.finance)}.</p><p>Regards,</p>`);
  },
  // 3. qryPAYMENTSELLERPrint: Computation of Payable to Seller (one page per seller)
  payableToSeller(code, lots, date) {
    const net = SELLER[code]?.net !== false, m = n => (net ? money(n) : ''), fb = r => (r.transfer_fee || 0) + (r.security_bond || 0);
    const rows = lots.map(r => `<tr><td>${esc(r.adate)}</td><td>${esc(r.customer)}</td><td>${esc(r.model)}</td><td class="c">${esc(r.plate)}</td><td class="r">${money(r.price)}</td><td class="r">${money(fb(r))}</td><td class="r">${m(r.com)}</td><td class="r">${m(r.cvat)}</td><td class="r">${m(r.wtax)}</td><td class="r">${money(r.payable)}</td><td class="r">${money(r.to_jbap)}</td></tr>`).join('');
    return rptPage('landscape', `<h2>${esc(CO().name.toUpperCase())}</h2><h1>Computation of Payable to Seller</h1><p><b>${esc(code)}</b> · ${esc(SELLER[code]?.name || code)}${net ? '' : ' (GROSS seller: commission billed separately)'}</p>
      <table><thead><tr><th>Auction Date</th><th>Customer Name</th><th>Make / Model</th><th>Plate #</th><th class="r">Result Price</th><th class="r">Notarial / Transfer / Bond</th><th class="r">Commission</th><th class="r">VAT</th><th class="r">Tax</th><th class="r">Payable to Seller</th><th class="r">To JBAP</th></tr></thead><tbody>${rows}</tbody>
      <tfoot><tr><td colspan="4">Total</td><td class="r">${money(rptSum(lots, 'price'))}</td><td class="r">${money(lots.reduce((a, r) => a + fb(r), 0))}</td><td class="r">${m(rptSum(lots, 'com'))}</td><td class="r">${m(rptSum(lots, 'cvat'))}</td><td class="r">${m(rptSum(lots, 'wtax'))}</td><td class="r">${money(rptSum(lots, 'payable'))}</td><td class="r">${money(rptSum(lots, 'to_jbap'))}</td></tr></tfoot></table>
      ${rptSign([`Prepared by: ${CO().roles.fadStaff}`, longDate(date)])}`);
  },
  // 4. qryBillingSeller: Billing Computation (attachment to the seller's billing invoice)
  billingComputation(code, billNo, billDate, lots) {
    const rows = lots.map(r => `<tr><td>${esc(r.adate)}</td><td class="c">${esc(r.year || '')}</td><td class="c">${esc(r.plate)}</td><td>${esc(r.model)}</td><td>${esc(r.color || '')}</td><td>${esc(r.customer)}</td><td class="r">${money(r.price)}</td><td class="r">${money(r.com)}</td><td class="r">${money(r.cvat)}</td><td class="r">${money(r.ctotal)}</td></tr>`).join('');
    return rptPage('landscape', `<h2>${esc(CO().name.toUpperCase())}</h2><h1>Billing Computation</h1><p><b>${esc(SELLER[code]?.name || code)}</b></p>
      <div class="kv"><b>Billing date</b><span>${fmtDate(billDate)}</span><b>Billing #</b><span>${esc(billNo)}</span></div>
      <table><thead><tr><th>Auction Date</th><th>Year</th><th>Plate Number</th><th>Make / Model</th><th>Color</th><th>Customer Name</th><th class="r">Bid Price</th><th class="r">Commission</th><th class="r">VAT</th><th class="r">Total</th></tr></thead><tbody>${rows}</tbody>
      <tfoot><tr><td colspan="6">Grand total</td><td class="r">${money(rptSum(lots, 'price'))}</td><td class="r">${money(rptSum(lots, 'com'))}</td><td class="r">${money(rptSum(lots, 'cvat'))}</td><td class="r">${money(rptSum(lots, 'ctotal'))}</td></tr></tfoot></table>
      ${rptSign([`Prepared by: ${CO().roles.fadStaff}`, `Approved by: ${CO().roles.financeHead}`])}<p class="fn">${longDate(billDate)}</p>`);
  },
  // 5. BILLING TRANSMITTAL: Transmittal of Documents (attached to the printed invoices sent to the seller)
  billingTransmittal(customer, bills, date) {
    const rows = bills.map(b => `<tr><td>${esc(b.customer)}</td><td>${esc(b.cr || '')}</td><td>${esc(b.particular)}</td><td class="c">${esc(b.no)}</td><td class="r">${money(b.total)}</td><td class="c">${fmtDate(b.due)}</td></tr>`).join('');
    return rptPage('portrait', `<h1>Transmittal of Documents</h1><div class="kv"><b>Date</b><span>${longDate(date)}</span></div>
      <table><thead><tr><th>Customer</th><th>CR</th><th>Auction Date / Particulars</th><th>Billing #</th><th class="r">Bill Amount</th><th>Due Date</th></tr></thead><tbody>${rows}</tbody>
      <tfoot><tr><td colspan="4">Total</td><td class="r">${money(rptSum(bills, 'total'))}</td><td></td></tr></tfoot></table>
      ${rptSign(['Received by', 'Date received'])}`);
  },
  // 6. VEHICLE_DISPATCH: Vehicle Dispatch Clearance Form (attached to the "JBAP VEHICLE FOR RELEASE" email)
  dispatchForm(b, lots, issued) {
    const rows = lots.map(r => `<tr><td class="c">${esc(r.seller)}</td><td class="c">${esc(r.auction)}</td><td>${esc(r.model)}</td><td class="c">${esc(r.plate)}</td><td>${esc(r.location || '')}</td><td>${esc(r.release_cond)}</td></tr>`).join('');
    return rptPage('portrait', `<h1>Vehicle Dispatch Clearance Form</h1>
      <div class="kv"><b>Date issued</b><span>${shortDate(issued)}</span><b>Pull-out deadline*</b><span>${shortDate(addWorkdays(issued, 3))}</span><b>Customer name</b><span>${esc(b.customer)}</span><b>Email</b><span>${esc(b.email)}</span></div>
      <p class="fn">*Except Saturday and Sunday</p>
      <table><thead><tr><th>Seller</th><th>Auction #</th><th>Make / Model</th><th>Plate</th><th>Location</th><th>Remarks</th></tr></thead><tbody>${rows}</tbody></table>
      <h3>Finance and Admin Dept.</h3><p>1. Buyer has no pending accounts payable<br>2. Sales is approved by seller<br>3. Seller authorize release of vehicle</p>
      <p>Upon failure to remove the Vehicle within the aforementioned period, the Buyer agrees and accepts that a storage fee of Php ${money(PENALTY_PER_DAY)} per day, including weekends, shall be charged until the Vehicle is removed from JBAP's Storage. JBAP shall release the Vehicle only upon full payment of the total computed storage fee.</p>
      ${rptSign([CO().roles.financeManager])}`);
  },
  // 7. rptVehiclerelease: Vehicle Release Form + Gate Pass (two copies per page, as in the Access sample)
  releaseForm(v, f, vrf) {
    const box = on => `<span class="rbox">${on ? '✓' : ''}</span>`, types = ['Sold', 'Return to Seller', 'Others'];
    const ref = [v.seller, v.auction].filter(x => x != null && x !== '').join(' '), typeList = types.map(t => `${box(f.type === t)}${t}`).join(' &nbsp; ');
    const items = RELEASE_ITEMS.map(t => `<span>${box(f.items.includes(t))}${esc(t)}</span>`).join('');
    const copy = `<div class="split"><div><h2>Vehicle Release Form</h2><div class="kv"><b>VRF No.</b><span>${vrf}</span><b>Release date</b><span>${shortDate(f.date)}</span><b>Released to</b><span>${esc(f.to)}</span><b>Address</b><span>-</span></div>
        <p>${typeList}</p>
        <div class="kv"><b>Make / Model</b><span>${esc(v.model)}</span><b>Fuel type</b><span>${esc(v.fuel || '')}</span><b>Year</b><span>${esc(v.year || '')}</span><b>Plate / CS no.</b><span>${esc(v.plate)}${v.cs_no ? ` / ${esc(v.cs_no)}` : ''}</span><b>Color</b><span>${esc(v.color || '')}</span><b>Auction ref</b><span>${esc(ref)}</span></div>
        <div class="cols2">${items}</div>
        <p class="fn">This is to acknowledge receipt of the abovementioned item(s) in good condition and fully aware of the purchase of this vehicle is on "AS IS WHERE IS BASIS". Therefore, I hold JBAP and the Seller, its officers, employees and other authorized representatives free from any and all liabilities arising from any hidden defect on said vehicle, which may be discovered any time after its release to my possession.</p>
        ${rptSign([`Prepared: ${CO().roles.vwdStaff}`, `Approved: ${CO().roles.vwdManager}`, 'Signature over printed name (buyer / representative)'])}</div>
      <div class="gp"><h2>Gate Pass</h2><div class="kv"><b>No.</b><span>${vrf}</span><b>Release date</b><span>${shortDate(f.date)}</span><b>Released to</b><span>${esc(f.to)}</span></div><p>${typeList}</p>
        <div class="kv"><b>Make / Model</b><span>${esc(v.model)}</span><b>Year</b><span>${esc(v.year || '')}</span><b>Color</b><span>${esc(v.color || '')}</span><b>Fuel type</b><span>${esc(v.fuel || '')}</span><b>Plate / CS no.</b><span>${esc(v.plate)}${v.cs_no ? ` / ${esc(v.cs_no)}` : ''}</span></div>
        ${rptSign([`Prepared: ${CO().roles.vwdStaff}`, `Approved: ${CO().roles.vwdManager}`])}<p>Date out: ______ &nbsp; Time out: ______</p>${rptSign([`Checked: ${CO().roles.guard}`])}</div></div>`;
    return rptPage('landscape', copy + copy);
  },
  // 8. rptCancellationPenalty: Cancellation Fee Billing letter (one per buyer, emailed as PDF)
  cancellationLetter(b, rows, date) {
    const lines = rows.map(r => `<tr><td>${esc(r.adate)}</td><td>${esc(r.model || '')}</td><td class="c">${esc(r.year || '')}</td><td class="c">${esc(r.plate)}</td><td class="c">${fmtDate(r.dcancel)}</td></tr>`).join('');
    return rptPage('portrait', `<h1>Cancellation Fee Billing</h1><p>${longDate(date)}</p><p><b>${esc(b.customer)}</b></p><p>Greetings from JBAP!</p>
      <p>This is to request payment of the penalty fee indicated below for the units awarded to you and was subsequently cancelled.</p>
      <table><thead><tr><th>Auction Date</th><th>Make / Model</th><th>Year</th><th>Plate Number</th><th>Date Cancelled</th></tr></thead><tbody>${lines}</tbody></table>
      <div class="kv"><b># of units</b><span>${rows.length}</span><b>Penalty fee</b><span>${money(CANCEL_PENALTY)}</span><b>Grand total</b><span>${money(rptSum(rows, 'penalty'))}</span></div>
      <p>Please deposit payment on or before ____________________.</p>
      <p>Account Name: ${esc(CO().name)}<br>${esc(CO().bank)}</p>
      <p>We regret to inform you that we are temporarily suspending your account until this is paid. Failure to pay within the specified time will render your account banned from joining our future auctions.</p>
      <p>Hope we can continue our partnership in the future.</p><p>${esc(CO().name)}</p>`);
  },
  // 9. DocumentTransmittalPrint: Auction Transmittal Form (signed by the buyer as receiving copy)
  documentTransmittal(v, docs, others, atf, remarks = '') {
    const box = on => `<span class="rbox">${on ? '✓' : ''}</span>`;
    const list = DOC_TYPES.map(t => { const isOthers = t === 'Others' && others;   // typed Others text always prints, with the box ticked
      return `<span>${box(docs.includes(t) || isOthers)}${esc(t)}${isOthers ? `: ${esc(others)}` : ''}</span>`; }).join('');
    return rptPage('portrait', `<h1>Auction Transmittal Form</h1><div class="kv"><b>Reference</b><span>Auction Internal forms</span><b>Control number</b><span>${esc(atf)}</span>
        <b>Buyer</b><span>${esc(v.customer)}</span><b>Received from</b><span>${esc(CO().name.toUpperCase())}</span></div>
      <h3>Document details</h3><div class="kv"><b>Car make</b><span>${esc(v.model)}</span><b>Brand</b><span>${esc((v.model || '').split(' ')[0])}</span><b>Color</b><span>${esc(v.color || '')}</span>
        <b>Year</b><span>${esc(v.year || '')}</span><b>Plate #</b><span>${esc(v.plate)}</span><b>CS #</b><span>${esc(v.cs_no || '')}</span>
        <b>Remarks</b><span>${esc(remarks)}</span></div>
      <h3>Documents</h3><div class="cols2">${list}</div>
      <h3>Acknowledgement</h3>${rptSign(['Received by (signature over printed name)', 'Date / time received'])}`);
  },
  // JBAP answer Q11 (standard, was P5): Seller Awarding Acknowledgement Form. [MOCK] layout in the BAAF style until JBAP shares a sample (spec 2026-10-15 §6)
  saaf(code, lots, date) {
    const rows = lots.map(r => `<tr><td>${esc(r.adate)}</td><td class="c">${esc(r.lot)}</td><td>${esc(r.model)}</td><td class="c">${esc(r.plate)}</td><td class="r">${money(r.price)}</td></tr>`).join('');
    return rptPage('portrait', `<h1>Seller Awarding Acknowledgement Form</h1><p class="fn">Layout to be confirmed: JBAP has not shared a SAAF sample yet.</p>
      <div class="kv"><b>Date</b><span>${longDate(date)}</span><b>Seller</b><span>${esc(SELLER[code]?.name || code)}</span></div>
      <table><thead><tr><th>Auction Date</th><th>Lot</th><th>Make / Model</th><th>Plate Number</th><th class="r">Awarded Price</th></tr></thead><tbody>${rows}</tbody>
      <tfoot><tr><td colspan="4">Total</td><td class="r">${money(rptSum(lots, 'price'))}</td></tr></tfoot></table>
      <p>We acknowledge the award of the vehicles listed above at the awarded prices and authorize JBAP to send the notice of awarding to the winning buyers.</p>
      ${rptSign([`Prepared by: ${CO().roles.smdStaff}`, "Seller's authorized representative"])}`);
  },
  // Wish 4: Vehicle Dispatch Clearance Form (Return to Seller), one per seller; the SMD and FAD Managers approve in CDMS (proposal, Q76)
  returnClearance(code, units, issued) {
    const rows = units.map(r => `<tr><td class="c">${esc(r.auction)}</td><td>${esc(r.model)}</td><td class="c">${esc(r.plate)}</td><td>${esc(r.location || '')}</td><td>${esc(r.status)}</td></tr>`).join('');
    return rptPage('portrait', `<h1>Vehicle Dispatch Clearance Form (Return to Seller)</h1>
      <div class="kv"><b>Date issued</b><span>${shortDate(issued)}</span><b>Seller</b><span>${esc(SELLER[code]?.name || code)}</span><b>Units</b><span>${units.length}</span></div>
      <table><thead><tr><th>Last Auction #</th><th>Make / Model</th><th>Plate</th><th>Location</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>
      <p>The units listed above are cleared for return to the seller. VWD records the date each unit leaves the yard.</p>
      ${rptSign([`Prepared by: ${CO().roles.smdStaff}`, `Approved in CDMS: ${CO().roles.smdManager}`, `Approved in CDMS: ${CO().roles.fadManager}`])}<p class="fn">Approvals are recorded in CDMS (proposal, Q76).</p>`);
  },
  // Rebate Monitoring download: one sheet, one row per lot with a rebate in the auction range, money totals as SUM formulas (with cached values)
  rebateWorkbook(lots, from, to) {
    const recs = [...lots].sort((a, b) => String(a.auction_lot || '').localeCompare(String(b.auction_lot || ''), 'en', { numeric: true })).map(rebateRecord);
    const money = n => (n === null || n === undefined ? null : { v: n, t: 'n', s: 'money' });
    const head = ['Month', 'Auction No.', 'Lot', 'VCN', 'Year', 'Brand', 'Model', 'Color', 'Seller', 'Minimum Bid', 'Highest Offer', 'Awarded Price', 'Buyer ID', 'Buyer', 'Rebate',
      'Date Remitted to Buyer', 'Commission', 'Revenue (Net of Rebate)'].map(h => ({ v: h, s: 'head' }));
    const rows = recs.map(x => [x.month, x.auction, x.lot, x.vcn, x.year, x.brand, x.model, x.color, x.seller, money(x.minBid), money(x.highestOffer), money(x.awarded),
      x.cid, x.buyer, money(x.rebate), x.remitted ? { v: x.remitted, t: 'd' } : null, money(x.commission), money(x.revenue)]);
    const first = 5, last = first + rows.length - 1, MONEY = { J: 'minBid', K: 'highestOffer', L: 'awarded', O: 'rebate', Q: 'commission', R: 'revenue' };
    const total = Array.from({ length: head.length }, (_, i) => {
      const col = XLSX.colName(i);
      if (i === 0) return { v: 'Total', s: 'bold' };
      if (i === 2) return { v: `${rows.length} lot(s)`, s: 'bold' };
      if (MONEY[col]) return { f: `SUM(${col}${first}:${col}${last})`, v: r2(recs.reduce((a, x) => a + (Number(x[MONEY[col]]) || 0), 0)), s: 'boldMoney' };
      return { v: '', s: 'bold' };
    });
    return XLSX.build([{ name: 'Rebate Monitoring', freezeRow: 4, filter: `A4:R${last}`,
      widths: [8, 10, 7, 15, 7, 12, 28, 12, 34, 14, 14, 14, 10, 32, 12, 14, 13, 15],
      rows: [[{ v: `JBAP Rebate Monitoring · Auctions ${from} to ${to}`, s: 'title' }],
        [`From the CDMS prototype, demo date ${fmtDate(TODAY)}. Minimum Bid = Awarded Price; Highest Offer = Awarded Price − Rebate; Revenue = Commission − Rebate.`],
        [], head, ...rows, total] }]);
  },
};
