'use strict';
/* app.js — CDMS Post-Auction prototype (FAD / SMD / VWD) for JBA Philippines.
   Vanilla JS, no framework. All data comes from data.js (window.MOCK_DATA) and lives in memory:
   [MOCK] every change is lost on refresh, by design. */

// ─── Constants & helpers ──────────────────────────────────────────────
const D = window.MOCK_DATA;
// [BEHAVIOR] Fixed demo date so deadlines and penalties stay the same whenever the prototype is opened.
const TODAY = D ? D.meta.demoToday : '2026-10-09';
const PENALTY_PER_DAY = 500;     // storage penalty per calendar day after the dispatch deadline (confirmed by Access data, Q15)
const PENALTY_LOCATIONS = ['Pasay City', 'JBAP'];   // storage penalty applies only to units stored here (JBAP Q15)
const CANCEL_PENALTY = 10000;    // cancellation penalty per lot (JBAP Q4)
// [BEHAVIOR] Latest auction = the last auction that has started by the demo date (reference only: the Inventory "Latest auction" filter was dropped on 19 Oct 2026; Return to Seller and Inventory use listedAhead)
const LATEST_AUCTION = D ? Object.keys(D.auctions).filter(k => D.auctions[k][0] <= TODAY).sort((a, b) => a - b).pop() : null;
const COMMISSION_RATE = 0.05;    // default commission rate (seller.commission_rate overrides)
const VAT_RATE = 0.12;
const WTAX_RATE = 0.15;          // withholding tax on the commission for NET sellers (Access Payment Seller sample; to confirm Q26)
const r2 = n => Math.round(n * 100) / 100;
const BILL_DUE_DAYS = 10;        // Access DB: billing due date = billing date + 10 days
const $ = (s, el = document) => el.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => (n === null || n === undefined || n === '' || isNaN(n)) ? '' : Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const intf = n => (n === null || n === undefined || n === '') ? '' : Number(n).toLocaleString('en-US');
const fmtDate = iso => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${m}/${d}/${y}`; };
const toDate = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const toIso = dt => dt.toISOString().slice(0, 10);
const addDays = (iso, n) => { const d = toDate(iso); d.setUTCDate(d.getUTCDate() + n); return toIso(d); };
// [BEHAVIOR] JBAP answer Q14 (20 Oct 2026): working days skip Saturdays, Sundays and every date in the holiday list (Settings > Holiday List; regular holidays and special non-working days alike).
// Every deadline (buyer, payment to seller, dispatch), aging and customer page count is built on these two functions. HOLIDAY_DATES is rebuilt from S.holidays when the list loads and each time a holiday is added or removed.
let HOLIDAY_DATES = new Set();
const isWorkday = d => { const w = d.getUTCDay(); return w !== 0 && w !== 6 && !HOLIDAY_DATES.has(toIso(d)); };
function addWorkdays(iso, n) { let d = toDate(iso), left = n; while (left > 0) { d.setUTCDate(d.getUTCDate() + 1); if (isWorkday(d)) left--; } return toIso(d); }
// [BEHAVIOR] Working days from a to b, both days included, like Excel NETWORKDAYS with the holiday list. Blank when a is blank or after b.
function workdaysBetween(a, b) { if (!a || !b || a > b) return null; let n = 0; for (const d = toDate(a), e = toDate(b); d <= e; d.setUTCDate(d.getUTCDate() + 1)) { if (isWorkday(d)) n++; } return n; }
const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// [BEHAVIOR] JBAP feedback (16 Oct 2026, #4): dates can be typed. t / today = the demo date; mm/dd/yyyy, mm/dd/yy (20yy), mm/dd and mmdd (year of the demo date),
// mmddyyyy, yyyy-mm-dd; separators / - . or space. '' = blank, null = not a date.
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_ERR = 'is not a valid date (mm/dd/yyyy, or t for today)';
function parseDateInput(text, today = TODAY) {
  const s = String(text ?? '').trim().toLowerCase(); if (!s) return '';
  if (s === 't' || s === 'today') return today;
  let k, y, m, d;
  if ((k = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s))) [, y, m, d] = k;
  else if ((k = /^(\d{1,2})[/\-. ](\d{1,2})(?:[/\-. ](\d{2}|\d{4}))?$/.exec(s))) [, m, d, y] = k;
  else if ((k = /^(\d{2})(\d{2})(\d{4})?$/.exec(s))) [, m, d, y] = k;
  else return null;
  y = y === undefined ? +today.slice(0, 4) : y.length === 2 ? 2000 + +y : +y; m = +m; d = +d;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (y < 1900 || y > 2100 || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return toIso(dt);
}
const dateText = v => !v ? '' : ISO_RE.test(v) ? fmtDate(v) : String(v);   // a stored date as mm/dd/yyyy; text that is not a date stays as typed
// A typed date box with a calendar button (the button opens the browser's picker through one shared hidden input, see bind)
const dateBox = (cls, val, attrs) => `<span class="dti"><input type="text" class="${cls}" autocomplete="off" placeholder="mm/dd/yyyy" value="${esc(dateText(val))}" ${attrs}><button type="button" class="dtp" data-pick tabindex="-1" aria-label="Open the calendar">${IC.cal}</button></span>`;
const dateField = (id, iso, attrs = '', cls = '') => dateBox(`ctl dt${cls ? ' ' + cls : ''}`, iso, `id="${id}"${attrs ? ' ' + attrs : ''}`);

const IC = {
  filter: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h18l-7 8v6l-4 2v-8z"/></svg>',
  table: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 9h18M3 14h18M9 9v11"/></svg>',
  lock: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><rect x="5" y="11" width="14" height="10" rx="1.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  pen: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  info: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>',
  search: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>',
  print: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M7 9V3h10v6"/><rect x="3.5" y="9" width="17" height="8" rx="1.5"/><path d="M7 14h10v7H7z"/></svg>',
  mail: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3.5 6l8.5 7 8.5-7"/></svg>',
  download: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
  cal: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15.5" rx="1.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  save: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M5 3h11l3 3v15H5z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/></svg>',
  reset: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/></svg>',
  ban: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/></svg>',
  play: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M7 5l11 7-11 7z"/></svg>',
  check: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  clip: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 11l-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7"/></svg>',
  inbox: '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1 3h6l1-3h5"/></svg>',
  menu: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#293a8e" stroke-width="2.2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
};
const DEPT_ICON = {
  FAD: '<rect x="5" y="2.5" width="14" height="19" rx="1.6"/><rect x="7.8" y="5.3" width="8.4" height="3.6" rx=".6"/><path d="M8.3 12.3h.1M12 12.3h.1M15.7 12.3h.1M8.3 15.3h.1M12 15.3h.1M15.7 15.3h.1M8.3 18.3h.1M12 18.3h.1M15.7 18.3h.1"/>',
  SMD: '<rect x="3" y="3.5" width="18" height="12.5" rx="1.2"/><path d="M12 16v3.5M8 21h8"/><path d="M6.5 13v-2.5M10 13V8.5M13.5 13v-3M17 13V6.5"/>',
  VWD: '<path d="M2.5 9.5L12 4l9.5 5.5V21h-19z"/><path d="M6 21v-6.5h12V21"/><path d="M7.6 17.8h8.8M9 14.5l1-1.8h4l1 1.8"/><path d="M8.6 19.6h.1M15.4 19.6h.1"/>',
  SET: '<path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17" r="2"/>',
  LOG: '<rect x="4.5" y="3.5" width="13" height="17.5" rx="1.4"/><path d="M8 3.5V2.5h6v2H8z"/><path d="M7.5 9h7M7.5 12.5h4"/><circle cx="17" cy="17" r="4.2"/><path d="M17 15v2.2l1.4 1"/>',
};
const deptSvg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${DEPT_ICON[d]}</svg>`;

// ─── State ────────────────────────────────────────────────────────────
// [MOCK] Deep copy of data.js so "Reset demo data" is just a page refresh.
const S = D ? JSON.parse(JSON.stringify({ veh: D.vehicles, cancels: D.cancellations, billing: D.billing, log: [], holidays: D.holidays || [] })) : null;
const syncHolidays = () => { HOLIDAY_DATES = new Set(S.holidays.map(h => h.date)); };
if (S) syncHolidays();
const SELLER = D ? Object.fromEntries(D.sellers.map(s => [s.code, s])) : {};
const UI = {};          // per-screen UI state: filters, sort, page, edits, errors, message
const OPEN = { Customer: false, Report: false, FAD: false, SMD: false, VWD: false, Settings: false };

// ─── Proposed improvements switch (spec 2026-10-15) ──────────────────
// [BEHAVIOR] Off = the CR scope exactly; on = LOGIQUE's proposals P2–P6 (P1 withdrawn after JBAP's feedback of 15 Oct 2026). A link with ?proposed=1 opens with the switch on.
// Screens, columns and buttons marked `proposed` show only with the switch on; `tag` adds "Proposed P#" (switch on) or "Wish list" (always).
let PROPOSED = /[?&]proposed=1(&|$)/.test((typeof location !== 'undefined' && location.search) || '');
const isProposed = () => PROPOSED;
function setProposed(on) {
  PROPOSED = !!on;
  if (typeof history === 'undefined' || !history.replaceState) return;   // Node tests have no history
  const u = new URL(location.href); if (PROPOSED) u.searchParams.set('proposed', '1'); else u.searchParams.delete('proposed');
  history.replaceState(null, '', u);
}
const shown = x => !x.proposed || PROPOSED;
const colsOf = scr => scr.cols.filter(shown);
const tagHtml = x => !x.tag ? '' : x.tag === 'Wish' ? '<span class="ptag wish">Wish list</span>' : PROPOSED ? `<span class="ptag">Proposed ${esc(x.tag)}</span>` : '';
const tagMini = x => !x.tag ? '' : x.tag === 'Wish' ? '<span class="ptag mini wish">Wish</span>' : PROPOSED ? `<span class="ptag mini">${esc(x.tag)}</span>` : '';
// [BEHAVIOR] User, 19 Oct 2026: "New" marks everything added or changed after JBAP's feedback of 19 Oct (rounds 2b + 3); always shown
const NEW_TIP = "Added or changed after JBAP's feedback of 19 Oct 2026";
const newHtml = x => x && x.isNew ? `<span class="ptag new" title="${NEW_TIP}">New</span>` : '';
const newMini = x => x && x.isNew ? `<span class="ptag mini new" title="${NEW_TIP}">New</span>` : '';

// ─── Derived fields (business rules from the Access guideline) ────────
const RELEASE_LABEL = { payment: 'Buyer Payment', ack: 'Seller Acknowledgement', doas: 'Required DOAS / Legal Documents signing' };
const releaseOf = v => SELLER[v.seller]?.release || 'ack';
// [BEHAVIOR] Dispatch notice per seller condition (Dispatch Condition per seller): payment and DOAS sellers after Buyer Paid,
// others after Seller Acknowledgement. DOAS sellers still need the signed DOAS before VWD releases.
const dispatchReady = v => releaseOf(v) === 'ack' ? !!v.seller_ack : !!v.buyer_paid;
// [BEHAVIOR] JBAP feedback (15 Oct 2026): how the seller's DOAS is signed, separate from the release condition. 'jbap' = at JBAP (default),
// 'branch' = at the seller's HO or store (EWB), 'none' = no DOAS (sellers released on Buyer Payment: TFS). In JBAP's sheet JACCS and SAFC sign a DOAS too.
const doasOf = v => SELLER[v.seller]?.doas_signing || (releaseOf(v) === 'payment' ? 'none' : 'jbap');
const DOC_STATUSES = ['Pending Payment', 'Pending DOAS', 'DOAS for Signing', 'Pending Documents', 'For Releasing', 'Complete', 'Cancelled'];
// [BEHAVIOR] Document status = the furthest step reached (JBAP's 2026 Documents Monitoring sheet: same as the typed status on 1,644 of 1,674 lots)
function docStatus(v) {
  const doas = doasOf(v);
  if (v.status === 'Cancelled') return 'Cancelled';
  if (v.to_buyer) return 'Complete';
  if (v.orig_docs) return 'For Releasing';
  if (doas === 'none') return v.pay_seller ? 'Pending Documents' : 'Pending Payment';
  if (v.buyer_doas || v.seller_doas || (doas === 'branch' && v.ewb_signed)) return 'Pending Documents';
  if (v.rcv_doas || (doas === 'branch' && v.pay_seller)) return 'DOAS for Signing';
  return v.pay_seller ? 'Pending DOAS' : 'Pending Payment';
}
// [BEHAVIOR] Aging counts working days to today only while a step waits (JBAP's sheet shows 0 once done; CDMS shows blank).
// DOAS Aging: from Seller Payment while the DOAS is awaited (branch sellers: until it is signed). Docs Aging: from the signed DOAS (no DOAS: Seller Payment) until JBAP has the documents.
function docAging(v, status, doas) {
  const start = doas === 'none' ? v.pay_seller : v.seller_doas || (doas === 'branch' ? v.ewb_signed : null);
  return { doas_aging: status === 'Pending DOAS' || (doas === 'branch' && status === 'DOAS for Signing') ? workdaysBetween(v.pay_seller, TODAY) : null,
    docs_aging: status === 'Pending Documents' ? workdaysBetween(start, TODAY) : null };
}
// [BEHAVIOR] JBAP feedback (15 Oct 2026): Security Bond per vehicle, billed to the buyer with the vehicle. Seller setting security_bond; the lot keeps its own
// amount once set at Pending Awarding. It passes to the seller with the remittance (JBAP's "Notarial / Transfer / Bond" column; to confirm, Q46).
const bondOf = v => Number(v.security_bond ?? SELLER[v.seller]?.security_bond ?? 0) || 0;
const BOND_STATUSES = ['Pending Documents', 'Waiting ORCR', 'Pending Refund', 'Complete', 'Forfeited'];
const REFUND_VIA = ['Deposit c/o JBAP', 'Cheque', 'Seller deposited to buyer'];   // JBAP's Security Bond sheet remarks
// [BEHAVIOR] Security Bond status = the furthest step reached (JBAP's Security Bond sheet: same as the typed status on 93 of 98 lots)
const bondStatus = v => v.bond_forfeited ? 'Forfeited' : v.bond_refund_buyer ? 'Complete' : v.bond_orcr_seller || v.bond_refund_jbap ? 'Pending Refund' : v.to_buyer ? 'Waiting ORCR' : 'Pending Documents';
// [BEHAVIOR] Commission (÷1.12 when the seller's 5% includes VAT), VAT 12%, W/TAX 15% for NET sellers,
// To JBAP = commission + VAT − W/TAX (0 for GROSS sellers), Payable to Seller = price + fee + security bond − To JBAP. Unrounded until displayed.
function sellerMoney(v) {
  const s = SELLER[v.seller] || {}, price = v.price;
  if (price === null || price === undefined) return { com: null, cvat: null, ctotal: null, wtax: null, to_jbap: null, payable: null };
  const rate = s.commission_rate ?? COMMISSION_RATE, com = s.vat_inclusive ? price * rate / (1 + VAT_RATE) : price * rate;
  const vat = com * VAT_RATE, net = s.net !== false, wtax = net ? com * WTAX_RATE : 0, toJbap = net ? com + vat - wtax : 0;
  return { com: r2(com), cvat: r2(r2(com + vat) - r2(com)), ctotal: r2(com + vat), wtax: r2(wtax), to_jbap: r2(toJbap), payable: r2(price + (v.transfer_fee || 0) + bondOf(v) - toJbap) };
}
// [BEHAVIOR] JBAP feedback (16 Oct 2026, #19): a unit is listed ahead when its own auction, or the auction it is relisted in (next_auction), has not ended (Q77)
const listedAhead = v => [v.auction, v.next_auction].some(a => a && (D.auctions[String(a)] || [])[1] >= TODAY);
// [BEHAVIOR] Inventory status (JBAP feedback 16 and 19 Oct 2026, #20, #23, #4a-c): calculated from the lot, view only, first match wins. For Release = dispatched to VWD, waiting for the buyer's pull-out (Q71).
// Listed = in an auction that has not ended (its own or the one it is relisted in); Not Listed = everything else that is still unsold or unreturned
const INV_STATUSES = ['Listed', 'Not Listed', 'Awarded', 'For Release', 'For Return', 'Released', 'Returned'];
const invStatusOf = v => v.release ? (v.release_type === 'Return to Seller' ? 'Returned' : 'Released') : v.rts_cleared ? 'For Return' : v.dispatch ? 'For Release' : v.status === 'Sold' ? 'Awarded' : listedAhead(v) ? 'Listed' : 'Not Listed';
// [BEHAVIOR] Rebate figures shared by the Rebate Monitoring screen and its download (JBAP's Rebate Monitoring file): Minimum Bid = Awarded Price,
// Highest Offer = Awarded Price − Rebate, Revenue = Commission − Rebate; blank when there is no price / commission.
const rebateMoney = (price, rebate, com) => { const has = n => n !== null && n !== undefined && n !== '';
  return { min_bid: has(price) ? price : null, highest_offer: has(price) ? r2(price - (rebate || 0)) : null, revenue: has(com) ? r2(com - (rebate || 0)) : null }; };
function enrichV(v) {
  const [as, ae] = D.auctions[String(v.auction)] || [null, null];
  const buyer_deadline = v.awarding ? addWorkdays(v.awarding, 3) : null;     // 3 working days after awarding
  const pay_deadline = v.buyer_paid ? addWorkdays(v.buyer_paid, 3) : null;   // 3 working days after buyer paid
  const dispatch_deadline = v.dispatch ? v.deadline_reset || addWorkdays(v.dispatch, 3) : null;  // 3 working days after dispatch; a penalty payment moves it to the payment date
  const overdue = v.dispatch && !v.release && dispatch_deadline < TODAY;
  const bond = bondOf(v), total = v.price === null ? null : v.price + (v.transfer_fee || 0) + bond;
  const doas = doasOf(v), doc_status = docStatus(v);
  const sm = sellerMoney(v), rb = rebateMoney(v.price, v.rebate, sm.com);
  return Object.assign({}, v, {
    _raw: v, auction_start: as, auction_end: ae, adate: as ? `${fmtDate(as)} - ${fmtDate(ae)}` : '',
    seller_full: SELLER[v.seller]?.name || v.seller, total, security_bond: bond,
    bond_status: bondStatus(v),
    release_cond: RELEASE_LABEL[releaseOf(v)],
    auction_lot: `${v.auction}/${v.lot || ''}`, doas, doc_status, ...docAging(v, doc_status, doas),
    // Wish 5: a release with type Return to Seller is the return date; any other release is the release to the buyer
    days_in_yard: v.entry_date ? daysBetween(v.entry_date, v.release || TODAY) : null,
    released_buyer: v.release && v.release_type !== 'Return to Seller' ? v.release : null, returned_seller: v.release_type === 'Return to Seller' ? v.release : null,
    yard: v.release ? 'Out' : 'In yard', inv_status: invStatusOf(v),
    first_auction: v.auction ?? null, listing_end: (D.auctions[String(v.next_auction || v.auction)] || [])[1] || null,   // First Auction Listed, End Date of Listing (the relisting's end when the unit is relisted)
    buyer_deadline, pay_deadline, dispatch_deadline,
    penalty: overdue && PENALTY_LOCATIONS.includes(v.location || 'Pasay City') ? daysBetween(dispatch_deadline, TODAY) * PENALTY_PER_DAY : null,
    penalty_paid: (v.penalty_payments || []).reduce((a, p) => a + p.amount, 0) || null,
    ...sm, min_bid: rb.min_bid, highest_offer: rb.highest_offer, rebate_revenue: rb.revenue,
  });
}
const V = () => S.veh.map(enrichV);
const sold = () => V().filter(v => v.status === 'Sold');
// id includes the position: Access has the same Billing # more than once (e.g. 428)
const B = () => S.billing.map((b, i) => Object.assign({}, b, { _raw: b, id: `${b.no}#${i}`, bill: Math.round(b.total / 1.12 * 100) / 100,
  vat: Math.round((b.total - b.total / 1.12) * 100) / 100, due: addDays(b.bdate, BILL_DUE_DAYS) }));
// [BEHAVIOR] Cancellation penalty PHP 10,000 per lot: 5,000 to the seller and 5,000 to JBAP; EWB: all to JBAP (Q4). Waived lots: 0.
function cancelSplit(c) { const p = c.waived ? 0 : CANCEL_PENALTY, toSeller = c.seller === 'EWB' ? 0 : p / 2; return { penalty: p, pen_seller: toSeller, pen_jbap: p - toSeller }; }
// [BEHAVIOR] A cancellation without its own seller takes the seller of the vehicle with the same plate and auction.
const cancelSeller = c => c.seller ?? (S.veh.find(x => x.plate === c.plate && x.auction === c.auction) || {}).seller ?? null;
const CX = () => S.cancels.map(c => {
  const a = D.auctions[String(c.auction)], v = S.veh.find(x => x.plate === c.plate && x.auction === c.auction) || {};
  return Object.assign({}, c, { _raw: c, status: 'Cancelled', adate: a ? `${fmtDate(a[0])} - ${fmtDate(a[1])}` : '', model: v.model || '', year: v.year || '', seller: cancelSeller(c) },
    cancelSplit(Object.assign({}, c, { seller: cancelSeller(c) })));
});
// [BEHAVIOR] Billing a cancellation records today's billing date and the penalty as the amount due
function recordCancellationBilling(scr, rows) {
  const ui = U(scr.id);
  rows.forEach(r => {
    const amount = r._raw.amount ?? r.penalty;
    logChange(scr, 'Update', r, [['Billing Date', 'date', r._raw.bill_date, TODAY], ['Amount', 'money', r._raw.amount, amount], ['For Print?', 'check', r._raw.for_print, false]]);
    r._raw.bill_date = TODAY; r._raw.amount = amount; r._raw.for_print = false; delete ui.edits[r.id];
  });
}
// [MOCK] legacy billed cancellations without an amount default to the penalty, so Save on Cancellation Billing & Payment works
if (S) S.cancels.forEach(c => { if (c.bill_date && (c.amount === null || c.amount === undefined)) c.amount = cancelSplit(Object.assign({}, c, { seller: cancelSeller(c) })).penalty; });
// [BEHAVIOR] Seller names as Access and JBAP's files write them → seller code (upper-case, spaces collapsed); JBAP Q79: Toyota is TFS
const normName = s => String(s || '').toUpperCase().replace(/\s+/g, ' ').trim();
const SELLER_ALIASES = { 'TOYOTA FINANCIAL SERVICES CORP': 'TFS', 'SOUTH ASIALINK FINANCE CORP.': 'ASIALINK', 'JACCS FINANCE PHILIPPINES CORP': 'JACCS', 'SECURITY BANK CORPORATION': 'SBC' };
const SELLER_BY_NAME = D ? Object.assign(Object.fromEntries(D.sellers.map(s => [normName(s.name), s.code])), SELLER_ALIASES) : {};
const sellerCode = name => SELLER_BY_NAME[normName(name)] || null;
// [BEHAVIOR] JBAP feedback (19 Oct 2026, VWD #4): every unit in the yard — auction lots, JBAP's parking-file units that are not lots, and new vehicles from inspection
// A unit that entered the yard after the demo date (JBAP's file is as of 12 Oct, the demo date is 8 Oct) shows 0 days, not a negative number.
const yardRow = (u, status) => ({ id: u.id, plate: u.plate, vcn: u.vcn || '', cs_no: u.cs_no || '', model: u.model, color: u.color || '', year: u.year || '',
  seller: u.seller || sellerCode(u.seller_name) || u.seller_name || '', logistics: u.logistics || null, origin_wh: u.origin_wh || null, parking: u.parking || null,
  transfer_date: u.transfer_date || null, entry_date: u.entry_date || null, first_auction: null, listing_end: null, status: '', inv_status: status,
  released_buyer: null, returned_seller: null, rts_wh: null, yard: 'In yard', days_in_yard: u.entry_date ? Math.max(0, daysBetween(u.entry_date, TODAY)) : null });
const inventoryRows = () => [...V(), ...(D.yardUnits || []).map(u => yardRow(u, u.file_status === 'FOR RETURN' ? 'For Return' : 'Listed')),
  ...(D.inspectionUnits || []).map(u => yardRow(u, 'Not Listed'))];
// [BEHAVIOR] JBAP feedback (16 Oct 2026): SMD lists show the seller code and the Auction No.; the legacy snapshot has only the seller's name and the auction dates
const AUCTION_BY_DATES = D ? Object.fromEntries(Object.entries(D.auctions).map(([k, [s, e]]) => [`${fmtDate(s)} - ${fmtDate(e)}`, Number(k)])) : {};
const SMD = k => D.smd[k].map((r, i) => Object.assign({ id: `${k}-${i}` }, r,
  r.seller === undefined && r.seller_full ? { seller: sellerCode(r.seller_full) || r.seller_full } : {},
  r.auction === undefined && r.adate ? { auction: AUCTION_BY_DATES[r.adate] ?? null } : {}));
// ─── Customers (Customer › Customer Inquiry and the customer page; user request of 16 Oct 2026) ──
// [BEHAVIOR] A customer is a buyer with a Buyer ID (cid), found on the lots and the cancellations. The name is the one on the buyer's latest auction.
// Lots without a Buyer ID have no customer page.
const CUST_ID = 'customer-inquiry';
const knownBuyer = cid => !!cid && (S.veh.some(v => v.cid === cid) || S.cancels.some(c => c.cid === cid));
function buyerIndex() {
  const m = new Map();
  const add = (cid, name, email, auction) => {
    if (!cid) return; const b = m.get(cid);
    if (!b) { m.set(cid, { cid, name: name || '', email: email || '', last: +auction }); return; }
    if (+auction >= b.last && name) b.name = name; b.last = Math.max(b.last, +auction); b.email ||= email || '';
  };
  S.veh.forEach(v => add(v.cid, v.customer, v.email, v.auction)); S.cancels.forEach(c => add(c.cid, c.customer, null, c.auction));
  return m;
}
const isPendingAward = v => !v.awarding, isUnpaidLot = v => !!v.awarding && !v.buyer_paid;   // the FAD Pending Awarding and Unpaid rules, on SOLD lots
// [BEHAVIOR] Step = how far a sold lot has got: Pending award → Unpaid → Paid → Seller Ack. → For Dispatch → Unreleased → Released / Returned.
// For Dispatch follows the seller's dispatch condition, so lots of sellers released on Buyer Payment go from Paid straight to For Dispatch.
const stepOf = v => v.status !== 'Sold' ? v.status : v.release ? (v.release_type === 'Return to Seller' ? 'Returned' : 'Released') : v.dispatch ? 'Unreleased'
  : dispatchReady(v) ? 'For Dispatch' : v.pay_seller ? 'Seller Ack.' : v.buyer_paid ? 'Paid' : v.awarding ? 'Unpaid' : 'Pending award';
