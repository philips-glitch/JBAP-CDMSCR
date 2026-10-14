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
};
