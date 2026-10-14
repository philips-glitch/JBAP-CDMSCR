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
const REPORTS = {
  email({ from, to, cc, subject, body, atts }) {
    return `<article class="mail"><div class="mail-h"><b>From</b><span>${esc(from)}</span><b>To</b><span>${esc(to)}</span>${cc ? `<b>CC</b><span>${esc(cc)}</span>` : ''}<b>Subject</b><span>${esc(subject)}</span>
      <b>Attached</b><span>${atts.map(a => `<button type="button" class="att" data-att="${esc(a.key)}">${IC.clip}${esc(a.name)}</button>`).join(' ')}</span></div><div class="mail-b">${body}</div></article>`;
  },
  // 1. JBAP_AWARDING: Buyer's Winning Bid Confirmation
  awarding(b, lots, award) {
    const due = addWorkdays(award, 3), tot = r => r.price + (r.transfer_fee || 0);
    const rows = lots.map(r => `<tr><td>${esc(r.adate)}</td><td>${esc(r.model)}</td><td class="c">${esc(r.plate)}</td><td class="c">${esc(r.year || '')}</td><td class="r">${money(r.price)}</td><td class="r">${money(r.transfer_fee)}</td><td class="r">${money(tot(r))}</td></tr>`).join('');
    return rptPage('portrait', `<h1>Buyer's Winning Bid Confirmation</h1>
      <div class="kv"><b>Date awarded</b><span>${longDate(award)}</span><b>Payment deadline</b><span>${longDate(due)}</span>
        <b>Buyer name</b><span>${esc(b.customer)}</span><b>Customer ID</b><span>${esc(b.cid)}</span><b>Email</b><span>${esc(b.email)}</span></div>
      <table><thead><tr><th>Auction Date</th><th>Make / Model</th><th>Plate Number</th><th>Year</th><th class="r">Result Price</th><th class="r">Notarial / Transfer Fee</th><th class="r">Total</th></tr></thead><tbody>${rows}</tbody>
      <tfoot><tr><td colspan="6">Grand total</td><td class="r">${money(lots.reduce((a, r) => a + tot(r), 0))}</td></tr></tfoot></table>
      <h3>Terms and conditions</h3><p>This is to declare the undersigned Buyer as the official winner of the above-listed vehicles. The Winning Bid Amount is considered as the Vehicle Selling Price of the awarded vehicles. The Buyer fully understands that the full amount of the Vehicle Selling Price and other applicable fees must be settled within three (3) working days from the Winning Bid Confirmation date.</p>
      <h3>Bank account details</h3><p>${rptBank()}<br>Please send the proof of payment to ${esc(CO().emails.finance)}.</p>
      <h3>Penalties</h3><p>A Buyer that fails to make payment on or before the due date shall automatically forfeit the transaction and shall have no further claim as regards the right to purchase the Vehicle/s. Forfeiture of transaction is subject to a penalty of Php${money(CANCEL_PENALTY)} per vehicle which will be withdrawn from the deposit. In the event that the total penalty exceeds the deposit amount, the outstanding penalty shall be settled within 48 hours from forfeiture. Failure to settle the prescribed penalty fee will result to the Buyer being banned from joining future JBAP Auctions.</p>
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
    const net = SELLER[code]?.net !== false, m = n => (net ? money(n) : '');
    const rows = lots.map(r => `<tr><td>${esc(r.adate)}</td><td>${esc(r.customer)}</td><td>${esc(r.model)}</td><td class="c">${esc(r.plate)}</td><td class="r">${money(r.price)}</td><td class="r">${money(r.transfer_fee)}</td><td class="r">${m(r.com)}</td><td class="r">${m(r.cvat)}</td><td class="r">${m(r.wtax)}</td><td class="r">${money(r.payable)}</td><td class="r">${money(r.to_jbap)}</td></tr>`).join('');
    return rptPage('landscape', `<h2>${esc(CO().name.toUpperCase())}</h2><h1>Computation of Payable to Seller</h1><p><b>${esc(code)}</b> · ${esc(SELLER[code]?.name || code)}${net ? '' : ' (GROSS seller: commission billed separately)'}</p>
      <table><thead><tr><th>Auction Date</th><th>Customer Name</th><th>Make / Model</th><th>Plate #</th><th class="r">Result Price</th><th class="r">Notarial / Transfer / Bond</th><th class="r">Commission</th><th class="r">VAT</th><th class="r">Tax</th><th class="r">Payable to Seller</th><th class="r">To JBAP</th></tr></thead><tbody>${rows}</tbody>
      <tfoot><tr><td colspan="4">Total</td><td class="r">${money(rptSum(lots, 'price'))}</td><td class="r">${money(rptSum(lots, 'transfer_fee'))}</td><td class="r">${m(rptSum(lots, 'com'))}</td><td class="r">${m(rptSum(lots, 'cvat'))}</td><td class="r">${m(rptSum(lots, 'wtax'))}</td><td class="r">${money(rptSum(lots, 'payable'))}</td><td class="r">${money(rptSum(lots, 'to_jbap'))}</td></tr></tfoot></table>
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
};