function buyerRows() {
  const all = V(), cx = CX();
  return [...buyerIndex().values()].map(b => {
    const s = all.filter(v => v.cid === b.cid && v.status === 'Sold');
    return { id: b.cid, cid: b.cid, customer: b.name, email: b.email, lots: s.length, total_bought: r2(sumBy(s, 'price')), unpaid: s.filter(isUnpaidLot).length,
      cancels: cx.filter(c => c.cid === b.cid).length, last_auction: b.last };
  });
}
// [BEHAVIOR] JBAP answer Q21 (20 Oct 2026): Vehicle for release = the buyer's sold lots with a Dispatch Date and no release yet (the lots FAD and VWD call Unreleased Unit)
// [BEHAVIOR] JBAP feedback (16 Oct 2026): DOAS waiting for the buyer's signature = Receipt of DOAS filled, signed DOAS not back by any route (JBAP, seller, or EWB branch: the same test as Document Status and the release check); documents for release = JBAP has them, the buyer not yet (Q82)
// Proposal Q82 (19 Oct 2026): an EWB branch lot also waits once EWB has been called out (EWB Call Out filled), before any Receipt of DOAS; the working days count from Receipt of DOAS, else from EWB Call Out
function buyerOf(cid) {
  const b = buyerIndex().get(cid); if (!b) return null;
  const sold = V().filter(v => v.cid === cid && v.status === 'Sold')
    .map(v => Object.assign(v, { amonth: v.auction_start ? MONTHS[+v.auction_start.slice(5, 7) - 1] : '', step: stepOf(v) }))
    .sort((x, y) => y.auction - x.auction || String(x.lot).localeCompare(String(y.lot), 'en', { numeric: true }));
  const sellers = [...new Set(sold.map(v => v.seller))].map(code => {
    const mine = sold.filter(v => v.seller === code);
    return { id: code, seller: code, seller_full: SELLER[code]?.name || code, units: mine.length, amount: r2(sumBy(mine, 'price')), unpaid: mine.filter(isUnpaidLot).length, last: Math.max(...mine.map(v => +v.auction)) };
  }).sort((x, y) => y.units - x.units || y.amount - x.amount);
  return Object.assign({}, b, { sold, pending: sold.filter(isPendingAward), unpaid: sold.filter(isUnpaidLot),
    pending_doas: sold.filter(v => !v.buyer_doas && !v.seller_doas && !(v.doas === 'branch' && v.ewb_signed) && (v.rcv_doas || (v.doas === 'branch' && v.ewb_callout))).map(v => Object.assign(v, { doas_days: workdaysBetween(v.rcv_doas || v.ewb_callout, TODAY) })), for_release: sold.filter(v => v.dispatch && !v.release), docs_release: sold.filter(v => v.orig_docs && !v.to_buyer), cancels: CX().filter(c => c.cid === cid).sort((x, y) => y.auction - x.auction), sellers });
}
const CUST_TABS = [['sold', 'Sold'], ['pending-awarding', 'Pending Awarding'], ['unpaid', 'Unpaid'], ['vehicle-release', 'Vehicle for release', true], ['pending-doas', 'Pending DOAS signature', true], ['docs-release', 'Documents for release'], ['cancellation', 'Cancellation']];   // third item: New mark on the tab label
const custHref = (cid, tab) => `#/customer/${encodeURIComponent(cid)}${tab && tab !== 'sold' ? '/' + tab : ''}`;
function custRoute(h) {   // #/customer/<Buyer ID>[/<list>] → { cid, tab }
  const m = /^customer\/([^/]+)(?:\/([^/]*))?$/.exec(h || ''); if (!m) return null;
  let cid; try { cid = decodeURIComponent(m[1]); } catch { cid = m[1]; }
  return { cid, tab: CUST_TABS.some(t => t[0] === m[2]) ? m[2] : 'sold' };
}
// ─── Activity log (one entry per changed field; entries are never edited or deleted) ──
const LOG_ID = 'log-activity';
const LOG_USER = 'system';   // [MOCK] the header user; there is no real login in the prototype
const addLog = e => S.log.push(Object.assign({ id: `L${S.log.length + 1}`, date: e.at.slice(0, 10) }, e));
if (S) (D.activityLog || []).forEach(addLog);
const logVal = (type, v) => type === 'check' ? (v ? 'Yes' : 'No') : v === null || v === undefined || v === '' ? ''
  : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : type === 'date' ? fmtDate(v) : type === 'money' ? money(v) : String(v);
const logRecord = r => r.auction ? `Auction ${r.auction}, Lot ${r.lot || '-'}${r.plate ? ` · ${r.plate}` : ''}` : r.holiday ? `Holiday ${fmtDate(r.date)} · ${r.name}` : `Billing #${r.no}`;
// [BEHAVIOR] changes: [[field label, type, old value, new value]]. Update rows whose value did not change are skipped.
function logChange(scr, action, r, changes) {
  const at = `${TODAY} ${new Date().toTimeString().slice(0, 8)}`;   // demo date + real clock time
  changes.forEach(([field, type, o, n]) => {
    const old = logVal(type, o), nw = logVal(type, n);
    if (action !== 'Update' || old !== nw) addLog({ at, user: LOG_USER, module: scr.dept, screen: scr.title, action, record: logRecord(r), field, old, new: nw });
  });
}

// ─── Holiday list (Settings › Holiday List; JBAP answer Q14, 20 Oct 2026) ──
// [BEHAVIOR] The list lives in S.holidays (a session copy of D.holidays, so a refresh restores the sample). In CDMS only users with the ADMIN role add or remove holidays; the prototype has no login, so every visitor can.
const HOLIDAY_TYPES = ['Regular holiday', 'Special non-working day'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const holidayRows = () => S.holidays.map(h => Object.assign({ id: h.date, day: WEEKDAYS[toDate(h.date).getUTCDay()], year: h.date.slice(0, 4) }, h));
// The problem with each field of the Add holiday form, or null (f.date: ISO date, '' = blank, null = not a date)
function holidayErrors(f) {
  const dup = f.date && S.holidays.find(h => h.date === f.date);
  return { date: f.date === null ? 'Type the date as mm/dd/yyyy, or t for today.' : !f.date ? 'Date is required.' : dup ? `A holiday is already listed on ${fmtDate(f.date)} (${dup.name}).` : null,
    name: !String(f.name || '').trim() ? 'Holiday name is required.' : null,
    type: !HOLIDAY_TYPES.includes(f.type) ? 'Choose the type of holiday.' : null };
}
const holidayError = f => Object.values(holidayErrors(f)).find(Boolean) || null;
// [BEHAVIOR] Adding or removing a holiday changes every deadline and aging count that spans the date at once, and is logged under module Settings (a removal is a Delete)
function recordHolidayAdd(scr, f) {
  const h = { date: f.date, name: f.name.trim(), type: f.type };
  S.holidays.push(h); S.holidays.sort((x, y) => x.date.localeCompare(y.date)); syncHolidays();
  logChange(scr, 'Create', Object.assign({ holiday: true }, h), [['Date', 'date', null, h.date], ['Holiday', 'text', null, h.name], ['Type', 'text', null, h.type]]);
  return h;
}
function recordHolidayRemove(scr, date) {
  const i = S.holidays.findIndex(h => h.date === date); if (i < 0) return false;
  const [h] = S.holidays.splice(i, 1); syncHolidays();
  logChange(scr, 'Delete', Object.assign({ holiday: true }, h), [['Date', 'date', h.date, null], ['Holiday', 'text', h.name, null], ['Type', 'text', h.type, null]]);
  return true;
}

// ─── Column helper ────────────────────────────────────────────────────
const C = (label, key, type = 'text', o = {}) => Object.assign({ label, key, type }, o);
const CEN = new Set(['code', 'date', 'check', 'status', 'rocheck', 'datetime', 'action', 'rowbtn']);
const RIGHT = new Set(['money', 'int']);
const sumBy = (rows, k) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);
const AUCTION_FILTER = { key: 'auction', label: 'Auction No.', type: 'text', w: 'w1', exact: true };
const sellerOpts = () => Object.keys(SELLER).sort();

// ─── Screen definitions (columns and rules from the CR form, one per submenu) ──
const VFS = ['View', 'Filter', 'Sort'], VFSU = ['View', 'Filter', 'Sort', 'Update'], VS = ['View', 'Sort'], VSU = ['View', 'Sort', 'Update'];
const notFuture = d => d && d > TODAY ? `cannot be after today (${fmtDate(TODAY)})` : null;
const notBefore = (d, ref, refLabel) => d && ref && d < ref ? `cannot be before ${refLabel} (${fmtDate(ref)})` : null;
// [BEHAVIOR] JBAP answer Q5 (20 Oct 2026): a rebate has no set formula; SMD recommends it, the President approves it, FAD types the approval date (Rebate Approved (President)).
// The date is blank when the lot has no rebate (blank or 0); a lot with a rebate needs it before it is awarded, by Save changes with an Awarding Date or by Email BAAF.
const REBATE_NEEDS_APPROVAL = "The rebate needs the President's approval date before awarding.";
function rebateApprovalError(rebate, approved, awarding) {
  const has = Number(rebate) > 0;
  return !has && approved ? 'No rebate to approve' : has && awarding && !approved ? REBATE_NEEDS_APPROVAL : null;
}

// [BEHAVIOR] Document dates: not in the future, not before Buyer Paid, steps in order (EWB call out → signed; receipt → JBAP signed → seller receipt),
// documents to the buyer only after JBAP has them. EWB columns only for sellers who sign at their branch; DOAS columns not for sellers without a DOAS.
// Only what is being saved is checked: a date check runs on the dates in the edit, an order check when either of its two dates is in the edit,
// so a row that carries JBAP's own out-of-order dates (e.g. V110) can still save other edits such as Remarks.
function docValidate(r, e) {
  const val = k => (k in e ? e[k] : r[k]) || null, has = (...ks) => ks.some(k => k in e), out = {}, doas = doasOf(r);
  ['ewb_callout', 'ewb_signed', 'rcv_doas', 'buyer_doas', 'seller_doas', 'orig_docs', 'to_buyer'].forEach(k => { if (k in e) out[k] = notFuture(val(k)) || notBefore(val(k), r.buyer_paid, 'Buyer Paid'); });
  if (has('ewb_callout', 'ewb_signed')) out.ewb_signed ||= notBefore(val('ewb_signed'), val('ewb_callout'), 'EWB Call Out');
  if (has('rcv_doas', 'buyer_doas')) out.buyer_doas ||= notBefore(val('buyer_doas'), val('rcv_doas'), 'Receipt of DOAS');
  if (has('rcv_doas', 'buyer_doas', 'seller_doas')) out.seller_doas ||= notBefore(val('seller_doas'), val('buyer_doas') || val('rcv_doas'), val('buyer_doas') ? 'JBAP Receipt of Signed DOAS' : 'Receipt of DOAS');
  if (has('orig_docs', 'to_buyer')) out.to_buyer ||= notBefore(val('to_buyer'), val('orig_docs'), 'JBAP Receipt of Documents');
  ['ewb_callout', 'ewb_signed', 'ewb_place'].forEach(k => { if (doas !== 'branch' && e[k]) out[k] = 'is only for sellers whose DOAS is signed at their branch (EWB)'; });
  ['rcv_doas', 'buyer_doas', 'seller_doas'].forEach(k => { if (doas === 'none' && e[k]) out[k] = 'does not apply: this seller has no DOAS'; });
  return out;
}
// [BEHAVIOR] Security Bond dates: not in the future, not before Buyer Paid, the transferred ORCR reaches JBAP before the seller; a bond is refunded or forfeited, not both
function bondValidate(r, e) {
  const val = k => (k in e ? e[k] : r[k]) || null, out = {};
  ['bond_orcr_jbap', 'bond_orcr_seller', 'bond_refund_jbap', 'bond_refund_buyer', 'bond_forfeited'].forEach(k => { out[k] = notFuture(val(k)) || notBefore(val(k), r.buyer_paid, 'Buyer Paid'); });
  out.bond_orcr_seller ||= notBefore(val('bond_orcr_seller'), val('bond_orcr_jbap'), 'JBAP Receipt of Transferred ORCR');
  if (val('bond_forfeited') && val('bond_refund_buyer')) out.bond_forfeited ||= 'cannot be filled when the buyer has received the refund';
  return out;
}
const EWB_NA = r => r.doas !== 'branch', NO_DOAS = r => r.doas === 'none';   // n/a cells on Document Monitoring
const AM_COLS = [C('Auction Number', 'auction', 'code'), C('Lot', 'lot', 'code'), C('Plate Number', 'plate', 'code'), C('Customer Name', 'customer', 'text', { w: 150 }),
  C('Seller', 'seller', 'code'), C('Status', 'status', 'status'), C('Result Price', 'price', 'money'), C('Awarding Date', 'awarding', 'date'), C('Buyer Paid', 'buyer_paid', 'date'),
  C('Payment to Seller', 'pay_seller', 'date'), C('Seller Acknowl\u00adedgement', 'seller_ack', 'date'), C('Dispatch Date', 'dispatch', 'date'), C('Release Date', 'release', 'date'),
  C('Receipt of DOAS', 'rcv_doas', 'date'), C('JBAP Receipt of Signed DOAS', 'buyer_doas', 'date'), C('Seller Receipt of Signed DOAS', 'seller_doas', 'date'),
  C('JBAP Receipt of Documents', 'orig_docs', 'date'), C('Buyer Receipt of Documents', 'to_buyer', 'date')];
const AM_FILTERS = [AUCTION_FILTER, { key: 'lot', label: 'Lot', type: 'text', w: 'w1' }, { key: 'plate', label: 'Plate Number' }, { key: 'customer', label: 'Customer Name' },
  { key: 'seller', label: 'Seller', type: 'select', options: sellerOpts }, { key: 'status', label: 'Status', type: 'select', options: () => ['Sold', 'Not Sold', 'Cancelled'] }];
const amTotals = rows => { const s = rows.filter(r => r.status === 'Sold'); return { customer: `${rows.length} lots, ${s.length} sold`, price: money(sumBy(s, 'price')) }; };
const RESULT_COLS = [C('Auction Number', 'auction', 'code'), C('Sold Units', 'units', 'int'), C('Total Awarded Price', 'total', 'money'), C('Average Price per Unit', 'avg', 'money'),
  C('Total Commission', 'comm', 'money'), C('Rebates', 'rebates', 'money'), C('Month', 'month', 'code')];
const resultTotals = rows => { const u = sumBy(rows, 'units'), t = sumBy(rows, 'total'); return { units: intf(u), total: money(t), avg: money(u ? t / u : 0), comm: money(sumBy(rows, 'comm')), rebates: money(sumBy(rows, 'rebates')) }; };
const UNREL_COLS = [C('Customer Name', 'customer', 'text', { w: 280 }), C('Auction No.', 'auction', 'code'), C('Make/Model', 'model', 'text', { w: 240 }), C('Plate Number', 'plate', 'code'),
  C('Location', 'location', 'code'), C('Dispatch Deadline', 'dispatch_deadline', 'date', { late: true }), C('Penalty', 'penalty', 'money')];
const UNREL_FILTERS = [AUCTION_FILTER, { key: 'customer', label: 'Customer Name' }, { key: 'plate', label: 'Plate Number' }, { key: 'dispatch_deadline', label: 'Dispatch Deadline', type: 'daterange', w: 'w2' }];
const REBMON_COLS = [   // SMD Rebate Monitoring (Access snapshot); FAD has its own columns from JBAP's Rebate Monitoring file
  C('Auction Date', 'adate', 'code'), C('Lot', 'lot', 'code'), C('Customer Name', 'customer', 'text', { w: 320 }), C('Plate', 'plate', 'code'),
  C('Rebate', 'rebate', 'money'), C('Buyer Paid', 'buyer_paid', 'date'), C('Rebate Paid', 'rebate_paid', 'date')];
const SCREENS = [
  // ===================== FAD =====================
  { dept: 'FAD', slug: 'pending-awarding', title: 'Pending Awarding', actions: VFSU, isNew: true,
    rule: 'Vehicles with status SOLD and a blank Awarding Date. Tick For BAAF and press Email BAAF to award. Transfer Fees come from the seller parameters and are not changed here (JBAP, 16 Oct 2026). Security Bond defaults from the seller settings; override it when needed. Rebate is entered here before the BAAF (proposal, Q73). Rebates are recommended by SMD and approved by the President (JBAP answer Q5); FAD types the approval date.',
    rows: () => sold().filter(v => !v.awarding), sort: ['lot', 'asc'],
    cols: [C('Auction Number', 'auction', 'code'), C('Lot', 'lot', 'code'), C('Customer Name', 'customer', 'text', { w: 230 }), C('For BAAF', 'for_baaf', 'check', { edit: 'check' }), C('Seller Approved', 'saaf_approved', 'date', { proposed: true, tag: 'P5' }),
      C('Awarding Date', 'awarding', 'date', { edit: 'date' }), C('Rebate', 'rebate', 'money', { edit: 'money', isNew: true }), C('Rebate Approved (President)', 'rebate_approved', 'date', { edit: 'date', isNew: true }), C('Seller', 'seller', 'code'), C('Plate Number', 'plate', 'code'),
      C('Make/Model', 'model', 'text', { w: 210 }), C('Result Price', 'price', 'money'), C('Transfer Fees', 'transfer_fee', 'money'), C('Security Bond', 'security_bond', 'money', { edit: 'money' })],
    filters: [AUCTION_FILTER, { key: 'seller', label: 'Seller', type: 'select', options: sellerOpts }, { key: 'customer', label: 'Customer Name' }, { key: 'plate', label: 'Plate Number' }],
    // [BEHAVIOR] JBAP feedback (19 Oct 2026, proposal Q73): the rebate is entered before the BAAF; 0 or more, not above the result price; blank = none
    // [BEHAVIOR] JBAP answer Q5: the approval date is checked when it, the rebate or the Awarding Date is in the edit (the saved values fill in the rest)
    validate: (r, e) => ({ awarding: notFuture(e.awarding) || notBefore(e.awarding, r.auction_end, 'the auction end'),
      security_bond: 'security_bond' in e && (e.security_bond === '' || Number(e.security_bond) < 0) ? 'must be 0 or more' : null,
      rebate: 'rebate' in e && e.rebate !== '' ? (Number(e.rebate) < 0 ? 'must be 0 or more' : r.price != null && Number(e.rebate) > r.price ? 'cannot be more than the result price' : null) : null,
      rebate_approved: notFuture(e.rebate_approved) || ('rebate' in e || 'rebate_approved' in e || e.awarding ? rebateApprovalError('rebate' in e ? e.rebate : r.rebate, 'rebate_approved' in e ? e.rebate_approved : r.rebate_approved, e.awarding) : null) }),
    buttons: [{ label: 'Email BAAF', kind: 'ol', icon: 'mail', act: 'emailBaaf', count: 'for_baaf' }, { label: 'Save changes', kind: 'pr', icon: 'save', act: 'save' }],
    savedNote: 'Vehicles with an Awarding Date moved to Unpaid.',
    queue: true, ready: { key: 'for_baaf', when: r => !!r.saaf_approved },
    ruleP: ['P4', 'Lots the seller approved (SAAF, recorded by SMD) arrive pre-ticked for BAAF; untick a lot to hold it back.'] },
  { dept: 'FAD', slug: 'unpaid', title: 'Unpaid', actions: VFSU, rule: 'Vehicles with status SOLD, an Awarding Date, and a blank Buyer Paid date. Total = Awarded price + Transfer fees + Security Bond (sellers with a bond). Buyer deadline = 3 working days after awarding.',
    rows: () => sold().filter(v => v.awarding && !v.buyer_paid), sort: ['buyer_deadline', 'asc'],
    cols: [C('Auction Number', 'auction', 'code'), C('Lot', 'lot', 'code'), C('Customer Name', 'customer', 'text', { w: 230 }), C('Buyer ID', 'cid', 'code'), C('Seller', 'seller', 'code'),
      C('Make/Model', 'model', 'text', { w: 200 }), C('Plate Number', 'plate', 'code'), C('Total (Awarded Price + Transfer Fees + Security Bond)', 'total', 'money'),
      C('Buyer Paid', 'buyer_paid', 'date', { edit: 'date' }), C('Buyer Deadline', 'buyer_deadline', 'date', { late: true })],
    filters: [AUCTION_FILTER, { key: 'seller', label: 'Seller', type: 'select', options: sellerOpts }, { key: 'customer', keys: ['customer', 'cid'], label: 'Customer Name / Buyer ID', w: 'w2' }, { key: 'plate', label: 'Plate Number' }],
    totals: rows => ({ total: money(sumBy(rows, 'total')) }),
    validate: (r, e) => ({ buyer_paid: notFuture(e.buyer_paid) || notBefore(e.buyer_paid, r.awarding, 'the Awarding Date') }),
    buttons: [{ label: 'Save changes', kind: 'pr', icon: 'save', act: 'save' }],
    savedNote: 'Paid vehicles moved to Payment Seller.' },
  { dept: 'FAD', slug: 'payment-seller', title: 'Payment Seller', actions: VFSU, isNew: true, rule: 'Vehicles with status SOLD, a Buyer Paid date, and a blank Payment to Seller date. Deadline = 3 working days after Buyer Paid. To JBAP = commission + VAT − 15% withholding tax (NET sellers); Payable to Seller = total − To JBAP. Printing records the payment date on every printed lot (JBAP, 19 Oct 2026).',
    rows: () => sold().filter(v => v.buyer_paid && !v.pay_seller), sort: ['pay_deadline', 'asc'],
    cols: [C('Seller', 'seller', 'code'), C('Customer Name', 'customer', 'text', { w: 230 }), C('Auction No.', 'auction', 'code'), C('Plate Number', 'plate', 'code'),
      C('Total (Awarded Price + Transfer Fees + Security Bond)', 'total', 'money'), C('To JBAP', 'to_jbap', 'money'), C('Payable to Seller', 'payable', 'money'), C('Payment to Seller Date', 'pay_seller', 'date', { edit: 'date' }), C('Payment Voucher No.', 'voucher_no', 'text', { edit: 'text', proposed: true, tag: 'P3' }),
      C('Payment to Seller Deadline', 'pay_deadline', 'date', { late: true }), C('Print Payment to Seller', 'print_seller', 'check', { edit: 'check' })],
    filters: [{ key: 'seller', label: 'Seller', type: 'select', options: sellerOpts }, AUCTION_FILTER, { key: 'customer', label: 'Customer Name' }, { key: 'plate', label: 'Plate Number' }],
    totals: rows => ({ total: money(sumBy(rows, 'total')), to_jbap: money(sumBy(rows, 'to_jbap')), payable: money(sumBy(rows, 'payable')) }),
    validate: (r, e) => ({ pay_seller: notFuture(e.pay_seller) || notBefore(e.pay_seller, r.buyer_paid, 'Buyer Paid') }),
    buttons: [{ label: 'Record payment date & print', kind: 'ol', icon: 'print', act: 'printSeller', count: 'print_seller', isNew: true }, { label: 'Save changes', kind: 'pr', icon: 'save', act: 'save' }],
    savedNote: 'Paid sellers moved to Seller Acknowledgement and Commission Billing.',
    queue: true, ready: { key: 'print_seller', when: () => true },
    ruleP: ['P4', 'Every lot arrives pre-ticked for printing; untick a lot to hold it back. Payment Voucher No. (P3) is typed for now; it will come through JBAP\'s existing NOAH integration once it is re-routed from Access to CDMS.'] },
  { dept: 'FAD', slug: 'seller-acknowledgement', title: 'Seller Acknowledgement', actions: VFSU,
    rule: 'Vehicles with status SOLD, Buyer Paid and Payment to Seller filled in, and a blank Seller Acknowledgement date.',
    rows: () => sold().filter(v => v.pay_seller && !v.seller_ack), sort: ['pay_deadline', 'asc'],
    cols: [C('Seller', 'seller', 'code'), C('Customer Name', 'customer', 'text', { w: 260 }), C('Buyer ID', 'cid', 'code'), C('Plate Number', 'plate', 'code'),
      C('Seller Acknowledgement Date', 'seller_ack', 'date', { edit: 'date' }), C('Payment to Seller Deadline', 'pay_deadline', 'date')],
    filters: [{ key: 'seller', label: 'Seller', type: 'select', options: sellerOpts }, { key: 'customer', label: 'Customer Name' }, { key: 'plate', label: 'Plate Number' }],
    validate: (r, e) => ({ seller_ack: notFuture(e.seller_ack) || notBefore(e.seller_ack, r.pay_seller, 'Payment to Seller') }),
    buttons: [{ label: 'Save changes', kind: 'pr', icon: 'save', act: 'save' }], savedNote: 'Acknowledged vehicles removed from the list.' },
  { dept: 'FAD', slug: 'for-dispatch', title: 'For Dispatch', actions: VFSU,
    rule: 'Vehicles with status SOLD and a blank Dispatch Date whose seller condition is met: Buyer Payment and DOAS sellers after Buyer Paid, other sellers after Seller Acknowledgement (Dispatch Condition per seller). DOAS sellers need the signed DOAS before release. Buyer must release within 3 working days after dispatch.',
    rows: () => sold().filter(v => !v.dispatch && dispatchReady(v)), sort: ['auction_lot', 'asc'],
    cols: [C('Seller', 'seller', 'code'), C('Customer Name', 'customer', 'text', { w: 230 }), C('Auction No.', 'auction', 'code'),
      C('Make/Model', 'model', 'text', { w: 190 }), C('Plate Number', 'plate', 'code'), C('Buyer Paid', 'buyer_paid', 'date'), C('Release Condition', 'release_cond', 'text', { w: 220 }),
      C('For Dispatch Email?', 'for_dispatch_email', 'check', { edit: 'check' }), C('Dispatch Date', 'dispatch', 'date', { edit: 'date' })],
    filters: [{ key: 'seller', label: 'Seller', type: 'select', options: sellerOpts }, AUCTION_FILTER, { key: 'customer', label: 'Customer Name' }, { key: 'plate', label: 'Plate Number' }],
    validate: (r, e) => ({ dispatch: notFuture(e.dispatch) || (releaseOf(r) === 'ack' ? notBefore(e.dispatch, r.seller_ack, 'Seller Acknowledgement') : notBefore(e.dispatch, r.buyer_paid, 'Buyer Paid')) }),
    buttons: [{ label: 'Email dispatch form', kind: 'ol', icon: 'mail', act: 'emailDispatch', count: 'for_dispatch_email' }, { label: 'Save changes', kind: 'pr', icon: 'save', act: 'save' }], savedNote: 'Dispatched vehicles moved to Unreleased Unit (FAD and VWD).',
    queue: true, ready: { key: 'for_dispatch_email', when: () => true },
    ruleP: ['P4', 'Every lot arrives pre-ticked for the dispatch email; untick a lot to hold it back. The email is copied to Finance only (P5): VWD sees the lot in its own list.'] },
  { dept: 'FAD', slug: 'document-monitoring', title: 'Document Monitoring', actions: VFSU,
    rule: `Every sold or cancelled lot, in the columns of JBAP's Documents Monitoring sheet. Status is the furthest step reached: Pending Payment (seller not paid yet), Pending DOAS, DOAS for Signing, Pending Documents (signed DOAS back), For Releasing (documents at JBAP), Complete (documents with the buyer) or Cancelled. EWB buyers sign the DOAS at EWB's HO or store; TFS has no DOAS (n/a). Aging counts working days while a step waits. The Open view hides Complete and Cancelled lots.`,
    rows: () => V().filter(v => v.status === 'Sold' || v.status === 'Cancelled'), sort: ['auction_lot', 'asc'],
    cols: [C('Auction No.', 'auction', 'code'), C('Lot', 'lot', 'code'), C('Customer Name', 'customer', 'text', { w: 190 }), C('Seller', 'seller', 'code'), C('Plate Number', 'plate', 'code'),
      C('Seller Payment', 'pay_seller', 'date'),
      C('EWB Call Out', 'ewb_callout', 'date', { edit: 'date', na: EWB_NA }), C('Date DOAS Signed (EWB)', 'ewb_signed', 'date', { edit: 'date', na: EWB_NA }), C('EWB HO/Store', 'ewb_place', 'text', { edit: 'text', na: EWB_NA }),
      C('Receipt of DOAS', 'rcv_doas', 'date', { edit: 'date', na: NO_DOAS }), C('DOAS Aging', 'doas_aging', 'int', { na: NO_DOAS }),
      C('JBAP Receipt of Signed DOAS', 'buyer_doas', 'date', { edit: 'date', na: NO_DOAS }), C('Seller Receipt of Signed DOAS', 'seller_doas', 'date', { edit: 'date', na: NO_DOAS }),
      C('JBAP Receipt of Documents', 'orig_docs', 'date', { edit: 'date' }), C('Buyer Receipt of Documents', 'to_buyer', 'date', { edit: 'date' }), C('Docs Aging', 'docs_aging', 'int'),
      C('Status', 'doc_status', 'text', { w: 130 }), C('Remarks', 'doc_remarks', 'text', { edit: 'text' }),
      C('ATF No.', 'atf_no', 'code'), C('Print Transmittal?', 'print_doc_trans', 'check', { edit: 'check' })],
    filters: [{ key: 'doc_status', label: 'Status', type: 'select', options: () => ['Open', ...DOC_STATUSES], match: (r, v) => (v === 'Open' ? !['Complete', 'Cancelled'].includes(r.doc_status) : r.doc_status === v) },
      AUCTION_FILTER, { key: 'seller', label: 'Seller', type: 'select', options: sellerOpts }, { key: 'customer', label: 'Customer Name' }, { key: 'plate', label: 'Plate Number' }],
    initial: { doc_status: 'Open' },
    validate: docValidate,
    buttons: [{ label: 'Print document transmittal', kind: 'ol', icon: 'print', act: 'printDocTrans', count: 'print_doc_trans' }, { label: 'Save changes', kind: 'pr', icon: 'save', act: 'save' }], savedNote: 'Complete lots leave the Open view.',
    queue: true, ready: { key: 'print_doc_trans', when: r => r.doc_status === 'For Releasing' && !r.atf_no },
    ruleP: ['P4', 'Lots whose documents are at JBAP (For Releasing) and have no ATF No. yet arrive pre-ticked.'] },
  // JBAP feedback (15 Oct 2026): the Security Bond billed with the vehicle, monitored like the bid bond until refund or forfeiture (JBAP's Security Bond sheet)
  { dept: 'FAD', slug: 'security-bond', title: 'Security Bond', actions: VFSU, tag: 'Wish',
    rule: 'Paid lots with a security bond (seller setting, or the amount set at Pending Awarding). The buyer transfers the ORCR; once the seller has it, the bond is refunded. Status is the furthest step reached: Pending Documents, Waiting ORCR (the buyer has the documents), Pending Refund (the seller has the transferred ORCR, or JBAP has the refund), Complete (buyer refunded) or Forfeited. The Open view hides Complete and Forfeited.',
    rows: () => sold().filter(v => v.security_bond > 0 && v.buyer_paid), sort: ['auction_lot', 'asc'],
    cols: [C('Auction No.', 'auction', 'code'), C('Lot', 'lot', 'code'), C('Seller', 'seller', 'code'), C('Customer Name', 'customer', 'text', { w: 190 }), C('Make/Model', 'model', 'text', { w: 170 }),
      C('Plate Number', 'plate', 'code'), C('Security Bond', 'security_bond', 'money'), C('JBAP Receipt of Documents', 'orig_docs', 'date'), C('Buyer Receipt of Documents', 'to_buyer', 'date'),
      C('JBAP Receipt of Transferred ORCR', 'bond_orcr_jbap', 'date', { edit: 'date' }), C('Seller Receipt of Transferred ORCR', 'bond_orcr_seller', 'date', { edit: 'date' }),
      C('JBAP Receipt of Refund / Seller Confirmation', 'bond_refund_jbap', 'date', { edit: 'date' }), C('Buyer Receipt of Refund', 'bond_refund_buyer', 'date', { edit: 'date' }),
      C('Refund Via', 'bond_refund_via', 'text', { edit: 'select', options: REFUND_VIA }), C('Forfeited', 'bond_forfeited', 'date', { edit: 'date' }),
      C('Status', 'bond_status', 'text', { w: 130 }), C('Remarks', 'bond_remarks', 'text', { edit: 'text' })],
    filters: [{ key: 'bond_status', label: 'Status', type: 'select', options: () => ['Open', ...BOND_STATUSES], match: (r, v) => (v === 'Open' ? !['Complete', 'Forfeited'].includes(r.bond_status) : r.bond_status === v) },
      AUCTION_FILTER, { key: 'seller', label: 'Seller', type: 'select', options: sellerOpts }, { key: 'customer', label: 'Customer Name' }, { key: 'plate', label: 'Plate Number' }],
    initial: { bond_status: 'Open' },
    totals: rows => ({ plate: `${rows.length} lots`, security_bond: money(sumBy(rows, 'security_bond')) }),
    validate: bondValidate,
    buttons: [{ label: 'Save changes', kind: 'pr', icon: 'save', act: 'save' }], savedNote: 'Complete and forfeited bonds leave the Open view.' },
  { dept: 'FAD', slug: 'unreleased-unit', title: 'Unreleased Unit', actions: VFSU, isNew: true,
    rule: `Dispatched vehicles not yet released to the buyer. Storage penalty PHP ${PENALTY_PER_DAY}/day after the dispatch deadline, only for units at ${PENALTY_LOCATIONS.join(' or ')} (Q15). Record payment records the penalty paid today and moves the dispatch deadline to today (JBAP, 16 Oct 2026); the penalty starts again the next day if the unit is still in the yard. Extend sets a new deadline with a reason and the approving FAD Manager (proposal, Q74).`,
    rows: () => sold().filter(v => v.dispatch && !v.release), sort: ['dispatch_deadline', 'asc'],
    cols: [...UNREL_COLS, C('Penalty Paid', 'penalty_paid', 'money'), C('Penalty Payment', 'id', 'rowbtn', { act: 'payPenalty', btn: 'Record payment', showWhen: r => r.penalty > 0 }),
      C('Extend Deadline', 'extend', 'rowbtn', { act: 'extendDeadline', btn: 'Extend', isNew: true })], filters: UNREL_FILTERS,
    totals: rows => ({ penalty: money(sumBy(rows, 'penalty')), penalty_paid: money(sumBy(rows, 'penalty_paid')) }) },
  { dept: 'FAD', slug: 'liability-to-seller', title: 'Liability to Seller', actions: VS, layout: 'query',
    rule: 'Units the buyer has paid for where Payment to Seller is still blank, or happened after the date entered.',
    rows: () => { const d = U('FAD/liability-to-seller').asOf || TODAY; return sold().filter(v => v.buyer_paid && v.buyer_paid <= d && (!v.pay_seller || v.pay_seller > d)); },
    sort: ['seller', 'asc'],
    cols: [C('Seller', 'seller', 'code'), C('Auction No.', 'auction', 'code'), C('Lot', 'lot', 'code'), C('Customer Name', 'customer', 'text', { w: 250 }),
      C('Plate Number', 'plate', 'code'), C('Buyer Paid', 'buyer_paid', 'date'), C('Payment to Seller Deadline', 'pay_deadline', 'date'), C('Total (Result Price + Transfer Fees + Security Bond)', 'total', 'money')],
    totals: rows => ({ seller: 'Total liability to sellers', total: money(sumBy(rows, 'total')) }) },
  // FAD › Rebate: Rebate Monitoring and Rebate Payable as two tabs (user request of 16 Oct 2026); SMD keeps its own Rebate Monitoring
  // The key columns of JBAP's Rebate Monitoring file (user choice of 16 Oct 2026); Month, VCN, Year, Color, Buyer ID and Awarded Price stay in the download only
  { dept: 'FAD', slug: 'rebate-monitoring', title: 'Rebate Monitoring', group: 'Rebate', actions: VS,
    rule: 'Result price records with status SOLD and a rebate. Minimum Bid = Awarded Price, Highest Offer = Minimum Bid − Rebate, Revenue = Commission − Rebate (JBAP\'s Rebate Monitoring file). Download report saves an Excel file of the rebates in an auction range with all the file\'s columns.',
    rows: () => sold().filter(v => v.rebate), sort: ['auction_lot', 'desc'],
    cols: [C('Auction No.', 'auction', 'code'), C('Lot', 'lot', 'code'), C('Plate Number', 'plate', 'code'), C('Make/Model', 'model', 'text', { w: 180 }), C('Seller', 'seller', 'code'),
      C('Buyer', 'customer', 'text', { w: 220 }), C('Minimum Bid', 'min_bid', 'money'), C('Highest Offer', 'highest_offer', 'money'), C('Rebate', 'rebate', 'money'), C('Rebate Approved (President)', 'rebate_approved', 'date', { isNew: true }),
      C('Commission', 'com', 'money'), C('Revenue (Net of Rebate)', 'rebate_revenue', 'money'), C('Date Remitted', 'rebate_paid', 'date')],
    totals: rows => ({ plate: `${rows.length} lots`, rebate: money(sumBy(rows, 'rebate')), com: money(sumBy(rows, 'com')), rebate_revenue: money(sumBy(rows, 'rebate_revenue')) }),
    buttons: [{ label: 'Download report', kind: 'ol', icon: 'download', act: 'downloadRebate', view: true }] },   // view: shown on a view-only screen (it changes no data)
  { dept: 'FAD', slug: 'rebate-payable', title: 'Rebate Payable', group: 'Rebate', actions: VSU, rule: 'Result price records with status SOLD, a rebate, a Buyer Paid date, and a blank Rebate Paid date.',
    rows: () => sold().filter(v => v.rebate && v.buyer_paid && !v.rebate_paid), sort: ['adate', 'asc'],
    cols: [C('Auction Date', 'adate', 'code'), C('Lot', 'lot', 'code'), C('Customer Name', 'customer', 'text', { w: 360 }), C('Rebate', 'rebate', 'money'),
      C('Buyer Paid', 'buyer_paid', 'date'), C('Rebate Paid', 'rebate_paid', 'date', { edit: 'date' })],
    totals: rows => ({ rebate: money(sumBy(rows, 'rebate')) }),
    validate: (r, e) => ({ rebate_paid: notFuture(e.rebate_paid) || notBefore(e.rebate_paid, r.buyer_paid, 'Buyer Paid') }),
    buttons: [{ label: 'Save changes', kind: 'pr', icon: 'save', act: 'save' }], savedNote: 'Paid rebates removed from the list.' },
  // FAD › Billing: Commission Billing first, then Billing Monitoring and Unpaid Billing (tabs in this order; user requests of 15 and 16 Oct 2026)
  { dept: 'FAD', slug: 'commission-billing', title: 'Commission Billing', group: 'Billing', actions: VSU, isNew: true,
    rule: 'Result price records with a Remittance Date and no commission billing yet. Tick Print?, then Print commission billing to record the NOAH billing number and date.',
    rows: () => sold().filter(v => v.pay_seller && !v.billed), sort: ['customer', 'asc'],
    cols: [C('Customer Name', 'customer', 'text', { w: 260 }), C('Seller', 'seller', 'code'), C('Auction No.', 'auction', 'code', { isNew: true }), C('Auction Date', 'adate', 'code'), C('Plate Number', 'plate', 'code'), C('Print?', 'print_comm', 'check', { edit: 'check' }), C('Remittance Date', 'pay_seller', 'date'),
      C('Winning Bid', 'price', 'money'), C('Commission', 'com', 'money'), C('VAT', 'cvat', 'money'), C('Total', 'ctotal', 'money')],
    totals: rows => ({ plate: `${rows.length} units`, price: money(sumBy(rows, 'price')), com: money(sumBy(rows, 'com')), cvat: money(sumBy(rows, 'cvat')), ctotal: money(sumBy(rows, 'ctotal')) }),
    buttons: [{ label: 'Print commission billing', kind: 'ol', icon: 'print', act: 'printComm', count: 'print_comm' }, { label: 'Save changes', kind: 'pr', icon: 'save', act: 'save' }],
    queue: true, ready: { key: 'print_comm', when: () => true },
    ruleP: ['P4', 'Every lot arrives pre-ticked. Printing records one billing per seller in one go, each with its own NOAH billing number (P3: typed until JBAP\'s NOAH integration is re-routed to CDMS).'] },
  { dept: 'FAD', slug: 'billing-monitoring', title: 'Billing Monitoring', group: 'Billing', actions: VSU, rule: 'All records from the billing table. New commission billings appear here after printing. Tick Print Transmittal? and print the billing transmittal to record the Transmittal Date.',
    rows: B, sort: ['bdate', 'desc'],
    cols: [C('Billing #', 'no', 'code'), C('Customer', 'customer', 'text', { w: 320 }), C('Auction Date / Particulars', 'particular', 'text', { w: 230 }), C('Billing Date', 'bdate', 'date'), C('Total', 'total', 'money'),
      C('Transmittal Date', 'trans', 'date'), C('Print Transmittal?', 'print_trans', 'check', { edit: 'check' })],
    buttons: [{ label: 'Print billing transmittal', kind: 'ol', icon: 'print', act: 'printTransmittal', count: 'print_trans' }, { label: 'Save changes', kind: 'pr', icon: 'save', act: 'save' }],
    queue: true, ready: { key: 'print_trans', when: r => !r.trans },
    ruleP: ['P4', 'Billings with no Transmittal Date arrive pre-ticked.'] },
  { dept: 'FAD', slug: 'unpaid-billing', title: 'Unpaid Billing', group: 'Billing', actions: VSU, rule: `Billing records with a blank Payment Date. Due date = billing date + ${BILL_DUE_DAYS} days.`,
    rows: () => B().filter(b => !b.pay), sort: ['bdate', 'asc'],
    cols: [C('Customer', 'customer', 'text', { w: 240 }), C('Auction Date / Particulars', 'particular', 'text', { w: 180 }), C('Billing Date', 'bdate', 'date'), C('Bill Amount', 'bill', 'money'),
      C('VAT', 'vat', 'money'), C('Total', 'total', 'money'), C('Transmittal Date', 'trans', 'date'), C('Due Date', 'due', 'date', { late: true }),
      C('Payment Date', 'pay', 'date', { edit: 'date' }), C('Collection Receipt', 'cr', 'text', { edit: 'text', tag: 'P3' })],
    validate: (r, e) => { const p = 'pay' in e ? e.pay : r.pay, cr = 'cr' in e ? e.cr : r.cr;
      return { pay: notFuture(p) || notBefore(p, r.bdate, 'the Billing Date') || (!p && cr ? 'is required with a Collection Receipt' : null), cr: p && !cr ? 'is required with a Payment Date' : null }; },
    buttons: [{ label: 'Save changes', kind: 'pr', icon: 'save', act: 'save' }], savedNote: 'Paid billings removed from the list.',
    ruleP: ['P3', 'Collection Receipt is typed for now; it will come through JBAP\'s existing NOAH integration once it is re-routed from Access to CDMS.'] },
  // JBAP feedback (16 Oct 2026, #14): the list under the entry form replaces the FAD and SMD Cancellation Monitoring; Report › Cancellation Monitoring (19 Oct 2026) lists the same cancellations for everyone
  { dept: 'FAD', slug: 'cancellation-entry', title: 'Cancellation Entry', actions: VFSU, layout: 'entry', queue: () => cdmsCancelsPending().length,
    rule: 'Enter the Auction No. and Lot to find the transaction, then record the cancellation. The list below shows every cancellation with its billing and payment dates.',
    ruleP: ['P2', 'Lots already cancelled in CDMS wait at the top: add the waiver decision and Confirm. The record and the penalty billing are the same as for a cancellation entered here.'],
    rows: CX, sort: ['dcancel', 'desc'],
    cols: [C('Auction No.', 'auction', 'code'), C('Lot', 'lot', 'code'), C('Customer Name', 'customer', 'text', { w: 230 }), C('Buyer ID', 'cid', 'code'), C('Plate Number', 'plate', 'code'),
      C('Date Cancelled', 'dcancel', 'date'), C('Waived?', 'waived', 'rocheck'), C('Justification', 'just', 'text', { w: 260 }), C('Billing Date', 'bill_date', 'date'),
      C('Date Paid', 'paid_date', 'date'), C('Cancellation Fee Remitted', 'remitted', 'date')],
    filters: [AUCTION_FILTER, { key: 'customer', keys: ['customer', 'cid'], label: 'Customer Name / Buyer ID', w: 'w2' }, { key: 'plate', label: 'Plate Number' },
      { key: 'waived', label: 'Waived', type: 'select', w: 'w1', options: () => ['Yes', 'No'], match: (r, v) => (v === 'Yes') === !!r.waived }] },
  // JBAP feedback (16 Oct 2026, #13): Cancellation Billing and Cancellation Payment in one screen
  { dept: 'FAD', slug: 'cancellation-billing', title: 'Cancellation Billing & Payment', actions: VSU,
    rule: 'Cancelled lots with the fee not waived and no Date Paid. Penalty PHP 10,000 per lot: PHP 5,000 to the seller and PHP 5,000 to JBAP (EWB: all to JBAP). Tick For Print? and print to bill: printing records the Billing Date and the amount due. When the buyer pays, enter Date Paid (and Amount) and save; paid lots leave the list.',
    rows: () => CX().filter(c => !c.waived && !c.paid_date), sort: ['auction', 'desc'],
    cols: [C('Auction No.', 'auction', 'code'), C('Plate', 'plate', 'code'), C('Customer Name', 'customer', 'text', { w: 260 }), C('Date Cancelled', 'dcancel', 'date'),
      C('Penalty', 'penalty', 'money'), C('To Seller', 'pen_seller', 'money'), C('To JBAP', 'pen_jbap', 'money'),
      C('For Print?', 'for_print', 'check', { edit: 'check', lockWhen: r => !!r.bill_date }), C('Billing Date', 'bill_date', 'date'),
      C('Date Paid', 'paid_date', 'date', { edit: 'date', lockWhen: r => !r.bill_date }), C('Amount', 'amount', 'money', { edit: 'money', lockWhen: r => !r.bill_date })],
    totals: rows => ({ penalty: money(sumBy(rows, 'penalty')), pen_seller: money(sumBy(rows, 'pen_seller')), pen_jbap: money(sumBy(rows, 'pen_jbap')) }),
    validate: (r, e) => { const d = 'paid_date' in e ? e.paid_date : r.paid_date, a = 'amount' in e ? e.amount : r.amount;
      return { paid_date: notFuture(d) || notBefore(d, r.bill_date, 'the Billing Date') || (!d && a && 'amount' in e ? 'is required with an Amount' : null), amount: d && !(Number(a) > 0) ? 'must be more than 0' : null }; },
    buttons: [{ label: 'Print cancellation billing', kind: 'ol', icon: 'print', act: 'printCancel', count: 'for_print' }, { label: 'Save changes', kind: 'pr', icon: 'save', act: 'save' }],
    savedNote: 'Paid cancellations removed from the list.',
    queue: true, ready: { key: 'for_print', when: r => !r.bill_date },
    ruleP: ['P4', 'Lots not billed yet arrive pre-ticked for billing.'] },
  // JBAP feedback (19 Oct 2026) / proposal Q76: the FAD Manager approves what the SMD Manager approved; VWD then records the return
  { dept: 'FAD', slug: 'return-approval', title: 'Return to Seller Approval', actions: VFSU, isNew: true, queue: true,
    rule: 'Units the SMD Manager approved for return to the seller. The FAD Manager enters the approval date and saves; VWD then records the return (proposal, Q76).',
    rows: () => V().filter(v => v.rts_cleared && v.rts_smd_ok && !v.rts_fad_ok && !v.release).map(v => Object.assign(v, { listings: listingsOf(v) })), sort: ['rts_smd_ok', 'asc'],
    cols: [C('Seller', 'seller', 'code'), C('Plate Number', 'plate', 'code'), C('Make/Model', 'model', 'text', { w: 220 }), C('Status', 'status', 'status'), C('Last Auction', 'auction', 'code'),
      C('Number of Listing', 'listings', 'int'), C('Cleared by SMD', 'rts_cleared', 'date'), C('SMD Manager Approved', 'rts_smd_ok', 'date'), C('FAD Manager Approved', 'rts_fad_ok', 'date', { edit: 'date' })],
    filters: [{ key: 'seller', label: 'Seller', type: 'select', options: sellerOpts }, { key: 'plate', label: 'Plate Number' }],
    validate: (r, e) => ({ rts_fad_ok: notFuture(e.rts_fad_ok) || notBefore(e.rts_fad_ok, r.rts_smd_ok, 'the SMD Manager approval') }),
    buttons: [{ label: 'Save changes', kind: 'pr', icon: 'save', act: 'save' }], savedNote: 'Approved units moved to VWD › For Return to Seller.' },

  // ===================== SMD (legacy sample data on Pending Awarding, Unpaid, Seller Acknowledgement, For Dispatch and Rebate Monitoring; live data on Unreleased Unit, Return to Seller, SMD Manager Approval and SAAF) =====================
  // P5 (switch on): SMD's update screen for the SAAF; live data, unlike SMD's five legacy-sample screens
  { dept: 'SMD', slug: 'saaf', title: 'Seller Awarding Acknowledgement', actions: VFSU, proposed: true, tag: 'P5',
    rule: 'Sold lots with no Awarding Date (live data; Pending Awarding, Unpaid, Seller Acknowledgement, For Dispatch and Rebate Monitoring in SMD still show the legacy sample). Tick For SAAF and press Email SAAF: one email per seller from sales@. Enter Seller Approved when the seller replies; approved lots arrive pre-ticked in FAD Pending Awarding.',
    rows: () => sold().filter(v => !v.awarding), sort: ['seller', 'asc'],
    cols: [C('Seller', 'seller', 'code'), C('Auction No.', 'auction', 'code'), C('Lot', 'lot', 'code'), C('Plate Number', 'plate', 'code'), C('Make/Model', 'model', 'text', { w: 220 }),
      C('Awarded Price', 'price', 'money'), C('For SAAF', 'for_saaf', 'check', { edit: 'check', disabledWhen: r => !!r.saaf_approved }), C('SAAF Sent', 'saaf_sent', 'date'), C('Seller Approved', 'saaf_approved', 'date', { edit: 'date' })],
    filters: [AUCTION_FILTER, { key: 'seller', label: 'Seller', type: 'select', options: sellerOpts }, { key: 'plate', label: 'Plate Number' }],
    validate: (r, e) => ({ saaf_approved: notFuture(e.saaf_approved) || (e.saaf_approved && !r.saaf_sent ? 'needs the SAAF to be sent first' : notBefore(e.saaf_approved, r.saaf_sent, 'SAAF Sent')) }),
    buttons: [{ label: 'Email SAAF', kind: 'ol', icon: 'mail', act: 'emailSaaf', count: 'for_saaf' }, { label: 'Save changes', kind: 'pr', icon: 'save', act: 'save' }],
    savedNote: 'Approved lots are ready in FAD Pending Awarding.',
    queue: true, ready: { key: 'for_saaf', when: r => !r.saaf_sent } },
  { dept: 'SMD', slug: 'pending-awarding', title: 'Pending Awarding', actions: VFS, rule: 'Vehicles with status SOLD and a blank Awarding Date.',
    rows: () => SMD('pending'), sort: ['customer', 'asc'],
    cols: [C('Auction Number', 'auction', 'code'), C('Lot', 'lot', 'code'), C('Customer Name', 'customer', 'text', { w: 200 }), C('For BAAF', 'for_baaf', 'rocheck'),
      C('Awarding Date', 'awarding', 'date'), C('Rebate', 'rebate', 'money'), C('Seller', 'seller', 'code'), C('Plate Number', 'plate', 'code'),
      C('Make/Model', 'model', 'text', { w: 230 }), C('Result Price', 'price', 'money'), C('Transfer Fees', 'tfee', 'money')],
    filters: [AUCTION_FILTER, { key: 'seller', label: 'Seller', type: 'select', options: () => [...new Set(SMD('pending').map(r => r.seller))].sort() }, { key: 'customer', label: 'Customer Name' }, { key: 'plate', label: 'Plate Number' }] },
  { dept: 'SMD', slug: 'unpaid', title: 'Unpaid', actions: VFS, rule: 'Vehicles with status SOLD, an Awarding Date, and a blank Buyer Paid date. Total = Awarded price + Transfer fees.',
    rows: () => SMD('unpaid'), sort: ['buyer_deadline', 'asc'],
    cols: [C('Auction Number', 'auction', 'code'), C('Lot', 'lot', 'code'), C('Customer Name', 'customer', 'text', { w: 220 }), C('Buyer ID', 'cid', 'code'), C('Seller', 'seller', 'code'),
      C('Make/Model', 'model', 'text', { w: 210 }), C('Plate Number', 'plate', 'code'), C('Total (Awarded Price + Transfer Fees)', 'total', 'money'), C('Buyer Paid', 'buyer_paid', 'date'),
      C('Buyer Deadline', 'buyer_deadline', 'date', { late: true })],
    filters: [AUCTION_FILTER, { key: 'seller', label: 'Seller', type: 'select', options: () => [...new Set(D.smd.unpaid.map(r => r.seller))] }, { key: 'customer', keys: ['customer', 'cid'], label: 'Customer Name / Buyer ID', w: 'w2' }, { key: 'plate', label: 'Plate Number' }],
    totals: rows => ({ customer: `${rows.length} units`, total: money(sumBy(rows, 'total')) }) },
  { dept: 'SMD', slug: 'seller-acknowledgement', title: 'Seller Acknowledgement', actions: VFS,
    rule: 'Vehicles with status SOLD, Buyer Paid and Payment to Seller filled in, and a blank Seller Acknowledgement date.',
    rows: () => SMD('ack'), sort: ['seller', 'asc'],
    cols: [C('Seller', 'seller', 'code'), C('Customer Name', 'customer', 'text', { w: 260 }), C('Buyer ID', 'cid', 'code'), C('Plate Number', 'plate', 'code'),
      C('Seller Acknowledgement Date', 'seller_ack', 'date'), C('Payment to Seller Deadline', 'pay_deadline', 'date')],
    filters: [{ key: 'customer', label: 'Customer Name' }, { key: 'plate', label: 'Plate Number' }] },
  { dept: 'SMD', slug: 'for-dispatch', title: 'For Dispatch', actions: VFS,
    rule: 'Vehicles with status SOLD, Buyer Paid, Payment to Seller and Seller Acknowledgement filled in, and a blank Dispatch Date.',
    rows: () => SMD('dispatch'), sort: ['customer', 'asc'],
    cols: [C('Seller', 'seller', 'code'), C('Customer Name', 'customer', 'text', { w: 250 }), C('Auction No.', 'auction', 'code'),
      C('Make/Model', 'model', 'text', { w: 210 }), C('Plate Number', 'plate', 'code'), C('Buyer Paid', 'buyer_paid', 'date'), C('Dispatch Date', 'dispatch', 'date')],
    filters: [{ key: 'customer', label: 'Customer Name' }, { key: 'plate', label: 'Plate Number' }], totals: rows => ({ customer: `${rows.length} units` }) },
  { dept: 'SMD', slug: 'unreleased-unit', title: 'Unreleased Unit', actions: VFS, isNew: true,
    rule: 'Dispatched vehicles not yet released to the buyer (live data, the same list as FAD; JBAP, 19 Oct 2026). Storage penalty after the dispatch deadline. View, filter and sort only.',
    rows: () => sold().filter(v => v.dispatch && !v.release), sort: ['dispatch_deadline', 'asc'],
    cols: [...UNREL_COLS.map(c => c.key === 'location' ? Object.assign({}, c, { isNew: true }) : c), C('Penalty Paid', 'penalty_paid', 'money', { isNew: true })], filters: UNREL_FILTERS,   // Location is new to SMD only: an SMD copy carries the mark, FAD and VWD share the unmarked column
    totals: rows => ({ penalty: money(sumBy(rows, 'penalty')), penalty_paid: money(sumBy(rows, 'penalty_paid')) }) },
  { dept: 'SMD', slug: 'rebate-monitoring', title: 'Rebate Monitoring', actions: VS, rule: 'Result price records with status SOLD and a rebate.',
    rows: () => SMD('rebates'), cols: REBMON_COLS, sort: ['buyer_paid', 'desc'] },
  { dept: 'SMD', slug: 'return-to-seller', title: 'Return to Seller', group: 'Return to Seller', actions: VFSU, tag: 'Wish', isNew: true,
    rule: `Units with status Not Sold or Cancelled that are not listed in an ongoing or future auction (JBAP, 16 Oct 2026), with no clearance yet. Tick For Return, then Print & email clearance form: one form per seller, emailed to FAD and VWD. Then the SMD Manager and the FAD Manager approve in CDMS (proposal, Q76); VWD sees the unit after the FAD approval.`,
    rows: () => V().filter(rtsEligible).map(v => Object.assign(v, { listings: listingsOf(v) })), sort: ['seller', 'asc'],
    cols: [C('Seller', 'seller', 'code'), C('Plate Number', 'plate', 'code'), C('Make/Model', 'model', 'text', { w: 220 }), C('Status', 'status', 'status'), C('Last Auction', 'auction', 'code'),
      C('Number of Listing', 'listings', 'int', { isNew: true }), C('Date of Entry', 'entry_date', 'date'), C('Days in Yard', 'days_in_yard', 'int'), C('For Return', 'for_return', 'check', { edit: 'check' })],
    filters: [{ key: 'seller', label: 'Seller', type: 'select', options: sellerOpts }, { key: 'status', label: 'Status', type: 'select', w: 'w1', options: () => ['Not Sold', 'Cancelled'] }, { key: 'plate', label: 'Plate Number' }],
    buttons: [{ label: 'Print & email clearance form', kind: 'ol', icon: 'print', act: 'printReturn', count: 'for_return' }, { label: 'Save changes', kind: 'pr', icon: 'save', act: 'save' }] },
  // JBAP feedback (19 Oct 2026) / proposal Q76: the SMD Manager approves a cleared unit in CDMS; FAD then approves, and VWD sees the unit only after that
  { dept: 'SMD', slug: 'return-approval', title: 'SMD Manager Approval', group: 'Return to Seller', actions: VFSU, isNew: true, queue: true,
    rule: 'Units cleared for return, waiting for the SMD Manager. Enter the approval date and save; the unit then waits for the FAD Manager (proposal, Q76).',
    rows: () => V().filter(v => v.rts_cleared && !v.release && !v.rts_smd_ok).map(v => Object.assign(v, { listings: listingsOf(v) })), sort: ['rts_cleared', 'asc'],
    cols: [C('Seller', 'seller', 'code'), C('Plate Number', 'plate', 'code'), C('Make/Model', 'model', 'text', { w: 220 }), C('Status', 'status', 'status'), C('Last Auction', 'auction', 'code'),
      C('Number of Listing', 'listings', 'int'), C('Cleared by SMD', 'rts_cleared', 'date'), C('SMD Manager Approved', 'rts_smd_ok', 'date', { edit: 'date' })],
    filters: [{ key: 'seller', label: 'Seller', type: 'select', options: sellerOpts }, { key: 'plate', label: 'Plate Number' }],
    validate: (r, e) => ({ rts_smd_ok: notFuture(e.rts_smd_ok) || notBefore(e.rts_smd_ok, r.rts_cleared, 'the clearance date') }),
    buttons: [{ label: 'Save changes', kind: 'pr', icon: 'save', act: 'save' }], savedNote: 'Approved units moved to FAD › Return to Seller Approval.' },

  // ===================== VWD (live data shared with FAD; the Unreleased screens release vehicles) =====================
  { dept: 'VWD', slug: 'unreleased-unit', title: 'Unreleased Unit', actions: VFSU, queue: true, rule: 'Dispatched vehicles with no penalty yet (still within the dispatch deadline). VWD releases a vehicle with Release vehicle (JBAP Q9).',
    rows: () => sold().filter(v => v.dispatch && !v.release && v.dispatch_deadline >= TODAY), sort: ['dispatch_deadline', 'asc'],
    cols: [C('Customer Name', 'customer', 'text', { w: 330 }), C('Auction No.', 'auction', 'code'), C('Make/Model', 'model', 'text', { w: 280 }), C('Plate Number', 'plate', 'code'),
      C('Location', 'location', 'code'), C('Dispatch Deadline', 'dispatch_deadline', 'date'), C('Release', 'id', 'rowbtn', { act: 'releaseVehicle', btn: 'Release vehicle' })], filters: UNREL_FILTERS },
  { dept: 'VWD', slug: 'for-dispatch', title: 'For Dispatch', actions: VFS, rule: 'Vehicles with status SOLD and a blank Dispatch Date (all stages before dispatch).',
    rows: () => sold().filter(v => !v.dispatch), sort: ['awarding', 'asc'],
    cols: [C('Vehicle Control Number', 'vcn', 'code'), C('Plate Number', 'plate', 'code'), C('Auction No.', 'auction', 'code'), C('Buyer', 'customer', 'text', { w: 250 }),
      C('Seller', 'seller', 'code'), C('Awarding Date', 'awarding', 'date'), C('Payment Date', 'buyer_paid', 'date'), C('Payment to Seller Date', 'pay_seller', 'date'),
      C('Seller Acknowledgement', 'seller_ack', 'date')],
    filters: [AUCTION_FILTER, { key: 'seller', label: 'Seller', type: 'select', options: sellerOpts }, { key: 'customer', label: 'Buyer' }, { key: 'plate', label: 'Plate Number' }] },
  { dept: 'VWD', slug: 'unreleased-unit-overdue', title: 'Unreleased Unit (Overdue)', actions: VFSU, queue: true,
    rule: `Dispatched vehicles past the dispatch deadline. Storage penalty PHP ${PENALTY_PER_DAY}/day after the dispatch deadline, only for units at ${PENALTY_LOCATIONS.join(' or ')} (Q15). VWD releases a vehicle with Release vehicle (JBAP Q9) once the penalty is paid.`,
    rows: () => sold().filter(v => v.dispatch && !v.release && v.dispatch_deadline < TODAY), sort: ['dispatch_deadline', 'asc'], cols: [...UNREL_COLS, C('Release', 'id', 'rowbtn', { act: 'releaseVehicle', btn: 'Release vehicle' })], filters: UNREL_FILTERS,
    totals: rows => ({ penalty: money(sumBy(rows, 'penalty')) }) },
  { dept: 'VWD', slug: 'for-return-to-seller', title: 'For Return to Seller', actions: VFSU, tag: 'Wish', isNew: true, queue: true, releaseType: 'Return to Seller',
    rule: 'Units cleared by SMD and approved by the SMD and FAD Managers that have not left the yard. VWD records the return with Release vehicle (type Return to Seller), like a release to a buyer (Q18): same running VRF No. and release form.',
    rows: () => V().filter(v => v.rts_cleared && v.rts_fad_ok && !v.release), sort: ['rts_cleared', 'asc'],
    cols: [C('Seller', 'seller_full', 'text', { w: 280 }), C('Plate Number', 'plate', 'code'), C('Make/Model', 'model', 'text', { w: 240 }), C('Location', 'location', 'code'),
      C('Cleared by SMD', 'rts_cleared', 'date'), C('Approved by FAD Manager', 'rts_fad_ok', 'date', { isNew: true }), C('Return', 'id', 'rowbtn', { act: 'releaseVehicle', btn: 'Release vehicle' })],
    filters: [{ key: 'seller', label: 'Seller', type: 'select', options: sellerOpts }, { key: 'plate', label: 'Plate Number' }] },

  // ===================== Report (JBAP feedback 16 Oct 2026, #1: moved from FAD and SMD) =====================
  // [MOCK] Snapshot of the Access Result Summary (10/08/2026): the sample has only some lots per auction, so totals are not recalculated
  { id: 'report/result-summary', dept: 'Report', title: 'Result Summary', actions: VFS, rule: 'One row per auction. Average price per unit = Total awarded price ÷ Sold units. Prototype: figures copied from the Access Result Summary of 10/08/2026; they do not change when lots are updated here.',
    rows: () => D.fadResult.map(r => Object.assign({ id: r.auction }, r)), cols: RESULT_COLS, sort: ['auction', 'desc'], totals: resultTotals,
    filters: [{ key: 'month', label: 'Month', type: 'select', options: () => [...new Set(D.fadResult.map(r => r.month))] },
      { key: 'year', label: 'Year', type: 'select', w: 'w1', options: () => [...new Set(D.fadResult.map(r => r.year))] }, AUCTION_FILTER] },
  { id: 'report/auction-monitoring', dept: 'Report', title: 'Auction Monitoring', actions: VFS, compact: true,
    rule: 'Auction result per auction and lot, with every milestone date from awarding to release to the buyer (live data, for FAD and SMD).',
    rows: V, cols: AM_COLS, sort: ['auction', 'desc'], filters: AM_FILTERS, totals: amTotals },
  // Wish 5 + JBAP feedback (16 Oct 2026, #2, #20, #23; 19 Oct 2026, VWD #4): Inventory Monitoring moves from VWD and SMD to the Report menu, for every department; view only, status calculated
  { id: 'report/inventory-monitoring', dept: 'Report', title: 'Inventory Monitoring', actions: VFS, tag: 'Wish', compact: true, isNew: true,
    rule: `Every unit in the yard, one row each: the auction lots, the units JBAP's parking inventory file (as of 12 Oct 2026) shows in the yard that are not lots, and new vehicles captured at inspection (sample data; the real CDMS takes them from Inspection). Columns follow that file (Logistics, Originating Warehouse, Parking Location, Transfer Date, Returned to Seller WH and Date of Entry come from it; Date of Entry is inferred when a lot's plate is not in it). Inventory Status is calculated: Listed (in an auction that has not ended, or relisted), Not Listed, Awarded (sold), For Release (dispatched, waiting for the buyer's pull-out), For Return (cleared by SMD), Released or Returned; units from JBAP's file show Listed or For Return as the file does, new inspection units are Not Listed. First Auction Listed and End Date of Listing are blank for units that are not lots. View only; the counts follow the lots as they change in FAD, SMD and VWD. Days in Yard runs to the release or return date, or to today while the unit is in the yard.`,
    rows: inventoryRows, sort: ['entry_date', 'asc'], initial: { yard: 'In yard' },
    cols: [C('Date of Entry', 'entry_date', 'date'), C('VCN', 'vcn', 'code'), C('Plate Number', 'plate', 'code'), C('CS No.', 'cs_no', 'code'), C('Make/Model', 'model', 'text', { w: 200 }),
      C('Color', 'color', 'text', { w: 110 }), C('Year', 'year', 'code'), C('Seller', 'seller', 'code'), C('Logistics', 'logistics', 'text', { w: 130 }), C('Originating Warehouse', 'origin_wh', 'text', { w: 150 }),
      C('Parking Location', 'parking', 'text', { w: 130 }), C('Transfer Date', 'transfer_date', 'date'), C('First Auction Listed', 'first_auction', 'code', { isNew: true }), C('End Date of Listing', 'listing_end', 'date', { isNew: true }),
      C('Auction Status', 'status', 'status'), C('Inventory Status', 'inv_status', 'text'), C('Released to Buyer', 'released_buyer', 'date'), C('Returned to Seller', 'returned_seller', 'date'),
      C('Returned to Seller WH', 'rts_wh', 'text', { w: 130 }), C('Days in Yard', 'days_in_yard', 'int')],
    filters: [{ key: 'yard', label: 'In yard / Out', type: 'select', w: 'w1', options: () => ['In yard', 'Out'] }, { key: 'status', label: 'Auction Status', type: 'select', w: 'w1', options: () => ['Sold', 'Not Sold', 'Cancelled'] },
      { key: 'inv_status', label: 'Inventory Status', type: 'select', options: () => INV_STATUSES },
      { key: 'seller', label: 'Seller', type: 'select', options: () => [...sellerOpts(), 'Not recorded'], match: (r, v) => (r.seller || 'Not recorded') === v },   // 25 lots have no seller; Inventory Summary groups them the same way
      { key: 'parking', label: 'Parking Location', type: 'select', options: () => ['OPEN PARKING', 'STEEL PARKING', 'IMET PARKING', 'Not recorded'], match: (r, v) => (r.parking || 'Not recorded') === v },
      { key: 'plate', label: 'Plate Number' }],
    totals: rows => ({ plate: `${rows.length} units`, model: INV_STATUSES.map(t => `${t} ${rows.filter(r => r.inv_status === t).length}`).filter(t => !t.endsWith(' 0')).join(' · ') }) },
  // JBAP feedback (19 Oct 2026, Q70): one row per seller, like the REPORT sheet of JBAP's parking inventory file; the Parking Location filter chooses which units are counted
  { id: 'report/inventory-summary', dept: 'Report', title: 'Inventory Summary', actions: VFS, isNew: true,
    rule: `Units in the yard per seller and inventory status, like the REPORT sheet of JBAP's parking inventory file (proposal, Q70). Units without a seller are grouped as Not recorded. The Parking Location filter narrows the units counted.`,
    count() { return this.rows(true).length; },   // menu counts ignore the Parking pick
    rows: all => {   // all = true: every unit in the yard, whatever the Parking pick
      const pk = all ? [] : filterVals(U('report/inventory-summary').applied.parking), by = {};
      inventoryRows().filter(r => r.yard === 'In yard' && (!pk.length || pk.includes(r.parking || 'Not recorded'))).forEach(u => {
        const k = u.seller || 'Not recorded', o = by[k] ||= { id: k, seller: k, in_yard: 0, listed: 0, not_listed: 0, awarded: 0, for_release: 0, for_return: 0 };
        o.in_yard++; const f = { Listed: 'listed', 'Not Listed': 'not_listed', Awarded: 'awarded', 'For Release': 'for_release', 'For Return': 'for_return' }[u.inv_status]; if (f) o[f]++;
      });
      return Object.values(by);
    },
    sort: ['seller', 'asc'],
    cols: [C('Seller', 'seller', 'code'), C('In Yard', 'in_yard', 'int'), C('Listed', 'listed', 'int'), C('Not Listed', 'not_listed', 'int'), C('Awarded', 'awarded', 'int'), C('For Release', 'for_release', 'int'), C('For Return', 'for_return', 'int')],
    filters: [{ key: 'parking', label: 'Parking Location', type: 'select', options: () => ['OPEN PARKING', 'STEEL PARKING', 'IMET PARKING', 'Not recorded'], match: () => true }],   // rows() applies the pick (it chooses the units, not the rows), so the generic filter lets every row through
    totals: rows => Object.fromEntries([['seller', 'Total'], ...['in_yard', 'listed', 'not_listed', 'awarded', 'for_release', 'for_return'].map(k => [k, intf(sumBy(rows, k))])]) },
  // JBAP feedback (19 Oct 2026, Q69): the list of every cancellation for FAD and SMD (the old FAD and SMD Cancellation Monitoring links open it); Cancellation Entry keeps its own list under the entry form
  { id: 'report/cancellation-monitoring', dept: 'Report', title: 'Cancellation Monitoring', actions: VFS, isNew: true,
    rule: 'Every cancellation, view only, for FAD and SMD (proposal, Q69). Cancellation Entry keeps its own list for recording. Prototype: Seller is blank for cancellations whose lot is not in the sample data.',
    rows: CX, sort: ['dcancel', 'desc'],
    cols: [C('Auction No.', 'auction', 'code'), C('Lot', 'lot', 'code'), C('Customer Name', 'customer', 'text', { w: 220 }), C('Buyer ID', 'cid', 'code'), C('Plate Number', 'plate', 'code'), C('Seller', 'seller', 'code'),
      C('Date Cancelled', 'dcancel', 'date'), C('Waived?', 'waived', 'rocheck'), C('Justification', 'just', 'text', { w: 240 }), C('Penalty', 'penalty', 'money'), C('Billing Date', 'bill_date', 'date'),
      C('Date Paid', 'paid_date', 'date'), C('Cancellation Fee Remitted', 'remitted', 'date')],
    filters: [AUCTION_FILTER, { key: 'customer', keys: ['customer', 'cid'], label: 'Customer Name / Buyer ID', w: 'w2' }, { key: 'plate', label: 'Plate Number' },
      { key: 'seller', label: 'Seller', type: 'select', options: () => [...sellerOpts(), 'Not recorded'], match: (r, v) => (r.seller || 'Not recorded') === v },   // most sample cancellations are of lots outside the sample, so their seller is unknown
      { key: 'waived', label: 'Waived', type: 'select', w: 'w1', options: () => ['Yes', 'No'], match: (r, v) => (v === 'Yes') === !!r.waived }],
    totals: rows => ({ customer: `${rows.length} cancellations`, penalty: money(sumBy(rows, 'penalty')) }) },

  // ===================== Customer › Customer Inquiry (read-only; Sales Actions is not part of the prototype) =====================
  { id: CUST_ID, dept: 'Customer', title: 'Customer Inquiry', actions: VFS,
    rule: 'One row per buyer (Buyer ID), from the lots and the cancellations. Lots Bought and Total Bought count SOLD lots at their result price; Unpaid Lots = awarded lots without a Buyer Paid date. Click a Buyer ID or name to open the customer page; buyer names on the FAD, SMD and VWD lists open it too.',
    rows: buyerRows, sort: ['last_auction', 'desc'],
    cols: [C('Buyer ID', 'cid', 'code'), C('Buyer Name', 'customer', 'text', { w: 300 }), C('Email', 'email', 'text', { w: 240 }), C('Lots Bought', 'lots', 'int'),
      C('Total Bought (PHP)', 'total_bought', 'money'), C('Unpaid Lots', 'unpaid', 'int'), C('Cancellations', 'cancels', 'int'), C('Last Auction', 'last_auction', 'code')],
    filters: [{ key: 'cid', label: 'Buyer ID', type: 'text', w: 'w1' }, { key: 'customer', label: 'Buyer Name' }],
    totals: rows => ({ customer: `${rows.length} buyers`, lots: intf(sumBy(rows, 'lots')), total_bought: money(sumBy(rows, 'total_bought')), unpaid: intf(sumBy(rows, 'unpaid')), cancels: intf(sumBy(rows, 'cancels')) }) },

  // ===================== Settings › Holiday List (JBAP answer Q14, 20 Oct 2026) =====================
  { id: 'settings/holidays', dept: 'Settings', title: 'Holiday List', actions: VFSU, layout: 'holidays', isNew: true, listTitle: 'Holidays',
    rule: 'Holidays and other non-working days: working days skip Saturdays, Sundays and every date listed here, regular holiday or special non-working day. In CDMS only users with the ADMIN role add or remove holidays (JBAP answer Q14); deadlines and aging skip these dates. Prototype: the list is sample data (check it against the official proclamation) and the ADMIN role is not simulated; changes last until you refresh the page.',
    rows: holidayRows, sort: ['date', 'asc'],
    cols: [C('Date', 'date', 'date'), C('Day', 'day', 'text', { w: 120 }), C('Holiday', 'name', 'text', { w: 320 }), C('Type', 'type', 'text', { w: 200 }), C('Remove', 'id', 'rowbtn', { act: 'removeHoliday', btn: 'Remove' })],
    filters: [{ key: 'year', label: 'Year', type: 'select', w: 'w1', options: () => [...new Set(S.holidays.map(h => h.date.slice(0, 4)))].sort() }, { key: 'type', label: 'Type', type: 'select', options: () => HOLIDAY_TYPES }] },

  // ===================== Log Activity (top-level menu, read-only) =====================
  { id: LOG_ID, dept: 'LOG', top: true, title: 'Log Activity', actions: VFS,
    rule: 'Every data change made in FAD, SMD and VWD, and every holiday added or removed in Settings, one row per changed field. Entries cannot be edited or deleted. VWD entries come from vehicle releases and returns; SMD entries come from Return to Seller clearances and approvals and, with the proposed improvements on, the SAAF.',
    rows: () => S.log, sort: ['at', 'desc'],
    cols: [C('Date/Time', 'at', 'datetime'), C('User', 'user', 'code'), C('Module', 'module', 'code'), C('Screen', 'screen', 'text', { w: 170 }), C('Action', 'action', 'action'),
      C('Record', 'record', 'text', { w: 230 }), C('Field', 'field', 'text', { w: 190 }), C('Old Value', 'old', 'logval', { w: 160 }), C('New Value', 'new', 'logval', { w: 160 })],
    filters: [{ key: 'date', label: 'Date', type: 'daterange', w: 'w2' }, { key: 'user', label: 'User', type: 'select', w: 'w1', options: () => [...new Set(S.log.map(l => l.user))].sort() },
      { key: 'module', label: 'Module', type: 'select', w: 'w1', options: () => ['FAD', 'SMD', 'VWD', 'Settings'] }, { key: 'action', label: 'Action', type: 'select', w: 'w1', options: () => ['Update', 'Create', 'Cancel', 'Delete'] },
      { key: 'record', label: 'Record / Plate' }],
    emptyNote: () => { const m = filterVals(U(LOG_ID).applied.module); return m.length !== 1 ? null : m[0] === 'SMD' ? 'No activity yet: SMD logs an entry when it clears units for Return to Seller, approves them or, with the proposed improvements on, sends a SAAF.' : m[0] === 'VWD' ? 'No activity yet: VWD logs an entry each time it releases or returns a vehicle.' : m[0] === 'Settings' ? 'No activity yet: Settings logs an entry each time a holiday is added or removed.' : null; } },
];
SCREENS.forEach(s => { s.id ||= `${s.dept}/${s.slug}`; });
const byId = Object.fromEntries(SCREENS.map(s => [s.id, s]));

function U(id) {
  if (!UI[id]) { const s = byId[id]; UI[id] = { filters: Object.assign({}, s?.initial), applied: Object.assign({}, s?.initial), sort: s?.sort ? [...s.sort] : null, page: 1, size: 15, edits: {}, errors: {}, msg: null }; }
  return UI[id];
}

// ─── Filtering, sorting, paging ───────────────────────────────────────
// [BEHAVIOR] JBAP, 19 Oct 2026: a dropdown filter holds a list of picked values (a plain string still counts as one value; none = All)
const filterVals = v => Array.isArray(v) ? v.filter(x => x !== '') : (v === undefined || v === null || v === '' ? [] : [v]);
const filterLabel = picked => !picked.length ? 'All' : picked.length <= 2 ? picked.join(', ') : `${picked.length} selected`;
function applyFilters(scr, rows) {
  const f = U(scr.id).applied;
  return rows.filter(r => (scr.filters || []).every(fd => {
    const v = f[fd.key];
    if (fd.type === 'daterange') {
      const from = f[fd.key + '__from'], to = f[fd.key + '__to'];
      let x = r[fd.key]; if (fd.key === 'auction_start' && !x) x = r.adate_range?.[0];
      if (fd.key === 'dispatch_deadline' && x && x.includes('/')) x = x;  // already ISO in data
      if (from && (!x || x < from)) return false; if (to && (!x || x > to)) return false; return true;
    }
    if (fd.type === 'select') {   // [BEHAVIOR] a row passes when it matches any picked value; a filter with its own rule (fd.match), e.g. Status "Open" = not Complete or Cancelled, runs it per picked value
      const vals = filterVals(v); if (!vals.length) return true;
      return vals.some(x => fd.match ? fd.match(r, x) : String(r[fd.key]) === String(x));
    }
    if (v === undefined || v === '') return true;
    if (fd.match) return fd.match(r, v);
    const keys = fd.keys || [fd.key];
    if (fd.exact) return keys.some(k => String(r[k] ?? '').toLowerCase() === v.trim().toLowerCase());
    return keys.some(k => String(r[k] ?? '').toLowerCase().includes(v.trim().toLowerCase()));
  }));
}
function sortRows(scr, rows) {
  const st = U(scr.id).sort; if (!st) return rows;
  const [k, dir] = st, m = dir === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const x = a[k], y = b[k];
    const ex = x === null || x === undefined || x === '', ey = y === null || y === undefined || y === '';
    if (ex && ey) return 0; if (ex) return 1; if (ey) return -1;          // blanks always last
    if (typeof x === 'number' && typeof y === 'number') return (x - y) * m;
    return String(x).localeCompare(String(y), 'en', { numeric: true }) * m;
  });
}

// ─── Rendering: shell ─────────────────────────────────────────────────
const TOP_BEFORE = [['Dashboard', 'dashboard', 0], ['Customer', 'customer', 0], ['Seller Inquiry', 'seller-inquiry', 0], ['Cars', 'cars', 1], ['Master', 'master', 1],
  ['Auction', 'auction', 1], ['Live Auction', 'live-auction', 1], ['Live Result', 'live-result', 1], ['Market Search', 'market-search', 0], ['Report', 'report', 1]];
const TOP_AFTER = [['Sales Summary', 'sales-summary', 0], ['Cashier Closing', 'cashier-closing', 0], ['Deposit', 'deposit', 1], ['Payment', 'payment', 1], ['Inspection', 'inspection', 0], ['Staff', 'staff', 1]];
const disabledItem = ([label, key, caret]) => `<button type="button" class="mi is-disabled" aria-disabled="true" data-disabled="${esc(label)}" title="Not part of this prototype">
  <img src="assets/ic-${key}.png" alt="">${esc(label)}${caret ? '<span class="caret"></span>' : ''}</button>`;
// [BEHAVIOR] Screens of one department that share a group show as one menu entry with a tab per screen (FAD › Billing: Billing Monitoring, Unpaid Billing)
// [BEHAVIOR] The record count of a menu entry, Home and tab: the rows of the list, unless the screen counts differently (Inventory Summary counts its sellers, not the ones the Parking pick leaves)
const countOf = s => s.count ? s.count() : s.rows().length;
const groupOf = scr => scr.group ? SCREENS.filter(s => s.dept === scr.dept && s.group === scr.group && shown(s)) : null;
const menuTitle = s => s.group && s.group !== s.title ? `${s.group} › ${s.title}` : s.title;
function sideHtml(route) {
  const groups = ['FAD', 'SMD', 'VWD'].map(d => {
    const open = OPEN[d];
    const items = SCREENS.filter(s => s.dept === d && shown(s)).map(s => {
      const g = groupOf(s); if (g && g[0] !== s) return '';   // a group shows once, where its first screen sits
      const list = g || [s], title = g ? s.group : s.title, on = list.some(x => x.id === route);
      const qs = list.map(queueCounts).filter(Boolean), q = qs.length ? { ready: sumBy(qs, 'ready'), late: sumBy(qs, 'late') } : null;
      const b = q && (q.ready || q.late) ? `<span class="qbs" aria-hidden="true">${q.late ? `<span class="qb late">${q.late}</span>` : ''}${q.ready ? `<span class="qb">${q.ready}</span>` : ''}</span>` : '';
      const label = q ? ` aria-label="${esc(title)}: ${q.ready} waiting, ${q.late} overdue"` : '';
      // [BEHAVIOR] JBAP feedback (16 Oct 2026, #3): the record count of each list; a group shows its counts on its tabs, a P6 queue (switch on) its badges
      const cnt = g || q ? '' : `<span class="cnt">${countOf(s).toLocaleString()}</span>`;
      return `<a class="mis ${on ? 'is-active' : ''}" href="#/${list[0].id}" ${on ? 'aria-current="page"' : ''}${label}>${esc(title)}${tagMini(g ? g.find(x => x.tag) || {} : s)}${newMini(g ? { isNew: g.some(x => x.isNew) } : s)}${b}${cnt}</a>`;   // a group shows the tag of its tagged screen, like its page title
    }).join('');
    return `<button type="button" class="mi" data-group="${d}" aria-expanded="${open}" aria-controls="grp-${d}">${deptSvg(d)}${d}<span class="caret"></span></button>
      <div class="lvs" id="grp-${d}" ${open ? '' : 'hidden'}>${items}</div>`;
  }).join('');
  const logOn = route === LOG_ID;
  const log = `<a class="mi ${logOn ? 'is-active' : ''}" href="#/${LOG_ID}" ${logOn ? 'aria-current="page"' : ''}>${deptSvg('LOG')}Log Activity</a>`;
  return TOP_BEFORE.map(x => TOP_MENUS[x[1]] ? topMenu(x[1], route) : disabledItem(x)).join('') + groups + TOP_AFTER.map(disabledItem).join('') + topMenu('settings', route) + log +
    '<p class="side-note">Prototype: only Customer Inquiry, Report, FAD, SMD, VWD, Settings and Log Activity are active. Other menus are disabled.</p>';
}
// Top-level menus outside FAD / SMD / VWD: Customer (Customer Inquiry; a customer page keeps it highlighted) and Report. Items show their record count.
const TOP_MENUS = { customer: { dept: 'Customer', disabled: ['Sales Actions'], on: (s, r) => r === s.id || (s.id === CUST_ID && !!custRoute(r)) },
  report: { dept: 'Report', disabled: [], on: (s, r) => r === s.id },
  settings: { dept: 'Settings', disabled: [], icon: 'SET', on: (s, r) => r === s.id } };   // Settings (JBAP answer Q14): after the other menus, before Log Activity; its icon is drawn inline
function topMenu(key, route) {
  const m = TOP_MENUS[key], open = OPEN[m.dept];
  const items = SCREENS.filter(s => s.dept === m.dept && shown(s)).map(s => { const on = m.on(s, route);
    return `<a class="mis ${on ? 'is-active' : ''}" href="#/${s.id}" ${on ? 'aria-current="page"' : ''}>${esc(s.title)}${tagMini(s)}${newMini(s)}<span class="cnt">${countOf(s).toLocaleString()}</span></a>`; }).join('');
  const off = m.disabled.map(t => `<button type="button" class="mis is-disabled" aria-disabled="true" data-disabled="${esc(t)}" title="Not part of this prototype">${esc(t)}</button>`).join('');
  return `<button type="button" class="mi" data-group="${m.dept}" aria-expanded="${open}" aria-controls="grp-${m.dept}">${m.icon ? deptSvg(m.icon) : `<img src="assets/ic-${key}.png" alt="">`}${m.dept}<span class="caret"></span></button>
    <div class="lvs" id="grp-${m.dept}" ${open ? '' : 'hidden'}>${items}${off}</div>`;
}
function renderSide(route) { $('#menu').innerHTML = sideHtml(route); }

function pageHead(scr) {
  const pills = scr.actions.map(a => `<span class="pill ${a === 'Update' ? 'u' : ''}">${a}</span>`).join('');
  const extra = PROPOSED && scr.ruleP ? ` ${tagHtml({ tag: scr.ruleP[0] })} ${esc(scr.ruleP[1])}` : '';   // [BEHAVIOR] what the switch changes on this screen
  const g = groupOf(scr);   // [BEHAVIOR] a grouped screen: the menu entry names the page, each screen is a tab (a link with its own URL)
  const tabs = g ? `<nav class="tabs" aria-label="${esc(scr.group)} tabs">${g.map(s => `<a href="#/${s.id}" class="tab${s === scr ? ' is-active' : ''}"${s === scr ? ' aria-current="page"' : ''}>${esc(s.title)}${newMini(s)}<span class="cnt">${countOf(s).toLocaleString()}</span></a>`).join('')}</nav>` : '';
  return `<nav class="crumb" aria-label="Breadcrumb"><a href="#/">Home</a>›${scr.top ? '' : `<span>${scr.dept}</span>›`}${g && scr.group !== scr.title ? `<span>${esc(scr.group)}</span>›` : ''}<b>${esc(scr.title)}</b></nav>
    <div class="hrow"><h1>${esc(g ? scr.group : scr.title)}${tagHtml(g && !scr.tag ? g.find(x => x.tag) || scr : scr)}${newHtml(g ? { isNew: g.some(x => x.isNew) } : scr)}</h1><div class="acts">Allowed actions&nbsp;${pills}</div></div>${tabs}
    <p class="rule">${IC.info}<span>${esc(scr.rule)}${extra}</span></p>`;
}

function filterCard(scr) {
  const f = U(scr.id).filters;
  const fields = scr.filters.map(fd => {
    const id = `f-${fd.key}`;
    if (fd.type === 'select') {
      const picked = filterVals(f[fd.key]).map(String), opts = fd.options().map(String);
      return `<div class="fld ${fd.w || ''}"><span class="lbl" id="${id}-l">${esc(fd.label)}</span><details class="msel" data-msel="${fd.key}"><summary class="ctl" aria-labelledby="${id}-l ${id}-s" title="${esc(filterLabel(picked))}"><span class="msel-t" id="${id}-s">${esc(filterLabel(picked))}</span></summary>
        <div class="msel-p" role="group" aria-labelledby="${id}-l">${opts.map(o => `<label class="chkline"><input type="checkbox" class="chk" data-mfilter="${fd.key}" value="${esc(o)}"${picked.includes(o) ? ' checked' : ''}>${esc(o)}</label>`).join('')}<div class="msel-f"><button type="button" class="btn gh" data-act="resetFilter">${IC.reset}Reset</button><button type="submit" class="btn pr">${IC.search}Apply filter</button></div></div></details></div>`;   // [BEHAVIOR] an open panel can cover the form's Reset and Apply when the filter row wraps, so it carries its own Reset (clears every filter) and Apply (a submit inside the form: applies every filter and closes the panel)
    }
    if (fd.type === 'daterange') {
      return `<div class="fld ${fd.w || 'w2'}"><span class="lbl" id="${id}-l">${esc(fd.label)}</span><div class="range" role="group" aria-labelledby="${id}-l">
        <input class="ctl" type="date" aria-label="${esc(fd.label)} from" data-filter="${fd.key}__from" value="${esc(f[fd.key + '__from'] || '')}">
        <span aria-hidden="true">–</span><input class="ctl" type="date" aria-label="${esc(fd.label)} to" data-filter="${fd.key}__to" value="${esc(f[fd.key + '__to'] || '')}"></div></div>`;
    }
    return `<div class="fld ${fd.w || ''}"><label for="${id}">${esc(fd.label)}</label><input class="ctl" id="${id}" data-filter="${fd.key}" placeholder="Type to search" value="${esc(f[fd.key] || '')}"></div>`;
  }).join('');
  const hasSel = scr.filters.some(fd => fd.type === 'select');
  return `<section class="card filter" aria-label="Filter"><div class="card-h"><div class="ico">${IC.filter}</div>Filter${newMini({ isNew: hasSel })}</div>
    ${hasSel ? '<p class="note msel-hint">Tick one or more values in a dropdown.</p>' : ''}<form class="fb" data-form="filter">${fields}<div class="btns"><button type="button" class="btn gh" data-act="resetFilter">${IC.reset}Reset</button>
    <button type="submit" class="btn pr">${IC.search}Apply filter</button></div></form></section>`;
}

// [BEHAVIOR] Applying or resetting a filter re-renders the page, which drops focus to <body>: focus goes back to the dropdown the keyboard user was in (its button), else to the Filter card's Apply button
const filterFocusKey = el => el?.closest?.('[data-msel]')?.dataset?.msel || null;
function refocusFilter(root, key) {
  (key && root?.querySelector(`details.msel[data-msel="${key}"] > summary`) || root?.querySelector('section.card.filter .btns button[type="submit"]'))?.focus();
}

// [BEHAVIOR] P4: with the switch on, a work list's tick starts on for ready rows (scr.ready = { key, when }). The default is not saved
// or logged; unticking stores an edit like any other change. With the switch off a tick shows the saved value only.
const tickDefault = (scr, r, key) => !!r[key] || (PROPOSED && scr.ready?.key === key && !!scr.ready.when(r));
const tickValue = (scr, r, key) => { const e = U(scr.id).edits[r.id] || {}; return key in e ? e[key] : tickDefault(scr, r, key); };
const tickRows = (scr, key) => PROPOSED && scr.ready?.key === key ? applyFilters(scr, scr.rows()) : scr.rows();   // [BEHAVIOR] P4: a pre-ticked batch covers only the rows the current filter shows
// [BEHAVIOR] P6: menu badges and Home "Waiting for you". ready = rows the list would pre-tick (P4 rule), every row of a work list
// (scr.queue === true without a ready rule), or a count the screen gives (scr.queue as a function); late = rows past a deadline column.
function queueCounts(scr) {
  if (!PROPOSED || !scr.queue || !shown(scr)) return null;
  const rows = scr.rows(), cols = colsOf(scr);
  const ready = typeof scr.queue === 'function' ? scr.queue() : scr.ready ? rows.filter(r => tickDefault(scr, r, scr.ready.key)).length : rows.length;
  return { ready, late: rows.filter(r => cols.some(c => c.late && r[c.key] && r[c.key] < TODAY)).length };
}
const PROPOSALS = [['P2', 'Cancellations made in CDMS wait for FAD to confirm', 'FAD/cancellation-entry'],
  ['P3', 'NOAH numbers stay typed for now; JBAP\'s existing NOAH integration will be re-routed from Access to CDMS. Optional Payment Voucher No.', 'FAD/payment-seller'],
  ['P4', 'Ready lots arrive pre-ticked on 7 lists; Commission Billing bills several sellers at once', 'FAD/commission-billing'],
  ['P5', 'SMD sends the SAAF and records the seller approval; approved lots are ready for FAD', 'SMD/saaf'],
  ['P6', 'Counts on the menu and "Waiting for you" on this page', '']];
// [BEHAVIOR] P4: an untick on the ready key holds the lot back for this session. It is never saved, logged or counted as a change.
const holdKey = scr => PROPOSED && scr.ready ? scr.ready.key : null;
const dirtyCount = scr => Object.values(U(scr.id).edits).filter(e => Object.keys(e).some(k => k !== holdKey(scr))).length;
function dropHolds() { SCREENS.forEach(s => { const ed = s.ready && UI[s.id]?.edits; if (ed) Object.keys(ed).forEach(id => { delete ed[id][s.ready.key]; if (!Object.keys(ed[id]).length) delete ed[id]; }); }); }   // [BEHAVIOR] P4: turning the switch off drops the held-back ticks, so they cannot show up as unsaved changes
function cellHtml(scr, r, c, upd) {
  const ui = U(scr.id), ed = ui.edits[r.id] || {}, err = (ui.errors[r.id] || {})[c.key];
  const cls = [RIGHT.has(c.type) ? 'r' : '', CEN.has(c.type) ? 'c' : ''].join(' ');
  if (c.na?.(r)) return '<td class="c na" title="Does not apply to this seller">n/a</td>';   // [BEHAVIOR] JBAP feedback: EWB / DOAS columns that do not apply to the seller
  if (c.edit && upd && !c.lockWhen?.(r)) {   // lockWhen: an editable column shown read-only on some rows
    const has = c.key in ed, val = has ? ed[c.key] : c.edit === 'check' ? tickDefault(scr, r, c.key) : r[c.key];
    const aria = `${c.label}, lot ${r.lot || ''} ${r.plate || ''}`.trim();
    const common = `data-row="${esc(r.id)}" data-key="${c.key}" aria-label="${esc(aria)}" ${err ? `aria-invalid="true" title="${esc(c.label + errSep(err) + err)}"` : ''}`;
    const st = `${has ? 'is-dirty' : ''} ${err ? 'is-invalid' : ''}`;
    if (c.edit === 'check') return `<td class="c"><input type="checkbox" class="chk ${st}" ${val ? 'checked' : ''} ${c.disabledWhen?.(r) ? 'disabled' : ''} ${common}></td>`;
    if (c.edit === 'date') return `<td>${dateBox(`cell-in dt ${st}`, val, common)}</td>`;
    if (c.edit === 'money') return `<td><input type="number" min="0" step="0.01" class="cell-in num ${st}" value="${val ?? ''}" ${common}></td>`;
    if (c.edit === 'select') return `<td><select class="cell-in ${st}" ${common}><option value=""></option>${c.options.map(o => `<option${o === val ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select></td>`;
    return `<td><input type="text" class="cell-in ${st}" value="${esc(val || '')}" ${common}></td>`;
  }
  const v = r[c.key];
  if (c.type === 'rocheck' || c.type === 'check') return `<td class="c"><span class="ro-chk ${v ? 'on' : ''}" role="img" aria-label="${v ? 'Yes' : 'No'}">${v ? IC.check : ''}</span></td>`;
  if (c.type === 'status' && !v) return '<td class="c"></td>';   // yard and inspection units have no auction status
  if (c.type === 'status') { const k = { Sold: 'sold', 'Not Sold': 'ns', Cancelled: 'cx' }[v] || 'ns'; return `<td class="c"><span class="st ${k}">${esc(v)}</span></td>`; }
  if (c.type === 'action') { const k = { Update: 'up', Create: 'sold', Cancel: 'cx', Delete: 'cx' }[v] || 'ns'; return `<td class="c"><span class="st ${k}">${esc(v)}</span></td>`; }
  if (c.type === 'rowbtn') return c.showWhen && !c.showWhen(r) ? '<td class="c"></td>' : `<td class="c"><button type="button" class="btn ol" data-act="${c.act}" data-rid="${esc(r.id)}" aria-label="${esc(c.btn)} ${esc(r.plate || r.name || '')}">${esc(c.btn)}</button></td>`;
  if (c.type === 'logval' && (v ?? '') === '') return '<td><span class="blank">(blank)</span></td>';
  let t = c.type === 'money' ? money(v) : c.type === 'int' ? intf(v) : c.type === 'date' ? fmtDate(v) : c.type === 'datetime' ? `${fmtDate(v.slice(0, 10))} ${v.slice(11)}` : (v ?? '');
  const late = c.late && v && v < TODAY ? ' late' : '';
  // [BEHAVIOR] a buyer name or Buyer ID opens the customer page when the row has a known Buyer ID
  const inner = (c.key === 'customer' || c.key === 'cid') && t !== '' && knownBuyer(r.cid) ? `<a class="blink" href="${custHref(r.cid)}">${esc(t)}</a>` : esc(t);
  if (c.w) return `<td class="${cls}${late}"><div class="tx" style="max-width:${c.w}px" title="${esc(t)}">${inner}</div></td>`;
  return `<td class="${cls}${late}">${inner}</td>`;
}

function dataCard(scr, title) {
  const ui = U(scr.id), cols = colsOf(scr), upd = scr.actions.includes('Update') && scr.layout !== 'entry', anyEdit = upd && cols.some(c => c.edit);   // VWD lists: Update (row button) but no editable column
  const all = sortRows(scr, applyFilters(scr, scr.rows()));
  const pages = Math.max(1, Math.ceil(all.length / ui.size)); ui.page = Math.min(ui.page, pages);
  const rows = all.slice((ui.page - 1) * ui.size, ui.page * ui.size);
  const dirty = dirtyCount(scr);
  const btns = (scr.buttons || []).filter(b => shown(b) && (upd || b.view)).map(b => {
    const n = b.act === 'save' ? dirty : effectiveCount(scr, b.count);
    return `<button type="button" class="btn ${b.kind}" data-act="${b.act}">${IC[b.icon]}${esc(b.label)}${tagHtml(b)}${newHtml(b)}${n ? `<span class="n" data-count="${b.act}">${n}</span>` : `<span class="n" data-count="${b.act}" hidden></span>`}</button>`;
  }).join('');
  const legend = anyEdit ? '<div class="lg"><span><i class="sw l"></i>Locked</span><span><i class="sw e"></i>Editable</span><span><i class="sw d"></i>Unsaved change</span></div>' : '';
  const th = cols.map(c => {
    const ed = c.edit && upd, srt = ui.sort && ui.sort[0] === c.key ? (ui.sort[1] === 'asc' ? 'ascending' : 'descending') : 'none';
    return `<th class="${ed ? 'ed' : ''}" aria-sort="${srt}" scope="col"><button type="button" class="hb" data-sort="${c.key}">${anyEdit ? (ed ? IC.pen : `<span class="lk">${IC.lock}</span>`) : ''}<span>${esc(c.label)}</span>${tagHtml(c)}${newHtml(c)}<span class="si" aria-hidden="true"></span></button></th>`;
  }).join('');
  const body = rows.length ? rows.map(r => `<tr class="${ui.edits[r.id] ? 'is-dirty' : ''}" data-tr="${esc(r.id)}">${cols.map(c => cellHtml(scr, r, c, upd)).join('')}</tr>`).join('')
    : `<tr><td colspan="${cols.length}"><div class="empty">${IC.inbox}<b>No records to show</b>${esc(scr.emptyNote?.() || '') || (hasFilter(scr) ? 'No records match the filter. Try Reset.' : 'Nothing is waiting in this list right now.')}</div></td></tr>`;
  let foot = '';
  if (scr.totals && all.length) {
    const t = scr.totals(all);
    foot = `<tfoot><tr>${cols.map((c, i) => `<td class="${RIGHT.has(c.type) ? 'r' : CEN.has(c.type) ? 'c' : ''}">${esc(t[c.key] ?? (i === 0 ? 'Total' : ''))}</td>`).join('')}</tr></tfoot>`;
  }
  const msg = ui.msg ? `<div class="msg ${ui.msg.type}" role="${ui.msg.type === 'error' ? 'alert' : 'status'}">${IC.info}<div>${ui.msg.html}</div></div>` : '';
  const pg = [`<button type="button" class="pb" data-page="${ui.page - 1}" ${ui.page === 1 ? 'disabled' : ''}>Previous</button>`];
  for (let p = 1; p <= pages; p++) if (pages <= 7 || Math.abs(p - ui.page) <= 2 || p === 1 || p === pages) pg.push(`<button type="button" class="pb ${p === ui.page ? 'is-active' : ''}" data-page="${p}" ${p === ui.page ? 'aria-current="page"' : ''}>${p}</button>`);
  pg.push(`<button type="button" class="pb" data-page="${ui.page + 1}" ${ui.page === pages ? 'disabled' : ''}>Next</button>`);
  const from = all.length ? (ui.page - 1) * ui.size + 1 : 0;
  return `<section class="card" aria-label="${esc(title)}"><div class="card-h"><div class="ico">${IC.table}</div>${esc(title)}<span class="bdg">${all.length.toLocaleString()}</span><span class="sp"></span></div>
    <div class="tb"><label>Show<select data-size>${[10, 15, 25, 50].map(n => `<option ${n === ui.size ? 'selected' : ''}>${n}</option>`).join('')}</select>entries</label>${legend}<div class="btns">${btns}</div></div>
    ${msg}<div class="tw"><table class="${scr.compact ? 'cmp' : ''}"><thead><tr>${th}</tr></thead><tbody>${body}</tbody>${foot}</table></div>
    <div class="pg"><span>Showing ${from} to ${from ? from + rows.length - 1 : 0} of ${all.length.toLocaleString()} entries</span><div class="pgr">${pg.join('')}</div></div></section>`;
}
const hasFilter = scr => Object.values(U(scr.id).applied).some(v => Array.isArray(v) ? v.length : v);
function effectiveCount(scr, key) {   // ticks: unsaved edit, else saved value or the P4 default
  if (!key) return 0;
  return tickRows(scr, key).filter(r => tickValue(scr, r, key)).length;
}

// ─── Special layouts ──────────────────────────────────────────────────
function queryCard(scr) {
  const d = U(scr.id).asOf || TODAY;
  return `<section class="card filter"><div class="card-h"><div class="ico">${IC.search}</div>Query</div>
    <form class="fb" data-form="query"><div class="fld w2"><label for="q-asof">Payment to seller still blank before</label>${dateField('q-asof', d, 'required')}<span class="err" id="q-asof-err"></span></div>
    <p style="font-size:12.5px;color:var(--faint);margin:0 0 9px;max-width:620px">Buyer payment date has no filter. A unit is listed when Payment to Seller is blank, or falls after the date entered.</p>
    <div class="btns"><button type="submit" class="btn pr">${IC.play}Generate</button></div></form></section>`;
}
// [BEHAVIOR] P2 (switch on): lots cancelled in CDMS, each with the waiver decision and a Confirm button; what FAD types stays in ccDraft
function cdmsCancelPanel(scr) {
  const list = cdmsCancelsPending(), draft = U(scr.id).ccDraft || {};
  const rows = list.map(({ c, v }, i) => `<tr><td class="c">${esc(v.plate)}</td><td class="c">${esc(v.auction)} / ${esc(v.lot)}</td><td>${esc(v.customer)}</td><td class="c">${fmtDate(c.date)}</td><td>${esc(c.reason)}</td>
    <td class="c"><input type="checkbox" class="chk" id="cc-w-${i}" aria-label="Waive fee, ${esc(v.plate)}"${draft[v.id]?.waived ? ' checked' : ''}></td><td><input class="cell-in" id="cc-j-${i}" aria-label="Justification, ${esc(v.plate)}" value="${esc(draft[v.id]?.just || '')}"></td>
    <td class="c"><button type="button" class="btn ol" data-act="confirmCdmsCancel" data-rid="${esc(v.id)}" data-i="${i}" aria-label="Confirm cancellation ${esc(v.plate)}">Confirm</button></td></tr>`).join('');
  return `<section class="card" aria-label="Cancelled in CDMS, to confirm"><div class="card-h"><div class="ico">${IC.ban}</div>Cancelled in CDMS, to confirm${tagHtml({ tag: 'P2' })}<span class="bdg">${list.length}</span></div>
    <div class="msg error" id="cc-err" role="alert" hidden>${IC.info}<div id="cc-err-t"></div></div>
    <div class="tw"><table><thead><tr><th scope="col">Plate</th><th scope="col">Auction / Lot</th><th scope="col">Customer Name</th><th scope="col">Cancelled in CDMS</th><th scope="col">CDMS Reason</th><th scope="col">Waive fee?</th><th scope="col">Justification</th><th scope="col"><span class="sr-only">Action</span></th></tr></thead>
    <tbody>${rows || `<tr><td colspan="8"><div class="empty">${IC.inbox}<b>Nothing to confirm</b>Every CDMS cancellation is recorded.</div></td></tr>`}</tbody></table></div></section>`;
}
// [BEHAVIOR] Settings › Holiday List: the Add holiday form above the list; what was typed stays, with the message, when it is refused
function holidayForm(scr) {
  const ui = U(scr.id), f = ui.hf || (ui.hf = { date: '', name: '', type: '', errors: {} }), er = k => f.errors[k] ? `<span class="err" id="hl-${k}-err">${esc(f.errors[k])}</span>` : '';
  return `<section class="card" aria-label="Add holiday"><div class="card-h"><div class="ico">${IC.cal}</div>Add holiday</div>
    <form class="fb" data-form="holiday" novalidate><div class="fld"><label for="hl-date">Date</label>${dateField('hl-date', f.date, f.errors.date ? 'aria-invalid="true"' : '', f.errors.date ? 'is-invalid' : '')}${er('date')}</div>
    <div class="fld w2"><label for="hl-name">Holiday</label><input class="ctl${f.errors.name ? ' is-invalid' : ''}" id="hl-name" autocomplete="off" placeholder="e.g. Eid'l Fitr" value="${esc(f.name)}"${f.errors.name ? ' aria-invalid="true"' : ''}>${er('name')}</div>
    <div class="fld"><label for="hl-type">Type</label><select class="ctl${f.errors.type ? ' is-invalid' : ''}" id="hl-type"${f.errors.type ? ' aria-invalid="true"' : ''}><option value="">Choose the type</option>${HOLIDAY_TYPES.map(t => `<option${t === f.type ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>${er('type')}</div>
    <div class="btns"><button type="submit" class="btn pr">${IC.save}Add holiday</button></div></form></section>`;
}
function holidayAdd(scr) {
  const ui = U(scr.id), raw = $('#hl-date').value.trim(), date = parseDateInput(raw, TODAY), f = { date, name: $('#hl-name').value.trim(), type: $('#hl-type').value }, errors = holidayErrors(f);
  const bad = ['date', 'name', 'type'].find(k => errors[k]);
  if (bad) { ui.hf = { date: date === null ? raw : date, name: f.name, type: f.type, errors: Object.fromEntries(Object.entries(errors).filter(([, m]) => m)) }; render(); $(`#hl-${bad}`)?.focus(); return; }
  recordHolidayAdd(scr, f); ui.hf = null; render();
  toast(`Holiday added: ${fmtDate(f.date)}, ${esc(f.name.trim())}. Deadlines and aging now skip that date.`);
}
function entryLayout(scr) {
  const ui = U(scr.id), e = ui.entry || (ui.entry = { auction: '', lot: '', found: null, errors: {}, form: null });
  const ferr = k => e.errors[k] ? `<span class="err" id="err-${k}">${esc(e.errors[k])}</span>` : '';
  const find = `<section class="card" style="width:430px;flex:none"><div class="card-h"><div class="ico">${IC.search}</div>Find transaction</div>
    <form data-form="find" novalidate><div class="fgrid two">
      <div class="fld"><label for="ce-auction">Auction No.</label><input class="ctl ${e.errors.auction ? 'is-invalid' : ''}" id="ce-auction" inputmode="numeric" value="${esc(e.auction)}" aria-describedby="err-auction" placeholder="e.g. 220">${ferr('auction')}</div>
      <div class="fld"><label for="ce-lot">Lot</label><input class="ctl ${e.errors.lot ? 'is-invalid' : ''}" id="ce-lot" inputmode="numeric" value="${esc(e.lot)}" aria-describedby="err-lot" placeholder="e.g. 105">${ferr('lot')}</div></div>
      <div class="fact"><button type="button" class="btn gh" data-act="entryClear">${IC.reset}Clear</button><button type="submit" class="btn pr">${IC.search}Find</button></div>
      <p class="note">${e.note ? esc(e.note) : 'Tip: try Auction 220, Lot from the Unpaid list.'}</p></form></section>`;
  let det;
  const v = e.found, f = e.form;
  if (!v) det = `<section class="card" style="flex:1"><div class="card-h"><div class="ico">${IC.ban}</div>Transaction details</div><div class="empty">${IC.inbox}<b>No transaction selected</b>Find a transaction by Auction No. and Lot.</div></section>`;
  else {
    const lk = (l, val) => `<div class="fld"><label>${l}</label><input class="ctl" value="${esc(val)}" readonly></div>`;
    const ro = v.status !== 'Sold';
    det = `<section class="card" style="flex:1"><div class="card-h"><div class="ico">${IC.ban}</div>Transaction details<span class="sp"></span><span class="hint"><span>${IC.lock} Locked</span><span>${IC.pen} Editable</span></span></div>
      <form data-form="cancel" novalidate><div class="fgrid">
      ${lk('Lot', v.lot)}${lk('Auction No.', v.auction)}${lk('Customer Name', v.customer)}${lk('Plate Number', v.plate)}
      <div class="fld"><label for="ce-status">Status</label><select class="ctl ${e.errors.status ? 'is-invalid' : ''}" id="ce-status" ${ro ? 'disabled' : ''}>${['Sold', 'Cancelled'].map(s => `<option ${f.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>${ferr('status')}</div>
      <div class="fld"><label for="ce-date">Date Cancelled</label>${dateField('ce-date', f.date, ro ? 'disabled' : '', e.errors.date ? 'is-invalid' : '')}${ferr('date')}</div>
      <div class="fld"><span class="lbl">Cancellation Fee Waived</span><label class="chkline"><input type="checkbox" class="chk" id="ce-waived" ${f.waived ? 'checked' : ''} ${ro ? 'disabled' : ''}>Waive the cancellation fee</label></div><div></div>
      <div class="fld full"><label for="ce-just">Justification of Waiver</label><textarea class="ctl ${e.errors.just ? 'is-invalid' : ''}" id="ce-just" ${ro ? 'disabled' : ''} placeholder="Reason, e.g. Did not pay within the buyer deadline">${esc(f.just)}</textarea>${ferr('just')}</div>
      </div>${ro ? `<p class="note">This lot is already <b>${esc(v.status)}</b>. Only SOLD transactions can be cancelled.</p>` : ''}
      <div class="fact"><button type="button" class="btn gh" data-act="entryClear">Discard</button><button type="submit" class="btn dg" ${ro ? 'disabled' : ''}>${IC.ban}Cancel transaction</button></div></form></section>`;
  }
  return `${PROPOSED ? cdmsCancelPanel(scr) : ''}<div class="row2">${find}${det}</div>${scr.filters && scr.actions.includes('Filter') ? filterCard(scr) : ''}${dataCard(scr, 'Cancellations')}`;
}
// Read-only table for the customer page (no sorting, paging or editing)
function plainTable(cols, rows, totals, empty) {
  const stub = { id: 'customer-page' };
  const th = cols.map(c => `<th scope="col"><span class="hb">${esc(c.label)}${newHtml(c)}</span></th>`).join('');
  const body = rows.length ? rows.map(r => `<tr data-lot="${esc(r.id)}">${cols.map(c => cellHtml(stub, r, c, false)).join('')}</tr>`).join('')
    : `<tr><td colspan="${cols.length}"><div class="empty">${IC.inbox}<b>${esc(empty)}</b></div></td></tr>`;
  const foot = rows.length && totals ? `<tfoot><tr>${cols.map(c => `<td class="${RIGHT.has(c.type) ? 'r' : CEN.has(c.type) ? 'c' : ''}">${esc(totals[c.key] ?? '')}</td>`).join('')}</tr></tfoot>` : '';
  return `<div class="tw"><table><thead><tr>${th}</tr></thead><tbody>${body}</tbody>${foot}</table></div>`;
}
const CUST_SELLER_COLS = [C('Seller', 'seller', 'code'), C('Seller Name', 'seller_full', 'text', { w: 340 }), C('Units Bought', 'units', 'int'), C('Total Amount (PHP)', 'amount', 'money'),
  C('Unpaid Units', 'unpaid', 'int'), C('Last Auction', 'last', 'code')];
const CUST_LOT_COLS = [C('Auction Month', 'amonth', 'code'), C('Auction No.', 'auction', 'code'), C('Lot', 'lot', 'code'), C('Seller', 'seller', 'code'), C('Plate', 'plate', 'code'),
  C('Make/Model', 'model', 'text', { w: 240 }), C('Result Price', 'price', 'money'), C('Notarial', 'transfer_fee', 'money'), C('Commission', 'com', 'money'), C('Total', 'total', 'money'), C('Step', 'step', 'code')];
// JBAP answer Q21: Date of Release / Return (the lot's release date, any release type) is on the Sold list only; Vehicle for release adds the dispatch columns
const CUST_SOLD_COLS = [...CUST_LOT_COLS, C('Date of Release / Return', 'release', 'date', { isNew: true })];
const CUST_REL_COLS = [...CUST_LOT_COLS, C('Dispatch Date', 'dispatch', 'date'), C('Dispatch Deadline', 'dispatch_deadline', 'date', { late: true }), C('Penalty', 'penalty', 'money')];
const CUST_CX_COLS = [C('Auction No.', 'auction', 'code'), C('Lot', 'lot', 'code'), C('Seller', 'seller', 'code'), C('Plate', 'plate', 'code'), C('Make/Model', 'model', 'text', { w: 200 }),
  C('Date Cancelled', 'dcancel', 'date'), C('Waived?', 'waived', 'rocheck'), C('Justification', 'just', 'text', { w: 240 }), C('Penalty', 'penalty', 'money'), C('Billing Date', 'bill_date', 'date'), C('Paid Date', 'paid_date', 'date')];
const CUST_DOAS_COLS = [C('Auction No.', 'auction', 'code'), C('Lot', 'lot', 'code'), C('Seller', 'seller', 'code'), C('Plate', 'plate', 'code'), C('Make/Model', 'model', 'text', { w: 220 }),
  C('Seller Payment', 'pay_seller', 'date'), C('Receipt of DOAS', 'rcv_doas', 'date'), C('EWB Call Out', 'ewb_callout', 'date', { isNew: true }), C('Working Days Since Receipt / Call Out', 'doas_days', 'int', { isNew: true })];
const CUST_DOCS_COLS = [C('Auction No.', 'auction', 'code'), C('Lot', 'lot', 'code'), C('Seller', 'seller', 'code'), C('Plate', 'plate', 'code'), C('Make/Model', 'model', 'text', { w: 220 }),
  C('JBAP Receipt of Documents', 'orig_docs', 'date'), C('ATF No.', 'atf_no', 'code')];
// Customer page: Customer Information (not built) and Customer Transaction History (cards, purchases by seller, lot lists as tabs with their own URL)
function customerPage(cid, tab) {
  const b = buyerOf(cid), crumb = last => `<nav class="crumb" aria-label="Breadcrumb"><a href="#/">Home</a>›<span>Customer</span>›<a href="#/${CUST_ID}">Customer Inquiry</a>›<b>${esc(last)}</b></nav>`;
  if (!b) return `${crumb(cid)}<div class="hrow"><h1>Customer Detail</h1></div><section class="card"><div class="empty">${IC.inbox}<b>No buyer with Buyer ID ${esc(cid)}</b>Open a buyer from <a href="#/${CUST_ID}">Customer Inquiry</a>.</div></section>`;
  const kpi = (k, v, s) => `<div class="kpi"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div><div class="s">${esc(s)}</div></div>`;
  const cards = `<div class="kpis">${kpi('Lots bought', intf(b.sold.length), `${b.sellers.length} seller(s)`)}${kpi('Total bought (PHP)', money(sumBy(b.sold, 'price')), 'Result prices')}`
    + `${kpi('Pending awarding', intf(b.pending.length), 'Not yet awarded')}${kpi('Unpaid', intf(b.unpaid.length), `PHP ${money(sumBy(b.unpaid, 'total'))}`)}`
    + `${kpi('Cancellations', intf(b.cancels.length), `${b.cancels.filter(c => !c.waived).length} with fee`)}</div>`;
  const sellers = `<section class="card" aria-label="Purchases by seller"><div class="card-h"><div class="ico">${IC.table}</div>Purchases by seller<span class="bdg">${b.sellers.length}</span></div>
    ${plainTable(CUST_SELLER_COLS, b.sellers, { seller: `Total (${b.sellers.length})`, units: intf(sumBy(b.sellers, 'units')), amount: money(sumBy(b.sellers, 'amount')), unpaid: intf(sumBy(b.sellers, 'unpaid')) }, 'No lots bought yet')}</section>`;
  const lists = { sold: b.sold, 'pending-awarding': b.pending, unpaid: b.unpaid, 'vehicle-release': b.for_release, 'pending-doas': b.pending_doas, 'docs-release': b.docs_release, cancellation: b.cancels }, rows = lists[tab] || b.sold, t = lists[tab] ? tab : 'sold';
  const tabs = `<nav class="tabs in-card" aria-label="Lot lists">${CUST_TABS.map(([slug, label, isNew]) => `<a href="${custHref(cid, slug)}" class="tab${slug === t ? ' is-active' : ''}"${slug === t ? ' aria-current="page"' : ''}>${label}${newMini({ isNew })}<span class="cnt">${lists[slug].length}</span></a>`).join('')}</nav>`;
  const count = { auction: `Total (${rows.length})` };
  const table = t === 'cancellation' ? plainTable(CUST_CX_COLS, rows, { auction: `Total (${rows.length})`, penalty: money(sumBy(rows, 'penalty')) }, 'No cancellations')
    : t === 'pending-doas' ? plainTable(CUST_DOAS_COLS, rows, count, 'No DOAS waiting for the buyer\'s signature')
    : t === 'docs-release' ? plainTable(CUST_DOCS_COLS, rows, count, 'No documents waiting for release')
    : plainTable(t === 'sold' ? CUST_SOLD_COLS : t === 'vehicle-release' ? CUST_REL_COLS : CUST_LOT_COLS, rows, { amonth: `Total (${rows.length})`, price: money(sumBy(rows, 'price')), transfer_fee: money(sumBy(rows, 'transfer_fee')), com: money(sumBy(rows, 'com')), total: money(sumBy(rows, 'total')), penalty: t === 'vehicle-release' ? money(sumBy(rows, 'penalty')) : '' },
      t === 'vehicle-release' ? 'No vehicle waiting for release' : 'No lots in this list');
  return `${crumb(cid)}<div class="hrow"><h1>Customer Detail</h1><div class="acts">Allowed actions&nbsp;<span class="pill">View</span></div></div>
    <nav class="tabs" aria-label="Customer detail"><span class="tab is-disabled" aria-disabled="true" title="Not part of this prototype">Customer Information</span><a href="${custHref(cid)}" class="tab is-active" aria-current="page">Customer Transaction History${b.unpaid.length ? `<span class="cnt warn">${b.unpaid.length} unpaid</span>` : ''}</a></nav>
    <p class="rule">${IC.info}<span>Everything this buyer has bought at auction, from the same lot data as the FAD lists (read-only). Notarial = transfer fee; Total = Result Price + Notarial + Security Bond. Step = how far the lot has got: Pending award → Unpaid → Paid → Seller Ack. → For Dispatch → Unreleased → Released or Returned. Customer Information is not part of this prototype. Pending DOAS signature = Receipt of DOAS filled, signed DOAS not back yet, or, for EWB, called out and not yet signed (proposal, Q82); working days count from Receipt of DOAS, else from EWB Call Out; Documents for release = JBAP has the documents, the buyer does not yet. Vehicle for release = dispatched (Dispatch Date filled) and not released yet, with its dispatch deadline and storage penalty. Date of Release / Return on the Sold list = the release date of the lot (any release type), blank while the unit is in the yard (JBAP answer Q21).</span></p>
    <h2 class="cust-h">${esc(cid)} · ${esc(b.name)}</h2>${b.email ? `<p class="cust-sub">${esc(b.email)}</p>` : ''}
    ${cards}${sellers}<section class="card" aria-label="Lots"><div class="card-h"><div class="ico">${IC.table}</div>Lots</div>${tabs}${table}</section>`;
}
// P6 (switch on): what the switch adds, and what is waiting per department
function proposedPanels() {
  const items = PROPOSALS.map(([id, text, link]) => `<li>${tagHtml({ tag: id })} ${link ? `<a href="#/${link}">${esc(text)}</a>` : esc(text)}</li>`).join('');
  const dept = d => `<div><h3>${d}</h3><ul>${SCREENS.filter(s => s.dept === d).map(s => [s, queueCounts(s)]).filter(([, q]) => q).map(([s, q]) =>
    `<li><a href="#/${s.id}">${esc(menuTitle(s))}${q.late ? `<span class="cnt late">${q.late} overdue</span>` : ''}<span class="cnt">${q.ready}</span></a></li>`).join('') || '<li class="none">Nothing waiting</li>'}</ul></div>`;
  return `<section class="card pp" aria-label="Proposed improvements"><div class="card-h"><div class="ico">${IC.info}</div>Proposed improvements</div><ul class="pp-list">${items}</ul></section>
    <section class="card pp" aria-label="Waiting for you"><div class="card-h"><div class="ico">${IC.table}</div>Waiting for you${tagHtml({ tag: 'P6' })}</div><div class="pp-wait">${['FAD', 'SMD', 'VWD'].map(dept).join('')}</div></section>`;
}
function homeLayout() {
  const card = d => {
    const subs = SCREENS.filter(s => s.dept === d && shown(s)).map(s => `<li><a href="#/${s.id}">${esc(menuTitle(s))}${tagMini(s)}${newMini(s)}<span class="cnt">${countOf(s).toLocaleString()}</span></a></li>`).join('');
    const sub = { FAD: 'Post-auction processing: awarding, payments, billing, rebates, cancellations', SMD: 'Legacy sample data: Pending Awarding, Unpaid, Seller Acknowledgement, For Dispatch, Rebate Monitoring. Live data: Unreleased Unit, Return to Seller, SMD Manager Approval', VWD: 'Units for dispatch and release; VWD records the vehicle release', Report: 'Monitoring and summary reports for FAD, SMD and VWD: results, auctions, inventory, cancellations' }[d];
    const icon = d === 'Report' ? '<img src="assets/ic-report.png" alt="" width="20" height="20">' : deptSvg(d).replace('viewBox', 'width="20" height="20" viewBox');
    return `<section class="hcard"><div class="card-h"><div class="ico">${icon}</div><b>${d}</b></div><p class="sub" style="margin-top:8px">${sub}</p><ul>${subs}</ul></section>`;
  };
  return `<div class="home"><nav class="crumb" aria-label="Breadcrumb"><b>Home</b></nav><h1>Post-Auction Menus</h1>
    <p class="lead">Clickable prototype of the new Customer Inquiry, Report, FAD, SMD and VWD menus that replace the MS Access post-auction forms, plus Settings › Holiday List. Data is sample data and resets when you refresh the page. Demo date: <b>${fmtDate(TODAY)}</b>.</p>
    ${PROPOSED ? proposedPanels() : ''}<div class="hgrid">${['FAD', 'SMD', 'VWD', 'Report'].map(card).join('')}</div></div>`;
}

// ─── Router ───────────────────────────────────────────────────────────
// [BEHAVIOR] JBAP feedback (16 Oct 2026): moved or merged screens; their old links open the new place
const MOVED = { 'FAD/result-summary': 'report/result-summary', 'SMD/result-summary': 'report/result-summary',
  'FAD/auction-monitoring': 'report/auction-monitoring', 'SMD/auction-monitoring': 'report/auction-monitoring', 'VWD/auction-monitoring': 'report/inventory-monitoring',
  'VWD/inventory': 'report/inventory-monitoring', 'SMD/inventory': 'report/inventory-monitoring',
  'FAD/cancellation-monitoring': 'report/cancellation-monitoring', 'SMD/cancellation-monitoring': 'report/cancellation-monitoring', 'FAD/cancellation-payment': 'FAD/cancellation-billing' };
const moved = h => Object.hasOwn(MOVED, h) ? MOVED[h] : null;   // own keys only: '#/constructor' is neither a moved nor a known screen
const routeOf = h => { const t = moved(h) || h, scr = Object.hasOwn(byId, t) ? byId[t] : null; return scr && shown(scr) ? t : custRoute(t) ? t : ''; };   // a proposed screen opens only with the switch on
function route() {
  const h = location.hash.replace(/^#\/?/, '');
  if (moved(h) && typeof history !== 'undefined' && history.replaceState) history.replaceState(null, '', `#/${moved(h)}`);   // the address bar shows the new link
  return routeOf(h);
}
function render() {
  const r = route(), scr = byId[r], cust = custRoute(r);
  if (scr) OPEN[scr.dept] = true;
  if (cust) OPEN.Customer = true;
  renderSide(r);
  const c = $('#content');
  if (cust) { c.innerHTML = customerPage(cust.cid, cust.tab); document.title = `${cust.cid} | Customer | CDMS Prototype`; return; }
  if (!scr) { c.innerHTML = homeLayout(); document.title = 'CDMS Prototype | Post-Auction Menus'; return; }
  document.title = `${scr.title} | ${scr.top ? '' : `${scr.dept} | `}CDMS Prototype`;
  let html = pageHead(scr);
  if (scr.layout === 'entry') html += entryLayout(scr);
  else { if (scr.layout === 'query') html += queryCard(scr); if (scr.layout === 'holidays') html += holidayForm(scr); if (scr.filters && scr.actions.includes('Filter')) html += filterCard(scr); html += dataCard(scr, scr.listTitle || scr.title + ' list'); }
  c.innerHTML = html;
}

// ─── Toast & modal ────────────────────────────────────────────────────
function toast(text, kind = '') { const t = document.createElement('div'); t.className = `toast ${kind}`; t.setAttribute('role', 'status'); t.innerHTML = `${IC.info}<span>${text}</span>`; $('#toasts').appendChild(t); setTimeout(() => t.remove(), 4200); }
let modalKeyHandler = null;
function openModal({ title, icon = 'info', body, footer = [], note = '', wide = false, onAtt = null }) {
  closeModal();
  const bg = document.createElement('div'); bg.className = 'modal-bg'; bg.id = 'modal';
  bg.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-t"><div class="modal-h">${IC[icon] || ''}<span id="modal-t">${esc(title)}</span><button type="button" class="x" data-close aria-label="Close">×</button></div>
    <div class="modal-b">${body}</div><div class="modal-f"><span class="left">${note}</span>${footer.map((f, i) => `<button type="button" class="btn ${f.kind}" data-mbtn="${i}">${f.icon ? IC[f.icon] : ''}${esc(f.label)}</button>`).join('')}</div></div>`;
  document.body.appendChild(bg);
  bg.addEventListener('click', ev => {
    if (ev.target === bg || ev.target.closest('[data-close]')) closeModal();
    const b = ev.target.closest('[data-mbtn]'); if (b) footer[+b.dataset.mbtn].onClick();
    const a = ev.target.closest('[data-att]'); if (a && onAtt) onAtt(a.dataset.att);
  });
  modalKeyHandler = ev => { if (ev.key === 'Escape') closeModal(); }; document.addEventListener('keydown', modalKeyHandler);
  (bg.querySelector('input,button.btn') || bg).focus();
}
function closeModal() { const m = $('#modal'); if (m) m.remove(); if (modalKeyHandler) document.removeEventListener('keydown', modalKeyHandler); modalKeyHandler = null; }
function printModal() { document.body.classList.add('printing'); window.print(); }
window.addEventListener('afterprint', () => document.body.classList.remove('printing'));

// ─── Actions ──────────────────────────────────────────────────────────
function currentScr() { return byId[route()]; }
function selectedRows(scr, key) { return sortRows(scr, tickRows(scr, key)).filter(r => tickValue(scr, r, key)); }
function setMsg(scr, type, html) { U(scr.id).msg = type ? { type, html } : null; }
// A message that starts with a capital is a sentence of its own ("No rebate to approve"): the column name and a colon come first; the others continue the column name ("cannot be after today")
const errSep = m => /^[A-Z]/.test(m) ? ': ' : ' ';
function validateEdits(scr, ids) {
  const ui = U(scr.id), map = Object.fromEntries(scr.rows().map(r => [r.id, r])), errors = {}, lines = [];
  (ids || Object.keys(ui.edits)).forEach(id => {
    const r = map[id]; if (!r) { delete ui.edits[id]; return; }
    // [BEHAVIOR] a typed date that cannot be read is reported as such; the screen's own rules run on the other values only
    const e = ui.edits[id] || {}, bad = scr.cols.filter(c => c.edit === 'date' && e[c.key] && !ISO_RE.test(e[c.key])).map(c => c.key);
    const good = Object.fromEntries(Object.entries(e).filter(([k]) => !bad.includes(k)));
    const errs = Object.assign(scr.validate ? scr.validate(r, good) : {}, Object.fromEntries(bad.map(k => [k, DATE_ERR])));
    Object.entries(errs).forEach(([k, m]) => { if (m) { (errors[id] ||= {})[k] = m; lines.push(`Lot ${esc(r.lot || '-')} (${esc(r.plate || r.customer)}): <b>${esc(scr.cols.find(c => c.key === k)?.label || k)}</b>${errSep(m)}${esc(m)}`); } });
  });
  ui.errors = errors;
  return lines;
}
function applyEdits(scr, ids) {
  const ui = U(scr.id), map = Object.fromEntries(scr.rows().map(r => [r.id, r])), hold = holdKey(scr); let n = 0;
  (ids || Object.keys(ui.edits)).forEach(id => {
    const r = map[id], e = ui.edits[id]; if (!r || !e) return;
    const keys = Object.keys(e).filter(k => k !== hold); if (!keys.length) return;   // a hold-back alone is not saved: no write, no log, no count
    const changes = keys.map(k => {
      const val = e[k], col = scr.cols.find(c => c.key === k), nv = val === '' ? null : (col?.edit === 'money' && val !== null ? Number(val) : val);
      const ch = [col?.label || k, col?.edit, r._raw[k], nv]; r._raw[k] = nv; return ch;
    });
    logChange(scr, 'Update', r, changes);
    keys.forEach(k => delete e[k]); if (!Object.keys(e).length) delete ui.edits[id]; n++;
  });
  return n;
}
// Saves a generated file (e.g. an .xlsx report) through the browser's download
function saveFile(name, bytes, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type })), a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
// Opens one report from an email preview; "Back" returns to the emails
function openReport(title, html, back) {
  openModal({ title, icon: 'print', wide: true, body: html, note: 'Preview of the attached PDF.',
    footer: [{ label: 'Back to email', kind: 'gh', onClick: back }, { label: 'Print', kind: 'pr', icon: 'print', onClick: printModal }] });
}
// [BEHAVIOR] Printing the billing transmittal records today's date as Transmittal Date on each billing
function recordBillingTransmittal(scr, rows) {
  const ui = U(scr.id);
  rows.forEach(r => { logChange(scr, 'Update', r, [['Transmittal Date', 'date', r._raw.trans, TODAY], ['Print Transmittal?', 'check', r._raw.print_trans, false]]); r._raw.trans = TODAY; r._raw.print_trans = false; delete ui.edits[r.id]; });
}
// [BEHAVIOR] The Payment to Seller date typed in the print dialog (iso: ISO date, '' = blank, null = not a date): the first problem as text, or null when it can be recorded. Not before the latest Buyer Paid of the printed lots.
function paymentDateError(rows, iso) {
  const latest = rows.map(r => r.buyer_paid).filter(Boolean).sort().pop();
  if (iso === null) return 'Type the date as mm/dd/yyyy, or t for today.';
  if (!iso) return 'Payment date is required.';
  if (iso > TODAY) return 'Cannot be after today.';
  if (latest && iso < latest) return `Cannot be before ${fmtDate(latest)} (the latest Buyer Paid of these lots).`;
  return null;
}
// [BEHAVIOR] JBAP feedback (19 Oct 2026, FAD #1): printing the payment to seller records the payment date on every printed lot
function recordSellerPayment(scr, rows, iso) {
  rows.forEach(r => {
    clearTick(scr, r.id, 'print_seller'); clearTick(scr, r.id, 'pay_seller');   // a date typed on the row is replaced by the recorded one
    applyEdits(scr, [r.id]);   // other unsaved edits on the row (Payment Voucher No.) are saved now, while the row is still on this list: it leaves the list below
    delete U(scr.id).edits[r.id];   // nothing stays pending for a lot that has left the list
    logChange(scr, 'Update', r, [['Payment to Seller Date', 'date', r._raw.pay_seller, iso], ['Print Payment to Seller', 'check', r._raw.print_seller, false]]);
    r._raw.pay_seller = iso; r._raw.print_seller = false;
  });
}
// [BEHAVIOR] Sending the dispatch notice sets the Dispatch Date (date entered on the row, else today); pull-out deadline = 3 working days later
function recordDispatch(scr, rows, dateFor) {
  const ui = U(scr.id);
  rows.forEach(r => { const d = dateFor(r); logChange(scr, 'Update', r, [['Dispatch Date', 'date', r._raw.dispatch, d], ['For Dispatch Email?', 'check', r._raw.for_dispatch_email, false]]); r._raw.dispatch = d; r._raw.for_dispatch_email = false; delete ui.edits[r.id]; });
}
// [BEHAVIOR] JBAP answer Q5: of the lots ticked for the BAAF, those with a rebate and no approval date (typed on the row or saved) are held back with REBATE_NEEDS_APPROVAL; the others go
function baafSplit(rows, edits) {
  const eff = (r, k) => (k in (edits[r.id] || {}) ? edits[r.id][k] : r[k]);
  const held = rows.filter(r => rebateApprovalError(eff(r, 'rebate'), eff(r, 'rebate_approved'), true) === REBATE_NEEDS_APPROVAL);
  return { send: rows.filter(r => !held.includes(r)), held };
}
// [BEHAVIOR] Sending the BAAF records the Awarding Date (date entered, else today), the transfer fee (seller parameter) and, when there is one, the security bond and the rebate approval date on each lot
function recordAwarding(scr, rows) {
  const ui = U(scr.id);
  rows.forEach(r => {
    const e = ui.edits[r.id] || {}, award = e.awarding || TODAY, tf = r._raw.transfer_fee;
    const sb = 'security_bond' in e && e.security_bond !== '' ? Number(e.security_bond) : r.security_bond, bond = !!(sb || r.security_bond);   // a bond, or a bond overridden to 0
    const rb = 'rebate' in e ? (e.rebate === '' ? null : Number(e.rebate)) : r._raw.rebate;   // JBAP feedback (19 Oct 2026): the rebate typed on this screen is saved with the awarding
    const ra = 'rebate_approved' in e ? e.rebate_approved || null : r._raw.rebate_approved ?? null;   // JBAP answer Q5: so is the President's approval date
    logChange(scr, 'Update', r, [['Awarding Date', 'date', r._raw.awarding, award], ['Transfer Fees', 'money', r._raw.transfer_fee, tf],
      ...(bond ? [['Security Bond', 'money', r._raw.security_bond ?? null, sb]] : []), ['Rebate', 'money', r._raw.rebate ?? null, rb], ['Rebate Approved (President)', 'date', r._raw.rebate_approved ?? null, ra], ['For BAAF', 'check', r._raw.for_baaf, false]]);
    r._raw.awarding = award; r._raw.transfer_fee = tf; if (bond) r._raw.security_bond = sb; r._raw.rebate = rb; r._raw.rebate_approved = ra; r._raw.for_baaf = false; delete ui.edits[r.id];
  });
}
// [BEHAVIOR] VWD releases only when the seller's DOAS is signed (DOAS sellers) and no storage penalty is unpaid (JBAP Q17).
function releaseBlock(v) {
  if (v.status !== 'Sold') return null;   // [BEHAVIOR] wish 4: a unit returned to the seller was never sold, so DOAS and storage penalty do not apply
  if (releaseOf(v) === 'doas' && !v.buyer_doas && !v.seller_doas && !(doasOf(v) === 'branch' && v.ewb_signed)) return 'JBAP Receipt of Signed DOAS is missing: this seller requires DOAS / legal documents signing. FAD records it in Document Monitoring (EWB: Date DOAS Signed).';
  if (v.penalty > 0) return `Storage penalty of PHP ${money(v.penalty)} is unpaid. FAD records the payment in FAD › Unreleased Unit (Record payment).`;
  return null;
}
// [BEHAVIOR] Records the release on the lot (date, VRF No., released to, type, checklist) and returns the new VRF No. (running number, 5 digits)
function recordRelease(scr, v, f) {
  const co = D.meta.company, vrf = String(co.next.vrf++).padStart(5, '0');
  logChange(scr, 'Update', v, [['Vehicle Release Date', 'date', v._raw.release, f.date], ['VRF No.', 'text', v._raw.vrf_no, vrf],
    ['Released To', 'text', v._raw.release_to, f.to], ['Release Type', 'text', v._raw.release_type, f.type], ['Release Checklist', 'text', (v._raw.release_items || []).join(', '), f.items.join(', ')]]);
  Object.assign(v._raw, { release: f.date, vrf_no: vrf, release_to: f.to, release_type: f.type, release_items: f.items });
  return vrf;
}
// A read-only field of a dialog; the input carries the label as its accessible name (the visible label is not tied to it)
const roField = (label, val) => `<div class="fld"><label>${label}</label><input class="ctl" value="${esc(val)}" aria-label="${esc(label)}" readonly></div>`;
// [BEHAVIOR] JBAP feedback (16 Oct 2026, #9): paying the storage penalty records the full amount due today (optional OR / reference no.) and moves the dispatch deadline to today
function recordPenaltyPayment(scr, v, ref) {
  const amount = v.penalty;
  logChange(scr, 'Update', v, [['Penalty Paid', 'money', null, amount], ['Penalty Reference', 'text', null, ref || ''], ['Dispatch Deadline', 'date', v.dispatch_deadline, TODAY]]);
  (v._raw.penalty_payments ||= []).push({ date: TODAY, amount, ref: ref || '' });
  v._raw.deadline_reset = TODAY;
  return amount;
}
// [BEHAVIOR] Proposal Q74 (spec 2026-10-19 §4): FAD extends a unit's dispatch deadline with a new date, a reason and the approving FAD Manager. The new date becomes deadline_reset (so the storage penalty is recalculated)
// and each extension is kept in deadline_changes. Returns the first problem as text, or null when the entry can be saved (f.date: ISO date, '' = blank, null = not a date).
function extendError(v, f) {
  if (f.date === null) return 'Type the new deadline as mm/dd/yyyy, or t for today.';
  if (!f.date) return 'New deadline is required.';
  if (f.date <= v.dispatch_deadline) return `Must be after the current deadline (${fmtDate(v.dispatch_deadline)}).`;
  if (!f.reason) return 'Reason is required.';
  if (!f.by) return 'Approved by (FAD Manager) is required.';
  return null;
}
function recordDeadlineExtension(scr, v, f) {
  logChange(scr, 'Update', v, [['Dispatch Deadline', 'date', v.dispatch_deadline, f.date], ['Extension Reason', 'text', '', f.reason], ['Extension Approved By', 'text', '', f.by]]);
  (v._raw.deadline_changes ||= []).push({ date: TODAY, from: v.dispatch_deadline, to: f.date, reason: f.reason, by: f.by });
  v._raw.deadline_reset = f.date;
}
const RELEASE_ITEMS = ['No. of Keys', 'Copy of OR/CR', "Owner's Manual", 'Warranty booklet', 'Spare Tire', 'Tools', 'Jack', 'Radio', 'A/C', 'Accessories'];
// [BEHAVIOR] One cancellation billing letter per buyer name, the name printed on the letter (cid is missing on some lots).
const cancelLetterGroups = rows => { const g = {}; rows.forEach(r => (g[r.customer] ||= []).push(r)); return Object.values(g); };
// Removes one tick from a row's unsaved edits; other unsaved edits on the row stay pending
const clearTick = (scr, id, key) => { const ed = U(scr.id).edits; if (ed[id]) { delete ed[id][key]; if (!Object.keys(ed[id]).length) delete ed[id]; } };
// [BEHAVIOR] Saves the documents received and returns the ATF control number (HRAD-ATF-<running no.>); a reprint keeps the existing number.
function recordDocTransmittal(scr, v, docs, others, remarks = '') {
  const co = D.meta.company, atf = v._raw.atf_no || `HRAD-ATF-${co.next.atf++}`;
  logChange(scr, 'Update', v, [['Documents Received', 'text', (v._raw.docs_received || []).join(', '), docs.join(', ')], ['Documents Others', 'text', v._raw.docs_others, others], ['Documents Remarks', 'text', v._raw.docs_remarks, remarks],
    ['ATF Control No.', 'text', v._raw.atf_no, atf], ['Print Transmittal?', 'check', v._raw.print_doc_trans, false]]);
  Object.assign(v._raw, { docs_received: docs, docs_others: others, docs_remarks: remarks, atf_no: atf, print_doc_trans: false });
  clearTick(scr, v.id, 'print_doc_trans');   // unsaved date edits on the row stay pending
  return atf;
}
// [BEHAVIOR] Records a cancellation: Cancellation Entry, and P2 confirmations of cancellations made in CDMS
function recordCancellation(scr, v, f) {
  if (v._raw.status !== 'Sold') return false;   // [BEHAVIOR] a lot is cancelled once (Cancellation Entry and P2 share this guard)
  logChange(scr, 'Cancel', v, [['Status', 'text', v._raw.status, 'Cancelled'], ['Date Cancelled', 'date', null, f.date],
    ['Cancellation Fee Waived', null, null, f.waived], ['Justification of Waiver', 'text', null, f.just]]);
  v._raw.status = 'Cancelled';
  S.cancels.unshift({ id: `C-${v.auction}-${v.lot}-new`, auction: v.auction, lot: v.lot, plate: v.plate, customer: v.customer, cid: v.cid, dcancel: f.date,
    waived: f.waived, just: f.just, seller: v.seller, remitted: null, bill_date: null, paid_date: null, amount: null, for_print: false });
  return true;
}
// [MOCK] P2: lots cancelled in CDMS (data-extra.js > cdmsCancels) that FAD has not recorded yet (the vehicle is still Sold)
const cdmsCancelsPending = () => (D.cdmsCancels || []).map(c => ({ c, v: V().find(x => x.id === c.vid) })).filter(x => x.v && x.v.status === 'Sold');
// [BEHAVIOR] One commission billing per seller: adds the billing (Billing › Billing Monitoring and Unpaid Billing), marks the lots billed, logs both
function recordCommissionBilling(scr, code, no, bd, rows) {
  const bill = { no, customer: SELLER[code]?.name || code, particular: [...new Set(rows.map(r => r.adate))].join('; '), bdate: bd, total: Math.round(sumBy(rows, 'ctotal') * 100) / 100, trans: null, pay: null, cr: '' };
  S.billing.push(bill);
  logChange(scr, 'Create', bill, [['Customer', 'text', null, bill.customer], ['Billing Date', 'date', null, bd], ['Total', 'money', null, bill.total]]);
  const ed = U(scr.id).edits;
  rows.forEach(r => { logChange(scr, 'Update', r, [['Commission Billing No.', 'text', null, no], ['Print?', 'check', r._raw.print_comm, false]]); r._raw.billed = true; r._raw.print_comm = false; delete ed[r.id]; });
  return bill;
}
// [BEHAVIOR] P5: sending the SAAF records SAAF Sent = today on each lot (logged under SMD); SMD then enters the seller's approval
function recordSaafSent(scr, rows) {
  rows.forEach(r => { logChange(scr, 'Update', r, [['SAAF Sent', 'date', r._raw.saaf_sent, TODAY], ['For SAAF', 'check', r._raw.for_saaf, false]]);
    r._raw.saaf_sent = TODAY; r._raw.for_saaf = false; clearTick(scr, r.id, 'for_saaf'); });
}
// [BEHAVIOR] P5: with the switch on the dispatch email is copied to Finance only; VWD sees the lot in its own list
const dispatchCc = () => { const e = D.meta.company.emails; return PROPOSED ? e.finance : `${e.sales}; ${e.vwd}; ${e.finance}`; };
// [BEHAVIOR] Return to Seller: status Not Sold or Cancelled, not listed in an ongoing or future auction, no clearance and no release yet
const rtsEligible = v => ['Not Sold', 'Cancelled'].includes(v.status) && !listedAhead(v) && !v.rts_cleared && !v.release;
// [BEHAVIOR] JBAP feedback (19 Oct 2026, SMD #2): Number of Listing = auctions the unit was listed in (its lots, earlier listings, a relisting)
const listingsOf = v => S.veh.filter(x => x.plate === v.plate).length + (Number(v.prior_listings) || 0) + (v.next_auction ? 1 : 0);
// [BEHAVIOR] Wish 4: sending the clearance form records the clearance date (logged under SMD); the units then wait for the SMD Manager (SMD › Return to Seller › SMD Manager Approval), then the FAD Manager; VWD sees them only after both approve
function recordReturnClearance(scr, rows) {
  rows.forEach(r => { logChange(scr, 'Update', r, [['Return Clearance Date', 'date', r._raw.rts_cleared, TODAY], ['For Return', 'check', r._raw.for_return, false]]);
    r._raw.rts_cleared = TODAY; r._raw.for_return = false; clearTick(scr, r.id, 'for_return'); });
}
// [BEHAVIOR] Return to Seller approval: the date a unit leaves the yard cannot be before the Dispatch Date, the clearance or the FAD Manager approval (the later of the last two is named)
const returnFloor = v => [[v.rts_cleared, 'the Return to Seller clearance'], [v.rts_fad_ok, 'the FAD Manager approval']].filter(x => x[0]).reduce((a, b) => (!a || b[0] >= a[0] ? b : a), null) || [];
const releaseDateError = (v, date) => notFuture(date) || notBefore(date, v.dispatch, 'the Dispatch Date') || notBefore(date, ...returnFloor(v));
const ACTIONS = {
  save(scr) {
    const ui = U(scr.id);
    if (!dirtyCount(scr)) { setMsg(scr, 'info', 'There are no changes to save.'); render(); return; }
    const errs = validateEdits(scr);
    if (errs.length) { setMsg(scr, 'error', `Please fix ${errs.length} item(s) before saving:<br>${errs.slice(0, 6).join('<br>')}${errs.length > 6 ? '<br>…' : ''}`); render(); return; }
    const n = applyEdits(scr); setMsg(scr, null); ui.errors = {}; render();
    toast(`${n} record(s) saved. ${scr.savedNote || ''}`);
  },
  confirmCdmsCancel(scr, el) {
    const item = cdmsCancelsPending().find(x => x.v.id === el.dataset.rid), ui = U(scr.id); if (!item) return;
    cdmsCancelsPending().forEach(({ v }, n) => { const w = $(`#cc-w-${n}`), j = $(`#cc-j-${n}`); if (w && j) (ui.ccDraft ||= {})[v.id] = { waived: w.checked, just: j.value }; });
    const i = el.dataset.i, d = (ui.ccDraft || {})[item.v.id] || {}, waived = !!d.waived, just = (d.just || '').trim();
    // [BEHAVIOR] errors show in place (no re-render) so the ticked box and the typed text stay
    const fail = (msg, focus) => { $('#cc-err-t').textContent = msg; $('#cc-err').hidden = false; if (focus) $(focus)?.focus(); };
    if (waived && !just) { fail(`Enter the justification to waive the fee for ${item.v.plate}.`, `#cc-j-${i}`); return; }
    if (item.c.date > TODAY) { fail(`The CDMS cancellation date for ${item.v.plate} is after today.`); return; }
    if (item.v.awarding && item.c.date < item.v.awarding) { fail(`The CDMS cancellation date for ${item.v.plate} is before the Awarding Date (${fmtDate(item.v.awarding)}).`); return; }
    const done = recordCancellation(scr, item.v, { date: item.c.date, waived, just: just || item.c.reason });
    delete (ui.ccDraft || {})[item.v.id];
    if (ui.entry?.found?.id === item.v.id) ui.entry = null;   // the Find card must not offer a second cancellation of the same lot
    render(); toast(done ? `Cancellation of ${esc(item.v.plate)} confirmed from CDMS.` : `Lot ${esc(item.v.lot)} of Auction ${item.v.auction} is already cancelled.`, done ? '' : 'warn');
  },
  emailBaaf(scr) {
    const ticked = selectedRows(scr, 'for_baaf'), ui = U(scr.id);
    if (!ticked.length) { setMsg(scr, 'error', 'Tick <b>For BAAF</b> on at least one vehicle, then press Email BAAF.'); render(); return; }
    const { send: rows, held } = baafSplit(ticked, ui.edits);   // JBAP answer Q5: lots with a rebate and no approval date do not go
    const heldMsg = held.length ? `${held.length} vehicle(s) not sent:<br>${held.map(r => `Lot ${esc(r.lot || '-')} (${esc(r.plate || r.customer)}): ${esc(REBATE_NEEDS_APPROVAL)}`).join('<br>')}` : null;
    if (!rows.length) { setMsg(scr, 'error', heldMsg); render(); return; }
    const errs = validateEdits(scr, rows.map(r => r.id).filter(id => ui.edits[id]));
    if (errs.length) { setMsg(scr, 'error', `Please fix before sending:<br>${errs.join('<br>')}${heldMsg ? `<br>${heldMsg}` : ''}`); render(); return; }
    setMsg(scr, heldMsg ? 'error' : null, heldMsg); render();
    const groups = {}; rows.forEach(r => (groups[r.cid] ||= []).push(r));
    const eff = (r, k) => (k in (ui.edits[r.id] || {}) ? ui.edits[r.id][k] : r[k]);
    const lotsOf = list => list.map(r => Object.assign({}, r, { transfer_fee: Number(eff(r, 'transfer_fee') || 0), security_bond: Number(eff(r, 'security_bond') || 0),
      rebate: (v => v === '' || v == null ? null : Number(v))(eff(r, 'rebate')) }));   // the rebate typed on the screen goes on the BAAF rebate attachment before it is saved
    const buyerOf = list => ({ customer: list[0].customer, cid: list[0].cid, email: list[0].email });
    const docs = {};
    const mails = Object.values(groups).map(list => {
      const b = buyerOf(list), award = eff(list[0], 'awarding') || TODAY, lots = lotsOf(list), withRebate = lots.filter(r => r.rebate);
      docs[`aw:${b.cid}`] = ['JBAP AWARDING.pdf', () => REPORTS.awarding(b, lots, award)];
      const atts = [{ key: `aw:${b.cid}`, name: 'JBAP AWARDING.pdf' }];
      if (withRebate.length) { docs[`rb:${b.cid}`] = [`${b.customer}-rebate.pdf`, () => REPORTS.rebate(b, withRebate, addWorkdays(award, 3))]; atts.push({ key: `rb:${b.cid}`, name: `${b.customer}-rebate.pdf` }); }
      return REPORTS.email({ from: D.meta.company.emails.finance, to: `${b.customer} <${b.email}>`, cc: D.meta.company.emails.sales,
        subject: `NOTICE OF AWARDING - ${fmtDate(award)}`, atts,
        body: 'Congratulations!!<br>We are pleased to inform you that you have been awarded with the vehicles as attached. Please pay on or before the deadline indicated in the notice. Thank you!' });
    }).join('');
    openModal({ title: `Email BAAF: ${Object.keys(groups).length} buyer(s), ${rows.length} vehicle(s)`, icon: 'mail', wide: true, body: mails,
      note: `Simulated: no email is actually sent. Click an attachment to preview it.${held.length ? ` ${held.length} vehicle(s) held back: the rebate needs the President's approval date.` : ''}`, onAtt: key => openReport(docs[key][0], docs[key][1](), () => ACTIONS.emailBaaf(scr)),
      footer: [{ label: 'Cancel', kind: 'gh', onClick: closeModal }, { label: `Send ${Object.keys(groups).length} email(s)`, kind: 'pr', icon: 'mail', onClick: () => {
        recordAwarding(scr, rows);
        closeModal(); render(); toast(`BAAF sent to ${Object.keys(groups).length} buyer(s). ${rows.length} vehicle(s) moved to Unpaid.${held.length ? ` ${held.length} held back (rebate not approved).` : ''}`);
      } }] });
  },
  emailSaaf(scr) {
    const rows = selectedRows(scr, 'for_saaf').filter(r => !r.saaf_approved);   // [BEHAVIOR] P5: an approved lot is never sent again
    if (!rows.length) { setMsg(scr, 'error', 'Tick <b>For SAAF</b> on at least one lot first.'); render(); return; }
    setMsg(scr, null); render();
    const groups = {}; rows.forEach(r => (groups[r.seller] ||= []).push(r));
    const co = D.meta.company, n = Object.keys(groups).length;
    const mails = Object.entries(groups).map(([code, list]) => REPORTS.email({ from: co.emails.sales, to: `${SELLER[code]?.name || code} <${code.toLowerCase()}@sellers.example.com>`, cc: '',
      subject: `SELLER AWARDING ACKNOWLEDGEMENT - ${fmtDate(TODAY)}`, atts: [{ key: code, name: 'SAAF.pdf' }],
      body: `Please review the ${list.length} awarded lot(s) in the attached Seller Awarding Acknowledgement Form and reply to confirm, so we can send the notice of awarding to the buyers.` })).join('');
    openModal({ title: `Email SAAF: ${n} seller(s), ${rows.length} lot(s)`, icon: 'mail', wide: true, body: mails,
      note: 'Simulated: no email is actually sent. The SAAF layout is a placeholder until JBAP shares a sample.', onAtt: code => openReport('SAAF.pdf', REPORTS.saaf(code, groups[code], TODAY), () => ACTIONS.emailSaaf(scr)),
      footer: [{ label: 'Cancel', kind: 'gh', onClick: closeModal }, { label: `Send ${n} email(s)`, kind: 'pr', icon: 'mail', onClick: () => {
        recordSaafSent(scr, rows); closeModal(); render(); toast(`SAAF sent to ${n} seller(s). Enter Seller Approved when the seller replies.`);
      } }] });
  },
  printSeller(scr) {
    const rows = selectedRows(scr, 'print_seller');
    if (!rows.length) { setMsg(scr, 'error', 'Tick <b>Print Payment to Seller</b> on at least one vehicle first.'); render(); return; }
    setMsg(scr, null); render();
    const groups = {}; rows.forEach(r => (groups[r.seller] ||= []).push(r));
    const reportsDated = date => Object.entries(groups).map(([code, list]) => REPORTS.payableToSeller(code, list, date)).join(''), reports = reportsDated(TODAY);
    const body = `<div class="fgrid two no-print" style="padding:0 0 12px"><div class="fld"><label for="ps-date">Payment date</label>${dateField('ps-date', TODAY)}<span class="err" id="ps-date-err" role="alert"></span></div></div>${reports}`;
    openModal({ title: `Print payment to seller: ${rows.length} lot(s), ${Object.keys(groups).length} seller(s)`, icon: 'print', wide: true, body, note: 'Records the payment date on every printed lot.',
      footer: [{ label: 'Cancel', kind: 'gh', onClick: closeModal }, { label: 'Record payment date & print', kind: 'pr', icon: 'print', onClick: () => {
        const iso = parseDateInput($('#ps-date').value, TODAY), err = paymentDateError(rows, iso);
        $('#ps-date-err').textContent = err || ''; $('#ps-date').classList.toggle('is-invalid', !!err);
        if (err) { $('#ps-date').focus(); return; }
        recordSellerPayment(scr, rows, iso); render();
        // the printed report carries the recorded payment date
        openModal({ title: 'Print payment to seller', icon: 'print', wide: true, body: reportsDated(iso), footer: [{ label: 'Close', kind: 'gh', onClick: closeModal }, { label: 'Print', kind: 'pr', icon: 'print', onClick: printModal }] });
        printModal(); toast(`Payment to Seller date ${fmtDate(iso)} recorded on ${rows.length} lot(s). They moved to Seller Acknowledgement and Commission Billing.`);
      } }] });
  },
  printComm(scr) {
    const rows = selectedRows(scr, 'print_comm');
    if (!rows.length) { setMsg(scr, 'error', 'Tick <b>Print?</b> on at least one vehicle first.'); render(); return; }
    const sellers = [...new Set(rows.map(r => r.seller))], of = code => rows.filter(r => r.seller === code), many = sellers.length > 1;
    // [BEHAVIOR] CR scope: one seller at a time. P4 (switch on): several sellers in one go, one NOAH billing number each.
    if (many && !PROPOSED) { setMsg(scr, 'error', `Selected vehicles belong to ${sellers.length} sellers (${sellers.join(', ')}). Print one seller at a time: each NOAH billing is per seller (to confirm).`); render(); return; }
    setMsg(scr, null); render();
    const nos = sellers.map((code, i) => `<div class="fld"><label for="cb-no-${i}">Billing No. (from NOAH)${many ? ` · ${esc(code)}` : ''}</label><input class="ctl" id="cb-no-${i}" placeholder="e.g. 511" required><span class="err" id="cb-no-${i}-err"></span></div>`).join('');
    const p3 = PROPOSED ? `<p class="note no-print">${tagHtml({ tag: 'P3' })} Typed for now; comes through JBAP's NOAH integration once it is re-routed to CDMS.</p>` : '';
    const body = `<div class="fgrid two no-print" style="padding:0 0 12px">${nos}<div class="fld"><label for="cb-date">Billing Date</label>${dateField('cb-date', TODAY, 'required')}<span class="err" id="cb-date-err"></span></div></div>${p3}
      ${sellers.map(code => REPORTS.billingComputation(code, '(entered above)', TODAY, of(code))).join('')}`;
    openModal({ title: many ? `Print commission billing: ${sellers.length} sellers` : 'Print commission billing', icon: 'print', wide: true, body, note: 'Recording adds the billing to the Billing Monitoring and Unpaid Billing tabs.',
      footer: [{ label: 'Cancel', kind: 'gh', onClick: closeModal }, { label: many ? `Record ${sellers.length} billings & print` : 'Record billing & print', kind: 'pr', icon: 'print', onClick: () => {
        const bd = parseDateInput($('#cb-date').value, TODAY), entered = sellers.map((_, i) => $(`#cb-no-${i}`).value.trim()); let ok = true;
        $('#cb-date-err').textContent = ''; $('#cb-date').classList.remove('is-invalid');
        sellers.forEach((_, i) => {
          const no = entered[i], err = !no ? 'Billing No. is required.' : S.billing.some(b => b.no === no) ? `Billing No. ${no} already exists.` : entered.indexOf(no) !== i ? `Billing No. ${no} is entered twice.` : '';
          $(`#cb-no-${i}-err`).textContent = err; $(`#cb-no-${i}`).classList.toggle('is-invalid', !!err); if (err) ok = false;
        });
        const lastRemit = rows.map(r => r.pay_seller).sort().pop();
        if (bd === null) { $('#cb-date-err').textContent = 'Type the date as mm/dd/yyyy, or t for today.'; $('#cb-date').classList.add('is-invalid'); return; }
        if (!bd) { $('#cb-date-err').textContent = 'Billing Date is required.'; ok = false; }
        else if (bd > TODAY || bd < lastRemit) { $('#cb-date-err').textContent = `Must be between ${fmtDate(lastRemit)} and ${fmtDate(TODAY)}.`; $('#cb-date').classList.add('is-invalid'); ok = false; }
        if (!ok) return;
        const html = sellers.map((code, i) => { recordCommissionBilling(scr, code, entered[i], bd, of(code)); return REPORTS.billingComputation(code, entered[i], bd, of(code)); }).join('');
        render(); openModal({ title: many ? `Billing computation: ${sellers.length} billings` : `Billing computation #${entered[0]}`, icon: 'print', wide: true, body: html, footer: [{ label: 'Close', kind: 'gh', onClick: closeModal }, { label: 'Print', kind: 'pr', icon: 'print', onClick: printModal }] });
        printModal(); toast(`${many ? `${sellers.length} billings` : `Billing #${esc(entered[0])}`} recorded for ${rows.length} vehicle(s). See the Billing Monitoring and Unpaid Billing tabs.`);
      } }] });
  },
  printCancel(scr) {
    const rows = selectedRows(scr, 'for_print').filter(r => !r.bill_date);   // [BEHAVIOR] a billed lot is never billed again
    if (!rows.length) { setMsg(scr, 'error', 'Tick <b>For Print?</b> on at least one record first.'); render(); return; }
    setMsg(scr, null); render();
    const body = cancelLetterGroups(rows).map(list => REPORTS.cancellationLetter({ customer: list[0].customer }, list, TODAY)).join('');
    openModal({ title: 'Print cancellation billing', icon: 'print', wide: true, body, note: 'Recording sets the Cancellation Billing Date to today and the amount due to the penalty. The payment deadline stays blank until JBAP confirms it (Q33).',
      footer: [{ label: 'Cancel', kind: 'gh', onClick: closeModal }, { label: 'Record billing date & print', kind: 'pr', icon: 'print', onClick: () => {
        recordCancellationBilling(scr, rows);
        printModal(); closeModal(); render(); toast(`${rows.length} cancellation(s) billed. Enter Date Paid on this screen when the buyer pays.`);
      } }] });
  },
  // [BEHAVIOR] Rebate report: pick an auction range, then download an .xlsx (REPORTS.rebateWorkbook). It changes no data, so nothing is logged.
  downloadRebate(scr) {
    const lots = scr.rows(), auctions = [...new Set(lots.map(v => Number(v.auction)))].sort((a, b) => a - b);
    if (!lots.length) { setMsg(scr, 'info', 'There are no rebates to report.'); render(); return; }
    const opts = sel => auctions.map(a => `<option ${a === sel ? 'selected' : ''}>${a}</option>`).join('');
    const body = `<div class="fgrid two" style="padding:0 0 8px"><div class="fld"><label for="rb-from">From auction</label><select class="ctl" id="rb-from">${opts(auctions[0])}</select></div>
      <div class="fld"><label for="rb-to">To auction</label><select class="ctl" id="rb-to">${opts(auctions.at(-1))}</select></div></div>
      <p class="note" id="rb-count" role="status"></p><span class="err" id="rb-err"></span>`;
    const range = () => [Number($('#rb-from').value), Number($('#rb-to').value)];
    openModal({ title: 'Download rebate report', icon: 'download', body, note: 'Excel file (.xlsx): one row per lot with a rebate, laid out like JBAP\'s Rebate Monitoring file.',
      footer: [{ label: 'Cancel', kind: 'gh', onClick: closeModal }, { label: 'Download .xlsx', kind: 'pr', icon: 'download', onClick: () => {
        const [from, to] = range(), pick = rebateLotsIn(lots, from, to);
        if (from > to) { $('#rb-err').textContent = 'From auction cannot be after To auction.'; return; }
        if (!pick.length) { $('#rb-err').textContent = 'No lot in this range has a rebate.'; return; }
        saveFile(`JBAP Rebate Monitoring A${from}-A${to}.xlsx`, REPORTS.rebateWorkbook(pick, from, to), XLSX_TYPE);
        closeModal(); toast(`Rebate report downloaded: ${pick.length} lot(s), auctions ${from} to ${to}.`);
      } }] });
    const count = () => { const [from, to] = range(); $('#rb-err').textContent = ''; $('#rb-count').textContent = from > to ? '' : `${rebateLotsIn(lots, from, to).length} lot(s) with a rebate in this range.`; };
    count(); $('#rb-from').addEventListener('change', count); $('#rb-to').addEventListener('change', count);
  },
  printTransmittal(scr) {
    const rows = selectedRows(scr, 'print_trans');
    if (!rows.length) { setMsg(scr, 'error', 'Tick <b>Print Transmittal?</b> on at least one billing first.'); render(); return; }
    setMsg(scr, null); render();
    const groups = {}; rows.forEach(r => (groups[r.customer] ||= []).push(r));
    const body = Object.entries(groups).map(([cust, list]) => REPORTS.billingTransmittal(cust, list, TODAY)).join('');
    openModal({ title: `Billing transmittal: ${Object.keys(groups).length} customer(s)`, icon: 'print', wide: true, body, note: 'Recording sets the Transmittal Date to today.',
      footer: [{ label: 'Cancel', kind: 'gh', onClick: closeModal }, { label: 'Record transmittal date & print', kind: 'pr', icon: 'print', onClick: () => {
        recordBillingTransmittal(scr, rows); printModal(); closeModal(); render(); toast(`Transmittal Date recorded on ${rows.length} billing(s).`);
      } }] });
  },
  printDocTrans(scr) {
    const rows = selectedRows(scr, 'print_doc_trans');
    if (!rows.length) { setMsg(scr, 'error', 'Tick <b>Print Transmittal?</b> on at least one lot first.'); render(); return; }
    const missing = rows.filter(r => !r.orig_docs);
    if (missing.length) { setMsg(scr, 'error', `Enter <b>JBAP Receipt of Documents</b> and save first: ${missing.map(r => esc(r.plate)).join(', ')}.`); render(); return; }
    setMsg(scr, null); render();
    const form = rows.map((r, n) => `<fieldset class="dt-lot"><legend><b>${esc(r.plate)}</b> · ${esc(r.customer)}</legend><div class="cols2">${DOC_TYPES.map((t, i) => `<label class="chkline"><input type="checkbox" class="chk" id="dt-${n}-${i}" ${(r.docs_received || []).includes(t) ? 'checked' : ''}>${esc(t)}</label>`).join('')}</div>
      <div class="fld"><label for="dt-${n}-o">Others</label><input class="ctl" id="dt-${n}-o" value="${esc(r.docs_others || '')}"></div>
      <div class="fld"><label for="dt-${n}-r">Remarks</label><input class="ctl" id="dt-${n}-r" value="${esc(r.docs_remarks || '')}"></div></fieldset>`).join('');
    openModal({ title: `Document transmittal: ${rows.length} lot(s)`, icon: 'print', wide: true, body: form, note: 'Tick the documents received from the seller.',
      footer: [{ label: 'Cancel', kind: 'gh', onClick: closeModal }, { label: 'Record & print', kind: 'pr', icon: 'print', onClick: () => {
        const pages = rows.map((r, n) => { const docs = DOC_TYPES.filter((_, i) => $(`#dt-${n}-${i}`).checked), others = $(`#dt-${n}-o`).value.trim(), remarks = $(`#dt-${n}-r`).value.trim();
          if (others && !docs.includes('Others')) docs.push('Others');   // [BEHAVIOR] typed Others text counts as the Others document being received
          const atf = recordDocTransmittal(scr, r, docs, others, remarks); return REPORTS.documentTransmittal(enrichV(r._raw), docs, others, atf, remarks); }).join('');
        render(); openModal({ title: 'Auction transmittal form', icon: 'print', wide: true, body: pages, footer: [{ label: 'Close', kind: 'gh', onClick: closeModal }, { label: 'Print', kind: 'pr', icon: 'print', onClick: printModal }] });
        printModal(); toast(`Transmittal recorded for ${rows.length} lot(s).`);
      } }] });
  },
  emailDispatch(scr) {
    const rows = selectedRows(scr, 'for_dispatch_email'), ui = U(scr.id);
    if (!rows.length) { setMsg(scr, 'error', 'Tick <b>For Dispatch Email?</b> on at least one vehicle first.'); render(); return; }
    const errs = validateEdits(scr, rows.map(r => r.id).filter(id => ui.edits[id]));
    if (errs.length) { setMsg(scr, 'error', `Please fix before sending:<br>${errs.join('<br>')}`); render(); return; }
    setMsg(scr, null); render();
    const dateFor = r => (ui.edits[r.id] || {}).dispatch || TODAY, groups = {}; rows.forEach(r => (groups[r.cid] ||= []).push(r));
    const docs = {}, co = D.meta.company;
    const mails = Object.values(groups).map(list => {
      const b = { customer: list[0].customer, cid: list[0].cid, email: list[0].email };
      docs[b.cid] = () => REPORTS.dispatchForm(b, list, dateFor(list[0]));
      return REPORTS.email({ from: co.emails.finance, to: `${b.customer} <${b.email}>`, cc: dispatchCc(), subject: 'JBAP VEHICLE FOR RELEASE',
        atts: [{ key: b.cid, name: 'VEHICLE DISPATCH.pdf' }],
        body: `We are pleased to inform you that the vehicle(s) listed in the attached Vehicle Dispatch Form are now available for release. Kindly ensure that vehicles are pulled out on or before the specified deadline to avoid Storage Penalties amounting to Php ${money(PENALTY_PER_DAY)} per day, including weekends and until removal of vehicle. For vehicles requiring the signing of Deed of Absolute Sale (DOAS) and other Legal Documents prior to release, please proceed to the JBAP Office within the prescribed period to complete the signing. Please note that vehicles cannot be released without a signed DOAS / Legal Documents.` });
    }).join('');
    openModal({ title: `Email dispatch form: ${Object.keys(groups).length} buyer(s), ${rows.length} vehicle(s)`, icon: 'mail', wide: true, body: mails,
      note: 'Simulated: no email is actually sent. Click the attachment to preview it.', onAtt: key => openReport('VEHICLE DISPATCH.pdf', docs[key](), () => ACTIONS.emailDispatch(scr)),
      footer: [{ label: 'Cancel', kind: 'gh', onClick: closeModal }, { label: `Send ${Object.keys(groups).length} email(s)`, kind: 'pr', icon: 'mail', onClick: () => {
        recordDispatch(scr, rows, dateFor); closeModal(); render(); toast(`Dispatch form sent to ${Object.keys(groups).length} buyer(s). ${rows.length} vehicle(s) moved to Unreleased Unit.`);
      } }] });
  },
  printReturn(scr) {
    const rows = selectedRows(scr, 'for_return');
    if (!rows.length) { setMsg(scr, 'error', 'Tick <b>For Return</b> on at least one unit first.'); render(); return; }
    setMsg(scr, null); render();
    const groups = {}; rows.forEach(r => (groups[r.seller] ||= []).push(r));
    const co = D.meta.company, n = Object.keys(groups).length, name = code => SELLER[code]?.name || code;
    const forms = () => Object.entries(groups).map(([code, list]) => REPORTS.returnClearance(code, list, TODAY)).join('');
    const mails = Object.entries(groups).map(([code, list]) => REPORTS.email({ from: co.emails.sales, to: `${co.emails.finance}; ${co.emails.vwd}`, cc: '', subject: `RETURN TO SELLER - ${name(code)}`,
      atts: [{ key: code, name: 'RETURN TO SELLER CLEARANCE.pdf' }],
      body: `Please see the attached Vehicle Dispatch Clearance Form (Return to Seller) for ${list.length} unit(s) of ${esc(name(code))}. The units go to VWD after the SMD and FAD Managers approve them in CDMS; VWD then records the return when each unit leaves the yard.` })).join('');
    openModal({ title: `Return to seller: ${n} seller(s), ${rows.length} unit(s)`, icon: 'mail', wide: true, body: mails,
      note: 'Simulated: no email is actually sent. Click the attachment to preview the form.', onAtt: code => openReport('RETURN TO SELLER CLEARANCE.pdf', REPORTS.returnClearance(code, groups[code], TODAY), () => ACTIONS.printReturn(scr)),
      footer: [{ label: 'Cancel', kind: 'gh', onClick: closeModal }, { label: 'Send & print', kind: 'pr', icon: 'print', onClick: () => {
        recordReturnClearance(scr, rows); render();
        openModal({ title: 'Return to seller clearance', icon: 'print', wide: true, body: forms(), footer: [{ label: 'Close', kind: 'gh', onClick: closeModal }, { label: 'Print', kind: 'pr', icon: 'print', onClick: printModal }] });
        printModal(); toast(`${rows.length} unit(s) cleared for return. They wait for the SMD Manager in Return to Seller › SMD Manager Approval.`);
      } }] });
  },
  releaseVehicle(scr, el) {
    const v = scr.rows().find(r => r.id === el.dataset.rid); if (!v) return;
    const block = releaseBlock(v);
    if (block) { openModal({ title: `Cannot release ${v.plate}`, icon: 'ban', body: `<p>${esc(block)}</p>`, footer: [{ label: 'Close', kind: 'gh', onClick: closeModal }] }); return; }
    // [BEHAVIOR] wish 4: For Return to Seller presets the type and Released To (the seller), like a release to a buyer (Q18)
    const preset = scr.releaseType || 'Sold', toDefault = preset === 'Return to Seller' ? v.seller_full : v.customer;
    const items = RELEASE_ITEMS.map((t, i) => `<label class="chkline"><input type="checkbox" class="chk" id="rl-i${i}" value="${esc(t)}">${esc(t)}</label>`).join('');
    openModal({ title: `${preset === 'Return to Seller' ? 'Return' : 'Release'} ${v.plate} (${v.model})`, icon: 'play',
      body: `<div class="fgrid two"><div class="fld"><label for="rl-date">Release date</label>${dateField('rl-date', TODAY)}<span class="err" id="rl-date-err"></span></div>
        <div class="fld"><label for="rl-to">Released to</label><input class="ctl" id="rl-to" value="${esc(toDefault)}"></div>
        <div class="fld"><label for="rl-type">Type</label><select class="ctl" id="rl-type">${['Sold', 'Return to Seller', 'Others'].map(t => `<option ${t === preset ? 'selected' : ''}>${t}</option>`).join('')}</select></div><div></div>
        <div class="fld full"><span class="lbl">Checklist</span><div class="cols2">${items}</div></div></div>`,
      note: 'Records the release date and the next VRF No., then prints the release form and gate pass.',
      footer: [{ label: 'Cancel', kind: 'gh', onClick: closeModal }, { label: 'Release & print', kind: 'pr', icon: 'print', onClick: () => {
        const date = parseDateInput($('#rl-date').value, TODAY), err = date === null ? 'Type the date as mm/dd/yyyy, or t for today.' : !date ? 'Release date is required.' : releaseDateError(v, date);
        if (err) { $('#rl-date-err').textContent = err; $('#rl-date').classList.add('is-invalid'); return; }
        const f = { date, to: $('#rl-to').value.trim() || toDefault, type: $('#rl-type').value, items: RELEASE_ITEMS.filter((_, i) => $(`#rl-i${i}`).checked) };
        const vrf = recordRelease(scr, v, f); render();
        openModal({ title: `Vehicle release form VRF No. ${vrf}`, icon: 'print', wide: true, body: REPORTS.releaseForm(enrichV(v._raw), f, vrf),
          footer: [{ label: 'Close', kind: 'gh', onClick: closeModal }, { label: 'Print', kind: 'pr', icon: 'print', onClick: printModal }] });
        printModal(); toast(`${esc(v.plate)} ${f.type === 'Return to Seller' ? 'returned to the seller' : 'released'} (VRF No. ${vrf}).`);
      } }] });
  },
  payPenalty(scr, el) {
    const v = scr.rows().find(r => r.id === el.dataset.rid); if (!v || !(v.penalty > 0)) return;
    openModal({ title: `Record penalty payment: ${v.plate}`, icon: 'save',
      body: `<div class="fgrid two">${roField('Customer', v.customer)}${roField('Dispatch deadline', fmtDate(v.dispatch_deadline))}${roField('Days overdue', daysBetween(v.dispatch_deadline, TODAY))}${roField('Penalty due (PHP)', money(v.penalty))}
        <div class="fld full"><label for="pp-ref">Reference / OR No. (optional)</label><input class="ctl" id="pp-ref" placeholder="e.g. OR 12345"></div></div>
        <p class="note">Records the payment today (${fmtDate(TODAY)}) and moves the dispatch deadline to today. If the unit is still in the yard tomorrow, the penalty starts again (to confirm, Q84).</p>`,
      footer: [{ label: 'Cancel', kind: 'gh', onClick: closeModal }, { label: 'Record payment', kind: 'pr', icon: 'save', onClick: () => {
        const amount = recordPenaltyPayment(scr, v, $('#pp-ref').value.trim()); closeModal(); render();
        toast(`Penalty of PHP ${money(amount)} recorded for ${esc(v.plate)}. The dispatch deadline is now ${fmtDate(TODAY)}; the penalty no longer blocks the release.`);
      } }] });
    $('#pp-ref')?.focus();   // openModal focuses the first input (the read-only Customer)
  },
  extendDeadline(scr, el) {
    const v = scr.rows().find(r => r.id === el.dataset.rid); if (!v) return;
    openModal({ title: `Extend dispatch deadline: ${v.plate}`, icon: 'save',
      body: `<div class="fgrid two">${roField('Customer', v.customer)}${roField('Current deadline', fmtDate(v.dispatch_deadline))}${roField('Penalty due (PHP)', money(v.penalty || 0))}
        <div class="fld"><label for="xd-date">New deadline</label>${dateField('xd-date', '')}</div>
        <div class="fld full"><label for="xd-reason">Reason</label><textarea class="ctl" id="xd-reason" placeholder="Why the deadline is extended"></textarea></div>
        <div class="fld full"><label for="xd-by">Approved by (FAD Manager)</label><input class="ctl" id="xd-by" placeholder="Name of the FAD Manager" autocomplete="off"></div>
        <div class="fld full"><span class="err" id="xd-err" role="alert"></span></div></div>
        <p class="note">The storage penalty is recalculated from the new deadline (proposal, Q74).</p>`,
      footer: [{ label: 'Cancel', kind: 'gh', onClick: closeModal }, { label: 'Extend deadline', kind: 'pr', icon: 'save', onClick: () => {
        const f = { date: parseDateInput($('#xd-date').value, TODAY), reason: $('#xd-reason').value.trim(), by: $('#xd-by').value.trim() }, err = extendError(v, f);
        const bad = !f.date || f.date <= v.dispatch_deadline ? 'date' : !f.reason ? 'reason' : 'by';
        ['date', 'reason', 'by'].forEach(k => $(`#xd-${k}`).classList.toggle('is-invalid', !!err && k === bad));
        $('#xd-err').textContent = err || '';
        if (err) { $(`#xd-${bad}`).focus(); return; }
        recordDeadlineExtension(scr, v, f); closeModal(); render();
        toast(`Dispatch deadline of ${esc(v.plate)} extended to ${fmtDate(f.date)}.`);
      } }] });
    $('#xd-date')?.focus();   // openModal focuses the first input (the read-only Customer)
  },
  // [BEHAVIOR] JBAP answer Q14: a holiday is removed after a confirmation; deadlines and aging count the day again
  removeHoliday(scr, el) {
    const h = S.holidays.find(x => x.date === el.dataset.rid); if (!h) return;
    openModal({ title: 'Remove this holiday?', icon: 'ban',
      body: `<p><b>${esc(h.name)}</b> (${fmtDate(h.date)}, ${esc(h.type)}) will be removed from the holiday list.</p><p>Deadlines and aging count that date as a working day again (a Saturday or Sunday stays a non-working day).</p>`,
      footer: [{ label: 'Keep holiday', kind: 'gh', onClick: closeModal }, { label: 'Remove holiday', kind: 'dg', icon: 'ban', onClick: () => {
        recordHolidayRemove(scr, h.date); closeModal(); render(); toast(`Holiday removed: ${fmtDate(h.date)}, ${esc(h.name)}.`);
      } }] });
  },
  resetFilter(scr) { const ui = U(scr.id), key = filterFocusKey(document.activeElement); ui.filters = {}; ui.applied = {}; ui.page = 1; render(); refocusFilter($('#content'), key); },
  entryClear(scr) { U(scr.id).entry = null; render(); },
};

// ─── Events (delegated) ───────────────────────────────────────────────
// Reads a typed date box: shows it as mm/dd/yyyy when it is a date and returns the ISO date, '' (blank) or the text as typed (not a date, flagged red)
function commitDate(el) {
  const iso = parseDateInput(el.value, TODAY);
  if (iso === null) { el.title = 'Type a date as mm/dd/yyyy, or t for today'; return el.value.trim(); }
  el.value = dateText(iso); el.removeAttribute('title'); return iso;
}
function onEdit(el) {
  const scr = currentScr(); if (!scr) return;
  const ui = U(scr.id), id = el.dataset.row, key = el.dataset.key;
  const row = scr.rows().find(r => r.id === id); if (!row) return;
  const isDate = el.classList.contains('dt'), val = el.type === 'checkbox' ? el.checked : isDate ? commitDate(el) : el.value;
  const orig = row[key], same = el.type === 'checkbox' ? tickDefault(scr, row, key) === val : String(orig ?? '') === String(val ?? '');   // a pre-ticked box (P4) is the baseline
  if (same) { if (ui.edits[id]) { delete ui.edits[id][key]; if (!Object.keys(ui.edits[id]).length) delete ui.edits[id]; } }
  else (ui.edits[id] ||= {})[key] = val;
  el.classList.toggle('is-dirty', !same); el.classList.toggle('is-invalid', isDate && val !== '' && !ISO_RE.test(val));
  el.closest('tr')?.classList.toggle('is-dirty', !!ui.edits[id]);
  // refresh button counters without re-rendering (keeps focus in the table)
  (scr.buttons || []).forEach(b => { const n = b.act === 'save' ? dirtyCount(scr) : effectiveCount(scr, b.count); const s = $(`[data-count="${b.act}"]`); if (s) { s.textContent = n; s.hidden = !n; } });
}
const tickedOf = (root, k) => [...root.querySelectorAll(`[data-mfilter="${k}"]:checked`)].map(i => i.value);
function bind() {
  const content = $('#content'), menu = $('#menu');
  menu.addEventListener('click', ev => {
    const g = ev.target.closest('[data-group]'); if (g) { OPEN[g.dataset.group] = !OPEN[g.dataset.group]; renderSide(route()); return; }
    const d = ev.target.closest('[data-disabled]'); if (d) { toast(`“${esc(d.dataset.disabled)}” is not part of this prototype. Only Customer Inquiry, Report, FAD, SMD, VWD, Settings and Log Activity are active.`, 'warn'); return; }
    if (ev.target.closest('.mis, a.mi')) document.body.classList.remove('nav-open');
  });
  content.addEventListener('change', ev => {
    const el = ev.target;
    if (el.dataset.row) return onEdit(el);
    if (el.dataset.mfilter) {   // a ticked dropdown value is kept as a draft until Apply filter; the dropdown's button shows what is ticked
      const k = el.dataset.mfilter, picked = tickedOf(content, k); U(route()).filters[k] = picked;
      const sum = el.closest('details')?.querySelector('summary'), t = sum?.querySelector('.msel-t'); if (t) { t.textContent = filterLabel(picked); sum.title = t.textContent; }
      return;
    }
    if (el.matches('[data-size]')) { const ui = U(route()); ui.size = +el.value; ui.page = 1; render(); }
  });
  content.addEventListener('input', ev => {
    const el = ev.target;
    if (el.dataset.row && el.type !== 'checkbox' && !el.classList.contains('dt')) return onEdit(el);   // a typed date is read when it is committed (change)
    if (el.dataset.filter) U(route()).filters[el.dataset.filter] = el.value;
  });
  content.addEventListener('submit', ev => {
    ev.preventDefault(); const scr = currentScr(); if (!scr) return; const ui = U(scr.id), form = ev.target.dataset.form;
    if (form === 'filter') {
      content.querySelectorAll('[data-filter]').forEach(i => { ui.filters[i.dataset.filter] = i.value; });
      content.querySelectorAll('[data-msel]').forEach(d => { ui.filters[d.dataset.msel] = tickedOf(d, d.dataset.msel); });
      const key = filterFocusKey(document.activeElement);
      ui.applied = JSON.parse(JSON.stringify(ui.filters)); ui.page = 1; render(); refocusFilter(content, key);
    }
    if (form === 'query') {
      // [BEHAVIOR] text that is not a date stays in the box, marked invalid, and no query is run; a blank box still means today
      const iso = parseDateInput($('#q-asof').value, TODAY), box = $('#q-asof'), err = $('#q-asof-err');
      if (iso === null) { err.textContent = 'Type the date as mm/dd/yyyy, or t for today.'; box.classList.add('is-invalid'); return; }
      err.textContent = ''; box.classList.remove('is-invalid');
      ui.asOf = iso || TODAY; ui.page = 1; render(); toast(`Liability generated as of ${fmtDate(ui.asOf)}.`);
    }
    if (form === 'find') entryFind(scr);
    if (form === 'holiday') holidayAdd(scr);
    if (form === 'cancel') entryCancel(scr);
  });
  content.addEventListener('click', ev => {
    const scr = currentScr(); if (!scr) return; const ui = U(scr.id);
    const s = ev.target.closest('[data-sort]'); if (s) { const k = s.dataset.sort; ui.sort = ui.sort && ui.sort[0] === k && ui.sort[1] === 'asc' ? [k, 'desc'] : [k, 'asc']; render(); return; }
    const p = ev.target.closest('[data-page]'); if (p && !p.disabled) { ui.page = +p.dataset.page; render(); return; }
    const a = ev.target.closest('[data-act]'); if (a && ACTIONS[a.dataset.act]) ACTIONS[a.dataset.act](scr, a);
  });
  $('#burger').addEventListener('click', () => document.body.classList.toggle('nav-open'));
  $('#home-logo').addEventListener('click', () => { location.hash = '#/'; });
  const sw = $('#proposed-switch');
  if (sw) { sw.checked = PROPOSED; sw.addEventListener('change', () => { setProposed(sw.checked); if (!PROPOSED) dropHolds(); closeModal(); render(); toast(PROPOSED ? 'Proposed improvements on: changes are tagged "Proposed P2" to "P6".' : 'Proposed improvements off: the prototype follows the CR form.'); }); }
  window.addEventListener('hashchange', ev => {   // switching lot lists on the same customer page keeps the scroll position
    closeModal(); render();
    const was = custRoute((ev.oldURL || '').split('#')[1]?.replace(/^\/?/, '')), now = custRoute(route());
    if (!(was && now && was.cid === now.cid)) window.scrollTo(0, 0);
  });
  // Filter dropdowns (multi-select): Escape, a click elsewhere, or tabbing away closes the open one; Enter / Space on the button opens it (native details).
  // Tabbing away is read after the Tab key has moved focus. Do not close on focusin: a mouse press on a tick box's label moves focus to <main> before the click completes.
  const closeMsel = except => document.querySelectorAll('details.msel[open]').forEach(d => { if (!except || !d.contains(except)) d.open = false; });
  document.addEventListener('keydown', ev => {
    if (ev.key === 'Tab') { setTimeout(() => closeMsel(document.activeElement)); return; }
    if (ev.key !== 'Escape') return; const d = document.querySelector('details.msel[open]'); if (!d) return;
    const inside = d.contains(ev.target); d.open = false; if (inside) d.querySelector('summary').focus();
  });
  document.addEventListener('click', ev => closeMsel(ev.target));
  // Typed dates everywhere (lists, forms, dialogs): Enter commits; the calendar button fills the box from the browser's picker
  const picker = document.createElement('input'); picker.type = 'date'; picker.id = 'dt-picker'; picker.tabIndex = -1; picker.setAttribute('aria-hidden', 'true'); document.body.appendChild(picker);
  let pickFor = null;
  document.addEventListener('keydown', ev => { if (ev.key === 'Enter' && ev.target.classList?.contains('dt')) ev.target.dispatchEvent(new Event('change', { bubbles: true })); });
  document.addEventListener('change', ev => { const el = ev.target; if (el.classList?.contains('dt') && !el.dataset.row) { el.classList.toggle('is-invalid', parseDateInput(el.value, TODAY) === null); commitDate(el); } });
  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-pick]'); if (!b) return;
    pickFor = b.parentElement.querySelector('.dt'); if (!pickFor || pickFor.disabled) return;
    const r = b.getBoundingClientRect(); picker.style.left = `${r.left}px`; picker.style.top = `${r.bottom}px`;
    picker.value = parseDateInput(pickFor.value, TODAY) || '';
    try { picker.showPicker(); } catch { picker.focus(); }
  });
  picker.addEventListener('change', () => { if (!pickFor) return; pickFor.value = dateText(picker.value); pickFor.dispatchEvent(new Event('change', { bubbles: true })); });
}

// ─── Cancellation Entry behaviour ─────────────────────────────────────
function entryFind(scr) {
  const ui = U(scr.id), e = ui.entry || (ui.entry = {});
  e.auction = $('#ce-auction').value.trim(); e.lot = $('#ce-lot').value.trim(); e.errors = {}; e.found = null; e.note = '';
  if (!/^\d+$/.test(e.auction)) e.errors.auction = 'Enter a numeric Auction No.';
  if (!/^\d+$/.test(e.lot)) e.errors.lot = 'Enter a numeric Lot.';
  if (!Object.keys(e.errors).length) {
    const lot = e.lot.padStart(3, '0'), v = V().find(x => String(x.auction) === e.auction && x.lot === lot);
    if (!v) e.note = `No transaction found for Auction ${e.auction}, Lot ${lot}.`;
    else { e.found = v; e.form = { status: v.status === 'Sold' ? 'Sold' : v.status, date: TODAY, waived: false, just: '' }; e.note = `1 transaction found: Lot ${lot} of Auction ${e.auction}.`; }
  }
  render();
}
function entryCancel(scr) {
  const e = U(scr.id).entry, v = e.found;
  const dr = $('#ce-date').value.trim(), dd = parseDateInput(dr, TODAY);
  e.form = { status: $('#ce-status').value, date: dd === null ? dr : dd, waived: $('#ce-waived').checked, just: $('#ce-just').value.trim() };
  e.errors = {};
  if (e.form.status !== 'Cancelled') e.errors.status = 'Change Status to Cancelled.';
  if (!e.form.date) e.errors.date = 'Date Cancelled is required.';
  else if (!ISO_RE.test(e.form.date)) e.errors.date = 'Type the date as mm/dd/yyyy, or t for today.';
  else if (e.form.date > TODAY) e.errors.date = 'Cannot be after today.';
  else if (v.awarding && e.form.date < v.awarding) e.errors.date = `Cannot be before the Awarding Date (${fmtDate(v.awarding)}).`;
  if (!e.form.just) e.errors.just = e.form.waived ? 'Justification is required when the fee is waived.' : 'Enter the reason for cancellation.';
  if (Object.keys(e.errors).length) { render(); return; }
  openModal({ title: 'Cancel this transaction?', icon: 'ban',
    body: `<p>Lot <b>${esc(v.lot)}</b> of Auction <b>${v.auction}</b> (${esc(v.plate)}, ${esc(v.customer)}) will be set to <b>Cancelled</b> on ${fmtDate(e.form.date)}.</p>
      <p>Cancellation fee: <b>${e.form.waived ? 'waived' : 'to be billed'}</b>. The vehicle leaves all FAD work lists${e.form.waived ? '' : ' and appears in Cancellation Billing & Payment'}.</p>`,
    footer: [{ label: 'Keep transaction', kind: 'gh', onClick: closeModal }, { label: 'Cancel transaction', kind: 'dg', icon: 'ban', onClick: () => {
      if (!recordCancellation(scr, v, e.form)) { U(scr.id).entry = null; closeModal(); render(); toast(`Lot ${esc(v.lot)} of Auction ${v.auction} is already cancelled.`, 'warn'); return; }
      U(scr.id).entry = null; closeModal(); render(); toast(`Lot ${esc(v.lot)} of Auction ${v.auction} cancelled.`);
    } }] });
}

// ─── Init ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (!D) { $('#content').innerHTML = '<div class="msg error">data.js did not load. Keep data.js next to index.html and load it before app.js.</div>'; return; }
  bind(); render();
});
