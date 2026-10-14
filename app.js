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
// [BEHAVIOR] Working days skip Saturday and Sunday only. Holiday list is an open question (Q44).
function addWorkdays(iso, n) { let d = toDate(iso), left = n; while (left > 0) { d.setUTCDate(d.getUTCDate() + 1); const w = d.getUTCDay(); if (w !== 0 && w !== 6) left--; } return toIso(d); }
const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000);

const IC = {
  filter: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h18l-7 8v6l-4 2v-8z"/></svg>',
  table: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 9h18M3 14h18M9 9v11"/></svg>',
  lock: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><rect x="5" y="11" width="14" height="10" rx="1.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  pen: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  info: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>',
  search: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>',
  print: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M7 9V3h10v6"/><rect x="3.5" y="9" width="17" height="8" rx="1.5"/><path d="M7 14h10v7H7z"/></svg>',
  mail: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3.5 6l8.5 7 8.5-7"/></svg>',
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
  LOG: '<rect x="4.5" y="3.5" width="13" height="17.5" rx="1.4"/><path d="M8 3.5V2.5h6v2H8z"/><path d="M7.5 9h7M7.5 12.5h4"/><circle cx="17" cy="17" r="4.2"/><path d="M17 15v2.2l1.4 1"/>',
};
const deptSvg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${DEPT_ICON[d]}</svg>`;

// ─── State ────────────────────────────────────────────────────────────
// [MOCK] Deep copy of data.js so "Reset demo data" is just a page refresh.
const S = D ? JSON.parse(JSON.stringify({ veh: D.vehicles, cancels: D.cancellations, billing: D.billing, log: [] })) : null;
const SELLER = D ? Object.fromEntries(D.sellers.map(s => [s.code, s])) : {};
const UI = {};          // per-screen UI state: filters, sort, page, edits, errors, message
const OPEN = { FAD: false, SMD: false, VWD: false };

// ─── Derived fields (business rules from the Access guideline) ────────
const RELEASE_LABEL = { payment: 'Buyer Payment', ack: 'Seller Acknowledgement', doas: 'Required DOAS / Legal Documents signing' };
const releaseOf = v => SELLER[v.seller]?.release || 'ack';
// [BEHAVIOR] Dispatch notice per seller condition (Dispatch Condition per seller): payment and DOAS sellers after Buyer Paid,
// others after Seller Acknowledgement. DOAS sellers still need the signed DOAS before VWD releases.
const dispatchReady = v => releaseOf(v) === 'ack' ? !!v.seller_ack : !!v.buyer_paid;
// [BEHAVIOR] Commission (÷1.12 when the seller's 5% includes VAT), VAT 12%, W/TAX 15% for NET sellers,
// To JBAP = commission + VAT − W/TAX (0 for GROSS sellers), Payable to Seller = price + fee − To JBAP. Unrounded until displayed.
function sellerMoney(v) {
  const s = SELLER[v.seller] || {}, price = v.price;
  if (price === null || price === undefined) return { com: null, cvat: null, ctotal: null, wtax: null, to_jbap: null, payable: null };
  const rate = s.commission_rate ?? COMMISSION_RATE, com = s.vat_inclusive ? price * rate / (1 + VAT_RATE) : price * rate;
  const vat = com * VAT_RATE, net = s.net !== false, wtax = net ? com * WTAX_RATE : 0, toJbap = net ? com + vat - wtax : 0;
  return { com: r2(com), cvat: r2(r2(com + vat) - r2(com)), ctotal: r2(com + vat), wtax: r2(wtax), to_jbap: r2(toJbap), payable: r2(price + (v.transfer_fee || 0) - toJbap) };
}
function enrichV(v) {
  const [as, ae] = D.auctions[String(v.auction)] || [null, null];
  const buyer_deadline = v.awarding ? addWorkdays(v.awarding, 3) : null;     // 3 working days after awarding
  const pay_deadline = v.buyer_paid ? addWorkdays(v.buyer_paid, 3) : null;   // 3 working days after buyer paid
  const dispatch_deadline = v.dispatch ? addWorkdays(v.dispatch, 3) : null;  // 3 working days after dispatch
  const overdue = v.dispatch && !v.release && dispatch_deadline < TODAY;
  return Object.assign({}, v, {
    _raw: v, auction_start: as, auction_end: ae, adate: as ? `${fmtDate(as)} - ${fmtDate(ae)}` : '',
    seller_full: SELLER[v.seller]?.name || v.seller, total: v.price === null ? null : v.price + (v.transfer_fee || 0),
    release_cond: RELEASE_LABEL[releaseOf(v)],
    buyer_deadline, pay_deadline, dispatch_deadline,
    penalty: overdue && PENALTY_LOCATIONS.includes(v.location || 'Pasay City') ? daysBetween(dispatch_deadline, TODAY) * PENALTY_PER_DAY : null,
    ...sellerMoney(v),
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
// [MOCK] legacy billed cancellations without an amount default to the penalty, so Save on Cancellation Payment works
if (S) S.cancels.forEach(c => { if (c.bill_date && (c.amount === null || c.amount === undefined)) c.amount = cancelSplit(Object.assign({}, c, { seller: cancelSeller(c) })).penalty; });
const SMD = k => D.smd[k].map((r, i) => Object.assign({ id: `${k}-${i}` }, r));
// ─── Activity log (one entry per changed field; entries are never edited or deleted) ──
const LOG_ID = 'log-activity';
const LOG_USER = 'system';   // [MOCK] the header user; there is no real login in the prototype
const addLog = e => S.log.push(Object.assign({ id: `L${S.log.length + 1}`, date: e.at.slice(0, 10) }, e));
if (S) (D.activityLog || []).forEach(addLog);
const logVal = (type, v) => type === 'check' ? (v ? 'Yes' : 'No') : v === null || v === undefined || v === '' ? ''
  : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : type === 'date' ? fmtDate(v) : type === 'money' ? money(v) : String(v);
const logRecord = r => r.auction ? `Auction ${r.auction}, Lot ${r.lot || '-'}${r.plate ? ` · ${r.plate}` : ''}` : `Billing #${r.no}`;
// [BEHAVIOR] changes: [[field label, type, old value, new value]]. Update rows whose value did not change are skipped.
function logChange(scr, action, r, changes) {
  const at = `${TODAY} ${new Date().toTimeString().slice(0, 8)}`;   // demo date + real clock time
  changes.forEach(([field, type, o, n]) => {
    const old = logVal(type, o), nw = logVal(type, n);
    if (action !== 'Update' || old !== nw) addLog({ at, user: LOG_USER, module: scr.dept, screen: scr.title, action, record: logRecord(r), field, old, new: nw });
  });
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

// [BEHAVIOR] Document dates: not in the future, not before Buyer Paid, DOAS steps in order (received → buyer signed → seller receipt),
// documents released to the buyer only after the originals arrive from the seller.
function docValidate(r, e) {
  const val = k => (k in e ? e[k] : r[k]) || null, out = {};
  ['rcv_doas', 'buyer_doas', 'seller_doas', 'orig_docs', 'to_buyer'].forEach(k => { out[k] = notFuture(val(k)) || notBefore(val(k), r.buyer_paid, 'Buyer Paid'); });
  out.buyer_doas ||= notBefore(val('buyer_doas'), val('rcv_doas'), 'Received DOAS for Signing');
  out.seller_doas ||= notBefore(val('seller_doas'), val('buyer_doas'), 'Buyer Signed DOAS');
  out.to_buyer ||= notBefore(val('to_buyer'), val('orig_docs'), 'Original Docs Received from Seller');
  return out;
}
const AM_COLS = [C('Auction Number', 'auction', 'code'), C('Lot', 'lot', 'code'), C('Plate Number', 'plate', 'code'), C('Customer Name', 'customer', 'text', { w: 150 }),
  C('Seller', 'seller', 'code'), C('Status', 'status', 'status'), C('Result Price', 'price', 'money'), C('Awarding Date', 'awarding', 'date'), C('Buyer Paid', 'buyer_paid', 'date'),
  C('Payment to Seller', 'pay_seller', 'date'), C('Seller Acknowl\u00adedgement', 'seller_ack', 'date'), C('Dispatch Date', 'dispatch', 'date'), C('Release Date', 'release', 'date'),
  C('Received DOAS for Signing', 'rcv_doas', 'date'), C('Buyer Signed DOAS', 'buyer_doas', 'date'), C('Seller Receipt of Signed DOAS', 'seller_doas', 'date'),
  C('Original Docs Received from Seller', 'orig_docs', 'date'), C('Documents Released to Buyer', 'to_buyer', 'date')];
const AM_FILTERS = [AUCTION_FILTER, { key: 'lot', label: 'Lot', type: 'text', w: 'w1' }, { key: 'plate', label: 'Plate Number' }, { key: 'customer', label: 'Customer Name' },
  { key: 'seller', label: 'Seller', type: 'select', options: sellerOpts }, { key: 'status', label: 'Status', type: 'select', options: () => ['Sold', 'Not Sold', 'Cancelled'] }];
const amTotals = rows => { const s = rows.filter(r => r.status === 'Sold'); return { customer: `${rows.length} lots, ${s.length} sold`, price: money(sumBy(s, 'price')) }; };
const RESULT_COLS = [C('Auction Number', 'auction', 'code'), C('Sold Units', 'units', 'int'), C('Total Awarded Price', 'total', 'money'), C('Average Price per Unit', 'avg', 'money'),
  C('Total Commission', 'comm', 'money'), C('Rebates', 'rebates', 'money'), C('Month', 'month', 'code')];
const resultTotals = rows => { const u = sumBy(rows, 'units'), t = sumBy(rows, 'total'); return { units: intf(u), total: money(t), avg: money(u ? t / u : 0), comm: money(sumBy(rows, 'comm')), rebates: money(sumBy(rows, 'rebates')) }; };
const UNREL_COLS = [C('Customer Name', 'customer', 'text', { w: 280 }), C('Auction Date', 'adate', 'code'), C('Make/Model', 'model', 'text', { w: 240 }), C('Plate Number', 'plate', 'code'),
  C('Location', 'location', 'code'), C('Dispatch Deadline', 'dispatch_deadline', 'date', { late: true }), C('Penalty', 'penalty', 'money')];
const UNREL_FILTERS = [AUCTION_FILTER, { key: 'customer', label: 'Customer Name' }, { key: 'plate', label: 'Plate Number' }, { key: 'dispatch_deadline', label: 'Dispatch Deadline', type: 'daterange', w: 'w2' }];
const CXMON_COLS = [C('Auction No.', 'auction', 'code'), C('Lot No.', 'lot', 'code'), C('Customer Name', 'customer', 'text', { w: 260 }), C('Customer ID', 'cid', 'code'),
  C('Plate Num', 'plate', 'code'), C('Date Cancelled', 'dcancel', 'date'), C('Waived?', 'waived', 'rocheck'), C('Justification', 'just', 'text', { w: 330 }),
  C('Cancellation Fee Remitted', 'remitted', 'date')];
const REBMON_COLS = [C('Auction Date', 'adate', 'code'), C('Lot', 'lot', 'code'), C('Customer Name', 'customer', 'text', { w: 320 }), C('Plate', 'plate', 'code'),
  C('Rebate', 'rebate', 'money'), C('Buyer Paid', 'buyer_paid', 'date'), C('Rebate Paid', 'rebate_paid', 'date')];

const SCREENS = [
  // ===================== FAD =====================
  // [MOCK] Snapshot of the Access Result Summary (10/08/2026): the sample has only some lots per auction, so totals are not recalculated
  { dept: 'FAD', slug: 'result-summary', title: 'Result Summary', actions: VFS, rule: 'One row per auction. Average price per unit = Total awarded price ÷ Sold units. Prototype: figures copied from the Access Result Summary of 10/08/2026; they do not change when lots are updated here.',
    rows: () => D.fadResult.map(r => Object.assign({ id: r.auction }, r)), cols: RESULT_COLS, sort: ['auction', 'desc'], totals: resultTotals,
    filters: [{ key: 'month', label: 'Month', type: 'select', options: () => [...new Set(D.fadResult.map(r => r.month))] },
      { key: 'year', label: 'Year', type: 'select', w: 'w1', options: () => [...new Set(D.fadResult.map(r => r.year))] }, AUCTION_FILTER] },
  { dept: 'FAD', slug: 'auction-monitoring', title: 'Auction Monitoring', actions: VFS, compact: true,
    rule: 'Auction result per auction and lot, with every milestone date from awarding to release to the buyer.',
    rows: V, cols: AM_COLS, sort: ['auction', 'desc'], filters: AM_FILTERS, totals: amTotals },
  { dept: 'FAD', slug: 'pending-awarding', title: 'Pending Awarding', actions: VFSU,
    rule: 'Vehicles with status SOLD and a blank Awarding Date. Tick For BAAF and press Email BAAF to award. Transfer fees default from the seller settings; override when the actual fee differs.',
    rows: () => sold().filter(v => !v.awarding), sort: ['lot', 'asc'],
    cols: [C('Auction Number', 'auction', 'code'), C('Lot', 'lot', 'code'), C('Customer Name', 'customer', 'text', { w: 230 }), C('For BAAF', 'for_baaf', 'check', { edit: 'check' }),
      C('Awarding Date', 'awarding', 'date', { edit: 'date' }), C('Rebate', 'rebate', 'money'), C('Seller', 'seller', 'code'), C('Plate Number', 'plate', 'code'),
      C('Make/Model', 'model', 'text', { w: 210 }), C('Result Price', 'price', 'money'), C('Transfer Fees', 'transfer_fee', 'money', { edit: 'money' })],
    filters: [AUCTION_FILTER, { key: 'seller', label: 'Seller', type: 'select', options: sellerOpts }, { key: 'customer', label: 'Customer Name' }, { key: 'plate', label: 'Plate Number' }],
    validate: (r, e) => ({ awarding: notFuture(e.awarding) || notBefore(e.awarding, r.auction_end, 'the auction end'),
      transfer_fee: 'transfer_fee' in e && (e.transfer_fee === '' || Number(e.transfer_fee) < 0) ? 'must be 0 or more' : null }),
    buttons: [{ label: 'Email BAAF', kind: 'ol', icon: 'mail', act: 'emailBaaf', count: 'for_baaf' }, { label: 'Save changes', kind: 'pr', icon: 'save', act: 'save' }],
    savedNote: 'Vehicles with an Awarding Date moved to Unpaid.' },
  { dept: 'FAD', slug: 'unpaid', title: 'Unpaid', actions: VFSU, rule: 'Vehicles with status SOLD, an Awarding Date, and a blank Buyer Paid date. Total = Awarded price + Transfer fees. Buyer deadline = 3 working days after awarding.',
    rows: () => sold().filter(v => v.awarding && !v.buyer_paid), sort: ['buyer_deadline', 'asc'],
    cols: [C('Auction Number', 'auction', 'code'), C('Lot', 'lot', 'code'), C('Customer Name', 'customer', 'text', { w: 230 }), C('Buyer ID', 'cid', 'code'), C('Seller', 'seller', 'code'),
      C('Make/Model', 'model', 'text', { w: 200 }), C('Plate Number', 'plate', 'code'), C('Total (Awarded Price + Transfer Fees)', 'total', 'money'),
      C('Buyer Paid', 'buyer_paid', 'date', { edit: 'date' }), C('Buyer Deadline', 'buyer_deadline', 'date', { late: true })],
    filters: [AUCTION_FILTER, { key: 'seller', label: 'Seller', type: 'select', options: sellerOpts }, { key: 'customer', keys: ['customer', 'cid'], label: 'Customer Name / Buyer ID', w: 'w2' }, { key: 'plate', label: 'Plate Number' }],
    totals: rows => ({ total: money(sumBy(rows, 'total')) }),
    validate: (r, e) => ({ buyer_paid: notFuture(e.buyer_paid) || notBefore(e.buyer_paid, r.awarding, 'the Awarding Date') }),
    buttons: [{ label: 'Save changes', kind: 'pr', icon: 'save', act: 'save' }], savedNote: 'Paid vehicles moved to Payment Seller.' },
  { dept: 'FAD', slug: 'payment-seller', title: 'Payment Seller', actions: VFSU, rule: 'Vehicles with status SOLD, a Buyer Paid date, and a blank Payment to Seller date. Deadline = 3 working days after Buyer Paid. To JBAP = commission + VAT − 15% withholding tax (NET sellers); Payable to Seller = total − To JBAP.',
    rows: () => sold().filter(v => v.buyer_paid && !v.pay_seller), sort: ['pay_deadline', 'asc'],
    cols: [C('Seller', 'seller', 'code'), C('Customer Name', 'customer', 'text', { w: 230 }), C('Auction Date', 'adate', 'code'), C('Plate Number', 'plate', 'code'),
      C('Total (Awarded Price + Transfer Fees)', 'total', 'money'), C('To JBAP', 'to_jbap', 'money'), C('Payable to Seller', 'payable', 'money'), C('Payment to Seller Date', 'pay_seller', 'date', { edit: 'date' }),
      C('Payment to Seller Deadline', 'pay_deadline', 'date', { late: true }), C('Print Payment to Seller', 'print_seller', 'check', { edit: 'check' })],
    filters: [{ key: 'seller', label: 'Seller', type: 'select', options: sellerOpts }, { key: 'auction_start', label: 'Auction Date', type: 'daterange', w: 'w2' }, { key: 'customer', label: 'Customer Name' }, { key: 'plate', label: 'Plate Number' }],
    totals: rows => ({ total: money(sumBy(rows, 'total')), to_jbap: money(sumBy(rows, 'to_jbap')), payable: money(sumBy(rows, 'payable')) }),
    validate: (r, e) => ({ pay_seller: notFuture(e.pay_seller) || notBefore(e.pay_seller, r.buyer_paid, 'Buyer Paid') }),
    buttons: [{ label: 'Print payment to seller', kind: 'ol', icon: 'print', act: 'printSeller', count: 'print_seller' }, { label: 'Save changes', kind: 'pr', icon: 'save', act: 'save' }],
    savedNote: 'Paid sellers moved to Seller Acknowledgement and Commission Billing.' },
  { dept: 'FAD', slug: 'seller-acknowledgement', title: 'Seller Acknowledgement', actions: VFSU,
    rule: 'Vehicles with status SOLD, Buyer Paid and Payment to Seller filled in, and a blank Seller Acknowledgement date.',
    rows: () => sold().filter(v => v.pay_seller && !v.seller_ack), sort: ['pay_deadline', 'asc'],
    cols: [C('Seller', 'seller_full', 'text', { w: 300 }), C('Customer Name', 'customer', 'text', { w: 260 }), C('Buyer ID', 'cid', 'code'), C('Plate Number', 'plate', 'code'),
      C('Seller Acknowledgement Date', 'seller_ack', 'date', { edit: 'date' }), C('Payment to Seller Deadline', 'pay_deadline', 'date')],
    filters: [{ key: 'seller', label: 'Seller', type: 'select', options: sellerOpts }, { key: 'customer', label: 'Customer Name' }, { key: 'plate', label: 'Plate Number' }],
    validate: (r, e) => ({ seller_ack: notFuture(e.seller_ack) || notBefore(e.seller_ack, r.pay_seller, 'Payment to Seller') }),
    buttons: [{ label: 'Save changes', kind: 'pr', icon: 'save', act: 'save' }], savedNote: 'Acknowledged vehicles removed from the list.' },
  { dept: 'FAD', slug: 'for-dispatch', title: 'For Dispatch', actions: VFSU,
    rule: 'Vehicles with status SOLD and a blank Dispatch Date whose seller condition is met: Buyer Payment and DOAS sellers after Buyer Paid, other sellers after Seller Acknowledgement (Dispatch Condition per seller). DOAS sellers need the signed DOAS before release. Buyer must release within 3 working days after dispatch.',
    rows: () => sold().filter(v => !v.dispatch && dispatchReady(v)), sort: ['adate', 'asc'],
    cols: [C('Seller Full Name', 'seller_full', 'text', { w: 250 }), C('Customer Name', 'customer', 'text', { w: 230 }), C('Auction Date', 'adate', 'code'),
      C('Make/Model', 'model', 'text', { w: 190 }), C('Plate Number', 'plate', 'code'), C('Buyer Paid', 'buyer_paid', 'date'), C('Release Condition', 'release_cond', 'text', { w: 220 }),
      C('For Dispatch Email?', 'for_dispatch_email', 'check', { edit: 'check' }), C('Dispatch Date', 'dispatch', 'date', { edit: 'date' })],
    filters: [{ key: 'seller', label: 'Seller', type: 'select', options: sellerOpts }, AUCTION_FILTER, { key: 'customer', label: 'Customer Name' }, { key: 'plate', label: 'Plate Number' }],
    validate: (r, e) => ({ dispatch: notFuture(e.dispatch) || (releaseOf(r) === 'ack' ? notBefore(e.dispatch, r.seller_ack, 'Seller Acknowledgement') : notBefore(e.dispatch, r.buyer_paid, 'Buyer Paid')) }),
    buttons: [{ label: 'Email dispatch form', kind: 'ol', icon: 'mail', act: 'emailDispatch', count: 'for_dispatch_email' }, { label: 'Save changes', kind: 'pr', icon: 'save', act: 'save' }], savedNote: 'Dispatched vehicles moved to Unreleased Unit (FAD and VWD).' },
  { dept: 'FAD', slug: 'document-monitoring', title: 'Document Monitoring', actions: VFSU,
    rule: 'Sold lots with a Buyer Paid date whose documents are not yet released to the buyer. Sellers released on Buyer Payment (TFS) skip the DOAS steps. DOAS dates go in order: received for signing, signed by the buyer, receipt by the seller.',
    rows: () => sold().filter(v => v.buyer_paid && releaseOf(v) !== 'payment' && !v.to_buyer), sort: ['buyer_paid', 'asc'],
    cols: [C('Auction No.', 'auction', 'code'), C('Lot', 'lot', 'code'), C('Customer Name', 'customer', 'text', { w: 210 }), C('Seller', 'seller', 'code'), C('Plate Number', 'plate', 'code'),
      C('Buyer Paid', 'buyer_paid', 'date'), C('Received DOAS for Signing', 'rcv_doas', 'date', { edit: 'date' }), C('Buyer Signed DOAS', 'buyer_doas', 'date', { edit: 'date' }),
      C('Seller Receipt of Signed DOAS', 'seller_doas', 'date', { edit: 'date' }), C('Original Docs Received from Seller', 'orig_docs', 'date', { edit: 'date' }),
      C('Documents Released to Buyer', 'to_buyer', 'date', { edit: 'date' })],
    filters: [AUCTION_FILTER, { key: 'seller', label: 'Seller', type: 'select', options: sellerOpts }, { key: 'customer', label: 'Customer Name' }, { key: 'plate', label: 'Plate Number' }],
    validate: docValidate,
    buttons: [{ label: 'Save changes', kind: 'pr', icon: 'save', act: 'save' }], savedNote: 'Lots with Documents Released to Buyer were removed from the list.' },
  { dept: 'FAD', slug: 'unreleased-unit', title: 'Unreleased Unit', actions: VFS,
    rule: `Dispatched vehicles not yet released to the buyer. Penalty shows once the dispatch deadline has passed (prototype rule: PHP ${PENALTY_PER_DAY}/day, to confirm).`,
    rows: () => sold().filter(v => v.dispatch && !v.release), sort: ['dispatch_deadline', 'asc'], cols: UNREL_COLS, filters: UNREL_FILTERS,
    totals: rows => ({ penalty: money(sumBy(rows, 'penalty')) }) },
  { dept: 'FAD', slug: 'liability-to-seller', title: 'Liability to Seller', actions: VS, layout: 'query',
    rule: 'Units the buyer has paid for where Payment to Seller is still blank, or happened after the date entered.',
    rows: () => { const d = U('FAD/liability-to-seller').asOf || TODAY; return sold().filter(v => v.buyer_paid && v.buyer_paid <= d && (!v.pay_seller || v.pay_seller > d)); },
    sort: ['seller_full', 'asc'],
    cols: [C('Seller', 'seller_full', 'text', { w: 290 }), C('Auction No.', 'auction', 'code'), C('Lot', 'lot', 'code'), C('Customer Name', 'customer', 'text', { w: 250 }),
      C('Plate Number', 'plate', 'code'), C('Buyer Paid', 'buyer_paid', 'date'), C('Payment to Seller Deadline', 'pay_deadline', 'date'), C('Total (Result Price + Transfer Fees)', 'total', 'money')],
    totals: rows => ({ seller_full: 'Total liability to sellers', total: money(sumBy(rows, 'total')) }) },
  { dept: 'FAD', slug: 'rebate-monitoring', title: 'Rebate Monitoring', actions: VS, rule: 'Result price records with status SOLD and a rebate.',
    rows: () => sold().filter(v => v.rebate), cols: REBMON_COLS, sort: ['adate', 'desc'] },
  { dept: 'FAD', slug: 'rebate-payable', title: 'Rebate Payable', actions: VSU, rule: 'Result price records with status SOLD, a rebate, a Buyer Paid date, and a blank Rebate Paid date.',
    rows: () => sold().filter(v => v.rebate && v.buyer_paid && !v.rebate_paid), sort: ['adate', 'asc'],
    cols: [C('Auction Date', 'adate', 'code'), C('Lot', 'lot', 'code'), C('Customer Name', 'customer', 'text', { w: 360 }), C('Rebate', 'rebate', 'money'),
      C('Buyer Paid', 'buyer_paid', 'date'), C('Rebate Paid', 'rebate_paid', 'date', { edit: 'date' })],
    totals: rows => ({ rebate: money(sumBy(rows, 'rebate')) }),
    validate: (r, e) => ({ rebate_paid: notFuture(e.rebate_paid) || notBefore(e.rebate_paid, r.buyer_paid, 'Buyer Paid') }),
    buttons: [{ label: 'Save changes', kind: 'pr', icon: 'save', act: 'save' }], savedNote: 'Paid rebates removed from the list.' },
  { dept: 'FAD', slug: 'billing-monitoring', title: 'Billing Monitoring', actions: VSU, rule: 'All records from the billing table. New commission billings appear here after printing. Tick Print Transmittal? and print the billing transmittal to record the Transmittal Date.',
    rows: B, sort: ['bdate', 'desc'],
    cols: [C('Billing #', 'no', 'code'), C('Customer', 'customer', 'text', { w: 320 }), C('Auction Date / Particulars', 'particular', 'text', { w: 230 }), C('Billing Date', 'bdate', 'date'), C('Total', 'total', 'money'),
      C('Transmittal Date', 'trans', 'date'), C('Print Transmittal?', 'print_trans', 'check', { edit: 'check' })],
    buttons: [{ label: 'Print billing transmittal', kind: 'ol', icon: 'print', act: 'printTransmittal', count: 'print_trans' }, { label: 'Save changes', kind: 'pr', icon: 'save', act: 'save' }] },
  { dept: 'FAD', slug: 'unpaid-billing', title: 'Unpaid Billing', actions: VSU, rule: `Billing records with a blank Payment Date. Due date = billing date + ${BILL_DUE_DAYS} days.`,
    rows: () => B().filter(b => !b.pay), sort: ['bdate', 'asc'],
    cols: [C('Customer', 'customer', 'text', { w: 240 }), C('Auction Date / Particulars', 'particular', 'text', { w: 180 }), C('Billing Date', 'bdate', 'date'), C('Bill Amount', 'bill', 'money'),
      C('VAT', 'vat', 'money'), C('Total', 'total', 'money'), C('Transmittal Date', 'trans', 'date'), C('Due Date', 'due', 'date', { late: true }),
      C('Payment Date', 'pay', 'date', { edit: 'date' }), C('Collection Receipt', 'cr', 'text', { edit: 'text' })],
    validate: (r, e) => { const p = 'pay' in e ? e.pay : r.pay, cr = 'cr' in e ? e.cr : r.cr;
      return { pay: notFuture(p) || notBefore(p, r.bdate, 'the Billing Date') || (!p && cr ? 'is required with a Collection Receipt' : null), cr: p && !cr ? 'is required with a Payment Date' : null }; },
    buttons: [{ label: 'Save changes', kind: 'pr', icon: 'save', act: 'save' }], savedNote: 'Paid billings removed from the list.' },
  { dept: 'FAD', slug: 'commission-billing', title: 'Commission Billing', actions: VSU,
    rule: 'Result price records with a Remittance Date and no commission billing yet. Tick Print?, then Print commission billing to record the NOAH billing number and date.',
    rows: () => sold().filter(v => v.pay_seller && !v.billed), sort: ['customer', 'asc'],
    cols: [C('Customer Name', 'customer', 'text', { w: 300 }), C('Plate Number', 'plate', 'code'), C('Print?', 'print_comm', 'check', { edit: 'check' }), C('Remittance Date', 'pay_seller', 'date'),
      C('Winning Bid', 'price', 'money'), C('Commission', 'com', 'money'), C('VAT', 'cvat', 'money'), C('Total', 'ctotal', 'money')],
    totals: rows => ({ plate: `${rows.length} units`, price: money(sumBy(rows, 'price')), com: money(sumBy(rows, 'com')), cvat: money(sumBy(rows, 'cvat')), ctotal: money(sumBy(rows, 'ctotal')) }),
    buttons: [{ label: 'Print commission billing', kind: 'ol', icon: 'print', act: 'printComm', count: 'print_comm' }, { label: 'Save changes', kind: 'pr', icon: 'save', act: 'save' }] },
  { dept: 'FAD', slug: 'cancellation-monitoring', title: 'Cancellation Monitoring', actions: VS, rule: 'Information on cancelled vehicles.',
    rows: CX, cols: CXMON_COLS, sort: ['dcancel', 'desc'] },
  { dept: 'FAD', slug: 'cancellation-entry', title: 'Cancellation Entry', actions: VSU, layout: 'entry',
    rule: 'Enter the Auction No. and Lot to find the transaction, then record the cancellation.',
    rows: CX, sort: ['dcancel', 'desc'],
    cols: [C('Lot', 'lot', 'code'), C('Auction Date', 'adate', 'code'), C('Customer Name', 'customer', 'text', { w: 250 }), C('Status', 'status', 'status'),
      C('Date Cancelled', 'dcancel', 'date'), C('Cancellation Fee Waived', 'waived', 'rocheck'), C('Justification of Waiver', 'just', 'text', { w: 330 }), C('Plate Number', 'plate', 'code')] },
  { dept: 'FAD', slug: 'cancellation-billing', title: 'Cancellation Billing', actions: VSU,
    rule: 'Cancelled lots, fee not waived, with a blank Cancellation Billing Date. Penalty PHP 10,000 per lot: PHP 5,000 to the seller and PHP 5,000 to JBAP (EWB: all to JBAP). Printing records the billing date and the amount due.',
    rows: () => CX().filter(c => !c.bill_date && !c.waived), sort: ['auction', 'desc'],
    cols: [C('Auction No.', 'auction', 'code'), C('Plate', 'plate', 'code'), C('Customer Name', 'customer', 'text', { w: 300 }), C('Date Cancelled', 'dcancel', 'date'),
      C('Penalty', 'penalty', 'money'), C('To Seller', 'pen_seller', 'money'), C('To JBAP', 'pen_jbap', 'money'), C('Billing Date', 'bill_date', 'date'), C('For Print?', 'for_print', 'check', { edit: 'check' })],
    totals: rows => ({ penalty: money(sumBy(rows, 'penalty')), pen_seller: money(sumBy(rows, 'pen_seller')), pen_jbap: money(sumBy(rows, 'pen_jbap')) }),
    buttons: [{ label: 'Print cancellation billing', kind: 'ol', icon: 'print', act: 'printCancel', count: 'for_print' }, { label: 'Save changes', kind: 'pr', icon: 'save', act: 'save' }] },
  { dept: 'FAD', slug: 'cancellation-payment', title: 'Cancellation Payment', actions: VSU,
    rule: 'Result price records with a Cancellation Billing Date and a blank Cancellation Payment.',
    rows: () => CX().filter(c => c.bill_date && !c.paid_date), sort: ['bill_date', 'asc'],
    cols: [C('Auction No.', 'auction', 'code'), C('Plate No.', 'plate', 'code'), C('Customer Name', 'customer', 'text', { w: 360 }), C('Date Cancelled', 'dcancel', 'date'),
      C('Billing Date', 'bill_date', 'date'), C('Penalty', 'penalty', 'money'), C('To Seller', 'pen_seller', 'money'), C('To JBAP', 'pen_jbap', 'money'),
      C('Date Paid', 'paid_date', 'date', { edit: 'date' }), C('Amount', 'amount', 'money', { edit: 'money' })],
    validate: (r, e) => { const d = 'paid_date' in e ? e.paid_date : r.paid_date, a = 'amount' in e ? e.amount : r.amount;
      return { paid_date: notFuture(d) || notBefore(d, r.bill_date, 'the Billing Date') || (!d && a ? 'is required with an Amount' : null), amount: d && !(Number(a) > 0) ? 'must be more than 0' : null }; },
    buttons: [{ label: 'Save changes', kind: 'pr', icon: 'save', act: 'save' }], savedNote: 'Paid cancellations removed from the list.' },

  // ===================== SMD (read-only, legacy SMD sample data) =====================
  { dept: 'SMD', slug: 'result-summary', title: 'Result Summary', actions: VFS, rule: 'One row per auction. Average price per unit = Total awarded price ÷ Sold units.',
    rows: () => SMD('result'), cols: RESULT_COLS, sort: ['auction', 'desc'], totals: resultTotals,
    filters: [{ key: 'month', label: 'Month', type: 'select', options: () => [...new Set(D.smd.result.map(r => r.month))] }, AUCTION_FILTER] },
  { dept: 'SMD', slug: 'auction-monitoring', title: 'Auction Monitoring', actions: VFS, compact: true,
    rule: 'Auction result per auction and lot, with every milestone date from awarding to release to the buyer.',
    rows: () => SMD('auction'), cols: AM_COLS.map(c => c.key === 'customer' ? C('Customer Name', 'customer', 'text', { w: 190 }) : c), sort: ['auction', 'desc'],
    filters: AM_FILTERS, initial: { plate: 'NFW4473' },
    totals: rows => ({ customer: `${rows.length} lots`, price: money(sumBy(rows, 'price')) }) },
  { dept: 'SMD', slug: 'pending-awarding', title: 'Pending Awarding', actions: VFS, rule: 'Vehicles with status SOLD and a blank Awarding Date.',
    rows: () => SMD('pending'), sort: ['customer', 'asc'],
    cols: [C('Auction Number', 'auction', 'code'), C('Lot', 'lot', 'code'), C('Customer Name', 'customer', 'text', { w: 200 }), C('For BAAF', 'for_baaf', 'rocheck'),
      C('Awarding Date', 'awarding', 'date'), C('Rebate', 'rebate', 'money'), C('Seller', 'seller_full', 'text', { w: 220 }), C('Plate Number', 'plate', 'code'),
      C('Make/Model', 'model', 'text', { w: 230 }), C('Result Price', 'price', 'money'), C('Transfer Fees', 'tfee', 'money')],
    filters: [AUCTION_FILTER, { key: 'seller_full', label: 'Seller', type: 'select', options: () => [...new Set(D.smd.pending.map(r => r.seller_full))] }, { key: 'customer', label: 'Customer Name' }, { key: 'plate', label: 'Plate Number' }] },
  { dept: 'SMD', slug: 'unpaid', title: 'Unpaid', actions: VFS, rule: 'Vehicles with status SOLD, an Awarding Date, and a blank Buyer Paid date. Total = Awarded price + Transfer fees.',
    rows: () => SMD('unpaid'), sort: ['buyer_deadline', 'asc'],
    cols: [C('Auction Number', 'auction', 'code'), C('Lot', 'lot', 'code'), C('Customer Name', 'customer', 'text', { w: 220 }), C('Buyer ID', 'cid', 'code'), C('Seller', 'seller', 'code'),
      C('Make/Model', 'model', 'text', { w: 210 }), C('Plate Number', 'plate', 'code'), C('Total (Awarded Price + Transfer Fees)', 'total', 'money'), C('Buyer Paid', 'buyer_paid', 'date'),
      C('Buyer Deadline', 'buyer_deadline', 'date', { late: true })],
    filters: [AUCTION_FILTER, { key: 'seller', label: 'Seller', type: 'select', options: () => [...new Set(D.smd.unpaid.map(r => r.seller))] }, { key: 'customer', keys: ['customer', 'cid'], label: 'Customer Name / Buyer ID', w: 'w2' }, { key: 'plate', label: 'Plate Number' }],
    totals: rows => ({ customer: `${rows.length} units`, total: money(sumBy(rows, 'total')) }) },
  { dept: 'SMD', slug: 'seller-acknowledgement', title: 'Seller Acknowledgement', actions: VFS,
    rule: 'Vehicles with status SOLD, Buyer Paid and Payment to Seller filled in, and a blank Seller Acknowledgement date.',
    rows: () => SMD('ack'), sort: ['seller_full', 'asc'],
    cols: [C('Seller', 'seller_full', 'text', { w: 300 }), C('Customer Name', 'customer', 'text', { w: 260 }), C('Buyer ID', 'cid', 'code'), C('Plate Number', 'plate', 'code'),
      C('Seller Acknowledgement Date', 'seller_ack', 'date'), C('Payment to Seller Deadline', 'pay_deadline', 'date')],
    filters: [{ key: 'customer', label: 'Customer Name' }, { key: 'plate', label: 'Plate Number' }] },
  { dept: 'SMD', slug: 'for-dispatch', title: 'For Dispatch', actions: VFS,
    rule: 'Vehicles with status SOLD, Buyer Paid, Payment to Seller and Seller Acknowledgement filled in, and a blank Dispatch Date.',
    rows: () => SMD('dispatch'), sort: ['customer', 'asc'],
    cols: [C('Seller Full Name', 'seller_full', 'text', { w: 290 }), C('Customer Name', 'customer', 'text', { w: 250 }), C('Auction Date', 'adate', 'code'),
      C('Make/Model', 'model', 'text', { w: 210 }), C('Plate Number', 'plate', 'code'), C('Buyer Paid', 'buyer_paid', 'date'), C('Dispatch Date', 'dispatch', 'date')],
    filters: [{ key: 'customer', label: 'Customer Name' }, { key: 'plate', label: 'Plate Number' }], totals: rows => ({ customer: `${rows.length} units` }) },
  { dept: 'SMD', slug: 'unreleased-unit', title: 'Unreleased Unit', actions: VFS,
    rule: 'Dispatched vehicles that have not been released to the buyer yet. Penalty shows once the dispatch deadline has passed.',
    rows: () => SMD('unreleased'), sort: ['customer', 'asc'], cols: UNREL_COLS,
    filters: [{ key: 'customer', label: 'Customer Name' }, { key: 'plate', label: 'Plate Number' }, { key: 'dispatch_deadline', label: 'Dispatch Deadline', type: 'daterange', w: 'w2' }],
    totals: rows => ({ adate: `${rows.length} units`, penalty: money(sumBy(rows, 'penalty')) }) },
  { dept: 'SMD', slug: 'rebate-monitoring', title: 'Rebate Monitoring', actions: VS, rule: 'Result price records with status SOLD and a rebate.',
    rows: () => SMD('rebates'), cols: REBMON_COLS, sort: ['buyer_paid', 'desc'] },
  { dept: 'SMD', slug: 'cancellation-monitoring', title: 'Cancellation Monitoring', actions: VS, rule: 'Information on cancelled vehicles.',
    rows: () => SMD('cancellations'), cols: CXMON_COLS, sort: ['dcancel', 'desc'] },

  // ===================== VWD (live data shared with FAD; the Unreleased screens release vehicles) =====================
  { dept: 'VWD', slug: 'unreleased-unit', title: 'Unreleased Unit', actions: VFSU, rule: 'Dispatched vehicles with no penalty yet (still within the dispatch deadline). VWD releases a vehicle with Release vehicle (JBAP Q9).',
    rows: () => sold().filter(v => v.dispatch && !v.release && v.dispatch_deadline >= TODAY), sort: ['dispatch_deadline', 'asc'],
    cols: [C('Customer Name', 'customer', 'text', { w: 330 }), C('Auction No.', 'auction', 'code'), C('Make/Model', 'model', 'text', { w: 280 }), C('Plate Number', 'plate', 'code'),
      C('Location', 'location', 'code'), C('Dispatch Deadline', 'dispatch_deadline', 'date'), C('Release', 'id', 'rowbtn', { act: 'releaseVehicle', btn: 'Release vehicle' })], filters: UNREL_FILTERS },
  { dept: 'VWD', slug: 'for-dispatch', title: 'For Dispatch', actions: VFS, rule: 'Vehicles with status SOLD and a blank Dispatch Date (all stages before dispatch).',
    rows: () => sold().filter(v => !v.dispatch), sort: ['awarding', 'asc'],
    cols: [C('Vehicle Control Number', 'vcn', 'code'), C('Plate Number', 'plate', 'code'), C('Auction No.', 'auction', 'code'), C('Buyer', 'customer', 'text', { w: 250 }),
      C('Seller', 'seller_full', 'text', { w: 250 }), C('Awarding Date', 'awarding', 'date'), C('Payment Date', 'buyer_paid', 'date'), C('Payment to Seller Date', 'pay_seller', 'date'),
      C('Seller Acknowledgement', 'seller_ack', 'date')],
    filters: [AUCTION_FILTER, { key: 'seller', label: 'Seller', type: 'select', options: sellerOpts }, { key: 'customer', label: 'Buyer' }, { key: 'plate', label: 'Plate Number' }] },
  { dept: 'VWD', slug: 'unreleased-unit-overdue', title: 'Unreleased Unit (Overdue)', actions: VFSU,
    rule: `Dispatched vehicles past the dispatch deadline. Penalty is calculated by the system (prototype rule: PHP ${PENALTY_PER_DAY}/day, to confirm). VWD releases a vehicle with Release vehicle (JBAP Q9).`,
    rows: () => sold().filter(v => v.dispatch && !v.release && v.dispatch_deadline < TODAY), sort: ['dispatch_deadline', 'asc'], cols: [...UNREL_COLS, C('Release', 'id', 'rowbtn', { act: 'releaseVehicle', btn: 'Release vehicle' })], filters: UNREL_FILTERS,
    totals: rows => ({ penalty: money(sumBy(rows, 'penalty')) }) },
  { dept: 'VWD', slug: 'auction-monitoring', title: 'Auction Monitoring', actions: VFS, rule: 'Auction result per auction and lot, from awarding to vehicle release.',
    rows: V, sort: ['auction', 'desc'], filters: AM_FILTERS,
    cols: [C('Auction Number', 'auction', 'code'), C('Lot', 'lot', 'code'), C('Plate Number', 'plate', 'code'), C('Customer Name', 'customer', 'text', { w: 230 }), C('Seller', 'seller', 'code'),
      C('Status', 'status', 'status'), C('Awarding Date', 'awarding', 'date'), C('Buyer Paid', 'buyer_paid', 'date'), C('Payment to Seller', 'pay_seller', 'date'),
      C('Seller Acknowledgement', 'seller_ack', 'date'), C('Dispatch Date', 'dispatch', 'date'), C('Vehicle Release Date', 'release', 'date')],
    totals: rows => ({ customer: `${rows.length} lots, ${rows.filter(r => r.status === 'Sold').length} sold` }) },

  // ===================== Log Activity (top-level menu, read-only) =====================
  { id: LOG_ID, dept: 'LOG', top: true, title: 'Log Activity', actions: VFS,
    rule: 'Every data change made in FAD, SMD and VWD, one row per changed field. Entries cannot be edited or deleted. SMD is view-only under the CR, so it has no entries; VWD entries come from vehicle releases.',
    rows: () => S.log, sort: ['at', 'desc'],
    cols: [C('Date/Time', 'at', 'datetime'), C('User', 'user', 'code'), C('Module', 'module', 'code'), C('Screen', 'screen', 'text', { w: 170 }), C('Action', 'action', 'action'),
      C('Record', 'record', 'text', { w: 230 }), C('Field', 'field', 'text', { w: 190 }), C('Old Value', 'old', 'logval', { w: 160 }), C('New Value', 'new', 'logval', { w: 160 })],
    filters: [{ key: 'date', label: 'Date', type: 'daterange', w: 'w2' }, { key: 'user', label: 'User', type: 'select', w: 'w1', options: () => [...new Set(S.log.map(l => l.user))].sort() },
      { key: 'module', label: 'Module', type: 'select', w: 'w1', options: () => ['FAD', 'SMD', 'VWD'] }, { key: 'action', label: 'Action', type: 'select', w: 'w1', options: () => ['Update', 'Create', 'Cancel'] },
      { key: 'record', label: 'Record / Plate' }],
    emptyNote: () => { const m = U(LOG_ID).applied.module; return m === 'SMD' ? 'No activity: SMD is view-only under the CR, so it has no update actions to log.' : m === 'VWD' ? 'No activity yet: VWD logs an entry each time it releases a vehicle.' : null; } },
];
SCREENS.forEach(s => { s.id ||= `${s.dept}/${s.slug}`; });
const byId = Object.fromEntries(SCREENS.map(s => [s.id, s]));

function U(id) {
  if (!UI[id]) { const s = byId[id]; UI[id] = { filters: Object.assign({}, s?.initial), applied: Object.assign({}, s?.initial), sort: s?.sort ? [...s.sort] : null, page: 1, size: 15, edits: {}, errors: {}, msg: null }; }
  return UI[id];
}

// ─── Filtering, sorting, paging ───────────────────────────────────────
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
    if (v === undefined || v === '') return true;
    if (fd.type === 'select') return String(r[fd.key]) === String(v);
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
function renderSide(route) {
  const dept = route.split('/')[0];
  const groups = ['FAD', 'SMD', 'VWD'].map(d => {
    const open = OPEN[d];
    const items = SCREENS.filter(s => s.dept === d).map(s => `<a class="mis ${s.id === route ? 'is-active' : ''}" href="#/${s.id}" ${s.id === route ? 'aria-current="page"' : ''}>${esc(s.title)}</a>`).join('');
    return `<button type="button" class="mi" data-group="${d}" aria-expanded="${open}" aria-controls="grp-${d}">${deptSvg(d)}${d}<span class="caret"></span></button>
      <div class="lvs" id="grp-${d}" ${open ? '' : 'hidden'}>${items}</div>`;
  }).join('');
  const logOn = route === LOG_ID;
  const log = `<a class="mi ${logOn ? 'is-active' : ''}" href="#/${LOG_ID}" ${logOn ? 'aria-current="page"' : ''}>${deptSvg('LOG')}Log Activity</a>`;
  $('#menu').innerHTML = TOP_BEFORE.map(disabledItem).join('') + groups + TOP_AFTER.map(disabledItem).join('') + log +
    '<p class="side-note">Prototype: only FAD, SMD, VWD and Log Activity are active. Other menus are disabled.</p>';
}

function pageHead(scr) {
  const pills = scr.actions.map(a => `<span class="pill ${a === 'Update' ? 'u' : ''}">${a}</span>`).join('');
  return `<nav class="crumb" aria-label="Breadcrumb"><a href="#/">Home</a>›${scr.top ? '' : `<span>${scr.dept}</span>›`}<b>${esc(scr.title)}</b></nav>
    <div class="hrow"><h1>${esc(scr.title)}</h1><div class="acts">Allowed actions&nbsp;${pills}</div></div>
    <p class="rule">${IC.info}<span>${esc(scr.rule)}</span></p>`;
}

function filterCard(scr) {
  const f = U(scr.id).filters;
  const fields = scr.filters.map(fd => {
    const id = `f-${fd.key}`;
    if (fd.type === 'select') {
      const opts = fd.options().map(o => `<option ${String(f[fd.key]) === String(o) ? 'selected' : ''}>${esc(o)}</option>`).join('');
      return `<div class="fld ${fd.w || ''}"><label for="${id}">${esc(fd.label)}</label><select class="ctl" id="${id}" data-filter="${fd.key}"><option value="">All</option>${opts}</select></div>`;
    }
    if (fd.type === 'daterange') {
      return `<div class="fld ${fd.w || 'w2'}"><span class="lbl" id="${id}-l">${esc(fd.label)}</span><div class="range" role="group" aria-labelledby="${id}-l">
        <input class="ctl" type="date" aria-label="${esc(fd.label)} from" data-filter="${fd.key}__from" value="${esc(f[fd.key + '__from'] || '')}">
        <span aria-hidden="true">–</span><input class="ctl" type="date" aria-label="${esc(fd.label)} to" data-filter="${fd.key}__to" value="${esc(f[fd.key + '__to'] || '')}"></div></div>`;
    }
    return `<div class="fld ${fd.w || ''}"><label for="${id}">${esc(fd.label)}</label><input class="ctl" id="${id}" data-filter="${fd.key}" placeholder="Type to search" value="${esc(f[fd.key] || '')}"></div>`;
  }).join('');
  return `<section class="card filter" aria-label="Filter"><div class="card-h"><div class="ico">${IC.filter}</div>Filter</div>
    <form class="fb" data-form="filter">${fields}<div class="btns"><button type="button" class="btn gh" data-act="resetFilter">${IC.reset}Reset</button>
    <button type="submit" class="btn pr">${IC.search}Apply filter</button></div></form></section>`;
}

function cellHtml(scr, r, c, upd) {
  const ui = U(scr.id), ed = ui.edits[r.id] || {}, err = (ui.errors[r.id] || {})[c.key];
  const cls = [RIGHT.has(c.type) ? 'r' : '', CEN.has(c.type) ? 'c' : ''].join(' ');
  if (c.edit && upd) {
    const has = c.key in ed, val = has ? ed[c.key] : r[c.key];
    const aria = `${c.label}, lot ${r.lot || ''} ${r.plate || ''}`.trim();
    const common = `data-row="${esc(r.id)}" data-key="${c.key}" aria-label="${esc(aria)}" ${err ? `aria-invalid="true" title="${esc(c.label + ' ' + err)}"` : ''}`;
    const st = `${has ? 'is-dirty' : ''} ${err ? 'is-invalid' : ''}`;
    if (c.edit === 'check') return `<td class="c"><input type="checkbox" class="chk ${st}" ${val ? 'checked' : ''} ${common}></td>`;
    if (c.edit === 'date') return `<td><input type="date" class="cell-in ${st}" value="${esc(val || '')}" ${common}></td>`;
    if (c.edit === 'money') return `<td><input type="number" min="0" step="0.01" class="cell-in num ${st}" value="${val ?? ''}" ${common}></td>`;
    return `<td><input type="text" class="cell-in ${st}" value="${esc(val || '')}" ${common}></td>`;
  }
  const v = r[c.key];
  if (c.type === 'rocheck' || c.type === 'check') return `<td class="c"><span class="ro-chk ${v ? 'on' : ''}" role="img" aria-label="${v ? 'Yes' : 'No'}">${v ? IC.check : ''}</span></td>`;
  if (c.type === 'status') { const k = { Sold: 'sold', 'Not Sold': 'ns', Cancelled: 'cx' }[v] || 'ns'; return `<td class="c"><span class="st ${k}">${esc(v)}</span></td>`; }
  if (c.type === 'action') { const k = { Update: 'up', Create: 'sold', Cancel: 'cx' }[v] || 'ns'; return `<td class="c"><span class="st ${k}">${esc(v)}</span></td>`; }
  if (c.type === 'rowbtn') return `<td class="c"><button type="button" class="btn ol" data-act="${c.act}" data-rid="${esc(r.id)}">${esc(c.btn)}</button></td>`;
  if (c.type === 'logval' && (v ?? '') === '') return '<td><span class="blank">(blank)</span></td>';
  let t = c.type === 'money' ? money(v) : c.type === 'int' ? intf(v) : c.type === 'date' ? fmtDate(v) : c.type === 'datetime' ? `${fmtDate(v.slice(0, 10))} ${v.slice(11)}` : (v ?? '');
  const late = c.late && v && v < TODAY ? ' late' : '';
  if (c.w) return `<td class="${cls}${late}"><div class="tx" style="max-width:${c.w}px" title="${esc(t)}">${esc(t)}</div></td>`;
  return `<td class="${cls}${late}">${esc(t)}</td>`;
}

function dataCard(scr, title) {
  const ui = U(scr.id), upd = scr.actions.includes('Update') && scr.layout !== 'entry';
  const all = sortRows(scr, applyFilters(scr, scr.rows()));
  const pages = Math.max(1, Math.ceil(all.length / ui.size)); ui.page = Math.min(ui.page, pages);
  const rows = all.slice((ui.page - 1) * ui.size, ui.page * ui.size);
  const dirty = Object.keys(ui.edits).length;
  const btns = (upd ? scr.buttons || [] : []).map(b => {
    const n = b.act === 'save' ? dirty : effectiveCount(scr, b.count);
    return `<button type="button" class="btn ${b.kind}" data-act="${b.act}">${IC[b.icon]}${esc(b.label)}${n ? `<span class="n" data-count="${b.act}">${n}</span>` : `<span class="n" data-count="${b.act}" hidden></span>`}</button>`;
  }).join('');
  const legend = upd ? '<div class="lg"><span><i class="sw l"></i>Locked</span><span><i class="sw e"></i>Editable</span><span><i class="sw d"></i>Unsaved change</span></div>' : '';
  const th = scr.cols.map(c => {
    const ed = c.edit && upd, srt = ui.sort && ui.sort[0] === c.key ? (ui.sort[1] === 'asc' ? 'ascending' : 'descending') : 'none';
    return `<th class="${ed ? 'ed' : ''}" aria-sort="${srt}" scope="col"><button type="button" class="hb" data-sort="${c.key}">${upd ? (ed ? IC.pen : `<span class="lk">${IC.lock}</span>`) : ''}<span>${esc(c.label)}</span><span class="si" aria-hidden="true"></span></button></th>`;
  }).join('');
  const body = rows.length ? rows.map(r => `<tr class="${ui.edits[r.id] ? 'is-dirty' : ''}" data-tr="${esc(r.id)}">${scr.cols.map(c => cellHtml(scr, r, c, upd)).join('')}</tr>`).join('')
    : `<tr><td colspan="${scr.cols.length}"><div class="empty">${IC.inbox}<b>No records to show</b>${esc(scr.emptyNote?.() || '') || (hasFilter(scr) ? 'No records match the filter. Try Reset.' : 'Nothing is waiting in this list right now.')}</div></td></tr>`;
  let foot = '';
  if (scr.totals && all.length) {
    const t = scr.totals(all);
    foot = `<tfoot><tr>${scr.cols.map((c, i) => `<td class="${RIGHT.has(c.type) ? 'r' : CEN.has(c.type) ? 'c' : ''}">${esc(t[c.key] ?? (i === 0 ? 'Total' : ''))}</td>`).join('')}</tr></tfoot>`;
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
const hasFilter = scr => Object.values(U(scr.id).applied).some(v => v);
function effectiveCount(scr, key) {   // ticks: saved value overridden by unsaved edit
  if (!key) return 0; const ui = U(scr.id);
  return scr.rows().filter(r => (key in (ui.edits[r.id] || {}) ? ui.edits[r.id][key] : r[key])).length;
}

// ─── Special layouts ──────────────────────────────────────────────────
function queryCard(scr) {
  const d = U(scr.id).asOf || TODAY;
  return `<section class="card filter"><div class="card-h"><div class="ico">${IC.search}</div>Query</div>
    <form class="fb" data-form="query"><div class="fld w2"><label for="q-asof">Payment to seller still blank before</label><input class="ctl" type="date" id="q-asof" value="${d}" required></div>
    <p style="font-size:12.5px;color:var(--faint);margin:0 0 9px;max-width:620px">Buyer payment date has no filter. A unit is listed when Payment to Seller is blank, or falls after the date entered.</p>
    <div class="btns"><button type="submit" class="btn pr">${IC.play}Generate</button></div></form></section>`;
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
      ${lk('Lot', v.lot)}${lk('Auction Date', v.adate)}${lk('Customer Name', v.customer)}${lk('Plate Number', v.plate)}
      <div class="fld"><label for="ce-status">Status</label><select class="ctl ${e.errors.status ? 'is-invalid' : ''}" id="ce-status" ${ro ? 'disabled' : ''}>${['Sold', 'Cancelled'].map(s => `<option ${f.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>${ferr('status')}</div>
      <div class="fld"><label for="ce-date">Date Cancelled</label><input type="date" class="ctl ${e.errors.date ? 'is-invalid' : ''}" id="ce-date" value="${esc(f.date)}" ${ro ? 'disabled' : ''}>${ferr('date')}</div>
      <div class="fld"><span class="lbl">Cancellation Fee Waived</span><label class="chkline"><input type="checkbox" class="chk" id="ce-waived" ${f.waived ? 'checked' : ''} ${ro ? 'disabled' : ''}>Waive the cancellation fee</label></div><div></div>
      <div class="fld full"><label for="ce-just">Justification of Waiver</label><textarea class="ctl ${e.errors.just ? 'is-invalid' : ''}" id="ce-just" ${ro ? 'disabled' : ''} placeholder="Reason, e.g. Did not pay within the buyer deadline">${esc(f.just)}</textarea>${ferr('just')}</div>
      </div>${ro ? `<p class="note">This lot is already <b>${esc(v.status)}</b>. Only SOLD transactions can be cancelled.</p>` : ''}
      <div class="fact"><button type="button" class="btn gh" data-act="entryClear">Discard</button><button type="submit" class="btn dg" ${ro ? 'disabled' : ''}>${IC.ban}Cancel transaction</button></div></form></section>`;
  }
  return `<div class="row2">${find}${det}</div>${dataCard(scr, 'Recent cancellation entries')}`;
}
function homeLayout() {
  const card = d => {
    const subs = SCREENS.filter(s => s.dept === d).map(s => `<li><a href="#/${s.id}">${esc(s.title)}<span class="cnt">${s.rows().length.toLocaleString()}</span></a></li>`).join('');
    const sub = { FAD: 'Post-auction processing: awarding, payments, billing, rebates, cancellations', SMD: 'View-only monitoring (legacy SMD sample data)', VWD: 'Units for dispatch and release; VWD records the vehicle release' }[d];
    return `<section class="hcard"><div class="card-h"><div class="ico">${deptSvg(d).replace('viewBox', 'width="20" height="20" viewBox')}</div><b>${d}</b></div><p class="sub" style="margin-top:8px">${sub}</p><ul>${subs}</ul></section>`;
  };
  return `<div class="home"><nav class="crumb" aria-label="Breadcrumb"><b>Home</b></nav><h1>Post-Auction Menus</h1>
    <p class="lead">Clickable prototype of the new FAD, SMD and VWD menus that replace the MS Access post-auction forms. Data is sample data and resets when you refresh the page. Demo date: <b>${fmtDate(TODAY)}</b>.</p>
    <div class="hgrid">${['FAD', 'SMD', 'VWD'].map(card).join('')}</div></div>`;
}

// ─── Router ───────────────────────────────────────────────────────────
function route() { const h = location.hash.replace(/^#\/?/, ''); return byId[h] ? h : ''; }
function render() {
  const r = route(), scr = byId[r];
  if (scr) OPEN[scr.dept] = true;
  renderSide(r);
  const c = $('#content');
  if (!scr) { c.innerHTML = homeLayout(); document.title = 'CDMS Prototype | Post-Auction Menus'; return; }
  document.title = `${scr.title} | ${scr.top ? '' : `${scr.dept} | `}CDMS Prototype`;
  let html = pageHead(scr);
  if (scr.layout === 'entry') html += entryLayout(scr);
  else { if (scr.layout === 'query') html += queryCard(scr); if (scr.filters && scr.actions.includes('Filter')) html += filterCard(scr); html += dataCard(scr, scr.title + ' list'); }
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
function selectedRows(scr, key) { const ui = U(scr.id); return sortRows(scr, scr.rows()).filter(r => (key in (ui.edits[r.id] || {}) ? ui.edits[r.id][key] : r[key])); }
function setMsg(scr, type, html) { U(scr.id).msg = type ? { type, html } : null; }
function validateEdits(scr, ids) {
  const ui = U(scr.id), map = Object.fromEntries(scr.rows().map(r => [r.id, r])), errors = {}, lines = [];
  (ids || Object.keys(ui.edits)).forEach(id => {
    const r = map[id]; if (!r) { delete ui.edits[id]; return; }
    const errs = scr.validate ? scr.validate(r, ui.edits[id] || {}) : {};
    Object.entries(errs).forEach(([k, m]) => { if (m) { (errors[id] ||= {})[k] = m; lines.push(`Lot ${esc(r.lot || '-')} (${esc(r.plate || r.customer)}): <b>${esc(scr.cols.find(c => c.key === k)?.label || k)}</b> ${esc(m)}`); } });
  });
  ui.errors = errors;
  return lines;
}
function applyEdits(scr, ids) {
  const ui = U(scr.id), map = Object.fromEntries(scr.rows().map(r => [r.id, r])); let n = 0;
  (ids || Object.keys(ui.edits)).forEach(id => {
    const r = map[id], e = ui.edits[id]; if (!r || !e) return;
    const changes = Object.entries(e).map(([k, val]) => {
      const col = scr.cols.find(c => c.key === k), nv = val === '' ? null : (col?.edit === 'money' && val !== null ? Number(val) : val);
      const ch = [col?.label || k, col?.edit, r._raw[k], nv]; r._raw[k] = nv; return ch;
    });
    logChange(scr, 'Update', r, changes);
    delete ui.edits[id]; n++;
  });
  return n;
}
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
// [BEHAVIOR] Sending the dispatch notice sets the Dispatch Date (date entered on the row, else today); pull-out deadline = 3 working days later
function recordDispatch(scr, rows, dateFor) {
  const ui = U(scr.id);
  rows.forEach(r => { const d = dateFor(r); logChange(scr, 'Update', r, [['Dispatch Date', 'date', r._raw.dispatch, d], ['For Dispatch Email?', 'check', r._raw.for_dispatch_email, false]]); r._raw.dispatch = d; r._raw.for_dispatch_email = false; delete ui.edits[r.id]; });
}
// [BEHAVIOR] VWD releases only when the seller's DOAS is signed (DOAS sellers) and no storage penalty is unpaid (JBAP Q17).
function releaseBlock(v) {
  if (releaseOf(v) === 'doas' && !v.buyer_doas) return 'Buyer signed DOAS is missing: this seller requires DOAS / legal documents signing. FAD records it in Document Monitoring.';
  if (v.penalty > 0) return `Storage penalty of PHP ${money(v.penalty)} is unpaid. Recording penalty payments comes with step 2 (holidays and extensions).`;
  return null;
}
// Records the release on the lot and returns the new VRF No. (running number, 5 digits)
function recordRelease(scr, v, f) {
  const co = D.meta.company, vrf = String(co.next.vrf++).padStart(5, '0');
  logChange(scr, 'Update', v, [['Vehicle Release Date', 'date', v._raw.release, f.date], ['VRF No.', 'text', v._raw.vrf_no, vrf], ['Released To', 'text', null, f.to]]);
  Object.assign(v._raw, { release: f.date, vrf_no: vrf, release_to: f.to, release_type: f.type, release_items: f.items });
  return vrf;
}
const RELEASE_ITEMS = ['No. of Keys', 'Copy of OR/CR', "Owner's Manual", 'Warranty booklet', 'Spare Tire', 'Tools', 'Jack', 'Radio', 'A/C', 'Accessories'];
const ACTIONS = {
  save(scr) {
    const ui = U(scr.id);
    if (!Object.keys(ui.edits).length) { setMsg(scr, 'info', 'There are no changes to save.'); render(); return; }
    const errs = validateEdits(scr);
    if (errs.length) { setMsg(scr, 'error', `Please fix ${errs.length} item(s) before saving:<br>${errs.slice(0, 6).join('<br>')}${errs.length > 6 ? '<br>…' : ''}`); render(); return; }
    const n = applyEdits(scr); setMsg(scr, null); ui.errors = {}; render();
    toast(`${n} record(s) saved. ${scr.savedNote || ''}`);
  },
  emailBaaf(scr) {
    const rows = selectedRows(scr, 'for_baaf'), ui = U(scr.id);
    if (!rows.length) { setMsg(scr, 'error', 'Tick <b>For BAAF</b> on at least one vehicle, then press Email BAAF.'); render(); return; }
    const errs = validateEdits(scr, rows.map(r => r.id).filter(id => ui.edits[id]));
    if (errs.length) { setMsg(scr, 'error', `Please fix before sending:<br>${errs.join('<br>')}`); render(); return; }
    setMsg(scr, null); render();
    const groups = {}; rows.forEach(r => (groups[r.cid] ||= []).push(r));
    const eff = (r, k) => (k in (ui.edits[r.id] || {}) ? ui.edits[r.id][k] : r[k]);
    const lotsOf = list => list.map(r => Object.assign({}, r, { transfer_fee: Number(eff(r, 'transfer_fee') || 0) }));
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
      note: 'Simulated: no email is actually sent. Click an attachment to preview it.', onAtt: key => openReport(docs[key][0], docs[key][1](), () => ACTIONS.emailBaaf(scr)),
      footer: [{ label: 'Cancel', kind: 'gh', onClick: closeModal }, { label: `Send ${Object.keys(groups).length} email(s)`, kind: 'pr', icon: 'mail', onClick: () => {
        rows.forEach(r => {
          const e = ui.edits[r.id] || {}, award = e.awarding || TODAY, tf = 'transfer_fee' in e && e.transfer_fee !== '' ? Number(e.transfer_fee) : r._raw.transfer_fee;
          logChange(scr, 'Update', r, [['Awarding Date', 'date', r._raw.awarding, award], ['Transfer Fees', 'money', r._raw.transfer_fee, tf], ['For BAAF', 'check', r._raw.for_baaf, false]]);
          r._raw.awarding = award; r._raw.transfer_fee = tf; r._raw.for_baaf = false; delete ui.edits[r.id];
        });
        closeModal(); render(); toast(`BAAF sent to ${Object.keys(groups).length} buyer(s). ${rows.length} vehicle(s) moved to Unpaid.`);
      } }] });
  },
  printSeller(scr) {
    const rows = selectedRows(scr, 'print_seller');
    if (!rows.length) { setMsg(scr, 'error', 'Tick <b>Print Payment to Seller</b> on at least one vehicle first.'); render(); return; }
    setMsg(scr, null); render();
    const groups = {}; rows.forEach(r => (groups[r.seller] ||= []).push(r));
    const body = Object.entries(groups).map(([code, list]) => REPORTS.payableToSeller(code, list, TODAY)).join('');
    openModal({ title: 'Print payment to seller', icon: 'print', wide: true, body, note: 'Support for the manual disbursement preparation.',
      footer: [{ label: 'Close', kind: 'gh', onClick: closeModal }, { label: 'Print', kind: 'pr', icon: 'print', onClick: printModal }] });
  },
  printComm(scr) {
    const rows = selectedRows(scr, 'print_comm');
    if (!rows.length) { setMsg(scr, 'error', 'Tick <b>Print?</b> on at least one vehicle first.'); render(); return; }
    const sellers = [...new Set(rows.map(r => r.seller))];
    if (sellers.length > 1) { setMsg(scr, 'error', `Selected vehicles belong to ${sellers.length} sellers (${sellers.join(', ')}). Print one seller at a time: each NOAH billing is per seller (to confirm).`); render(); return; }
    setMsg(scr, null); render();
    const body = `<div class="fgrid two no-print" style="padding:0 0 12px"><div class="fld"><label for="cb-no">Billing No. (from NOAH)</label><input class="ctl" id="cb-no" placeholder="e.g. 511" required><span class="err" id="cb-no-err"></span></div>
      <div class="fld"><label for="cb-date">Billing Date</label><input class="ctl" type="date" id="cb-date" value="${TODAY}" required><span class="err" id="cb-date-err"></span></div></div>
      ${REPORTS.billingComputation(sellers[0], '(entered above)', TODAY, rows)}`;
    openModal({ title: 'Print commission billing', icon: 'print', wide: true, body, note: 'Recording adds the billing to Billing Monitoring and Unpaid Billing.',
      footer: [{ label: 'Cancel', kind: 'gh', onClick: closeModal }, { label: 'Record billing & print', kind: 'pr', icon: 'print', onClick: () => {
        const no = $('#cb-no').value.trim(), bd = $('#cb-date').value; let ok = true;
        $('#cb-no-err').textContent = ''; $('#cb-date-err').textContent = ''; $('#cb-no').classList.remove('is-invalid'); $('#cb-date').classList.remove('is-invalid');
        if (!no) { $('#cb-no-err').textContent = 'Billing No. is required.'; $('#cb-no').classList.add('is-invalid'); ok = false; }
        else if (S.billing.some(b => b.no === no)) { $('#cb-no-err').textContent = `Billing No. ${no} already exists.`; $('#cb-no').classList.add('is-invalid'); ok = false; }
        const lastRemit = rows.map(r => r.pay_seller).sort().pop();
        if (!bd) { $('#cb-date-err').textContent = 'Billing Date is required.'; ok = false; }
        else if (bd > TODAY || bd < lastRemit) { $('#cb-date-err').textContent = `Must be between ${fmtDate(lastRemit)} and ${fmtDate(TODAY)}.`; $('#cb-date').classList.add('is-invalid'); ok = false; }
        if (!ok) return;
        const parts = [...new Set(rows.map(r => r.adate))].join('; ');
        const bill = { no, customer: SELLER[sellers[0]]?.name || sellers[0], particular: parts, bdate: bd, total: Math.round(sumBy(rows, 'ctotal') * 100) / 100, trans: null, pay: null, cr: '' };
        S.billing.push(bill);
        logChange(scr, 'Create', bill, [['Customer', 'text', null, bill.customer], ['Billing Date', 'date', null, bd], ['Total', 'money', null, bill.total]]);
        const ui = U(scr.id); rows.forEach(r => {
          logChange(scr, 'Update', r, [['Commission Billing No.', 'text', null, no], ['Print?', 'check', r._raw.print_comm, false]]);
          r._raw.billed = true; r._raw.print_comm = false; delete ui.edits[r.id];
        });
        const html = REPORTS.billingComputation(sellers[0], no, bd, rows);
        render(); openModal({ title: `Billing computation #${no}`, icon: 'print', wide: true, body: html, footer: [{ label: 'Close', kind: 'gh', onClick: closeModal }, { label: 'Print', kind: 'pr', icon: 'print', onClick: printModal }] });
        printModal(); toast(`Billing #${esc(no)} recorded for ${rows.length} vehicle(s). See Billing Monitoring and Unpaid Billing.`);
      } }] });
  },
  printCancel(scr) {
    const rows = selectedRows(scr, 'for_print');
    if (!rows.length) { setMsg(scr, 'error', 'Tick <b>For Print?</b> on at least one record first.'); render(); return; }
    setMsg(scr, null); render();
    const lines = rows.map(r => `<tr><td class="c">${r.auction}</td><td class="c">${esc(r.plate)}</td><td>${esc(r.customer)}</td><td class="c">${fmtDate(r.dcancel)}</td><td>${esc(r.just || '')}</td></tr>`).join('');
    const body = `<div class="doc"><h2>Cancellation Billing</h2><div class="meta"><span>JBA Philippines Inc.</span><span>Billing Date ${fmtDate(TODAY)}</span></div>
      <table><thead><tr><th>Auction No.</th><th>Plate</th><th>Customer Name</th><th>Date Cancelled</th><th>Reason</th></tr></thead><tbody>${lines}</tbody></table>
      <p class="fn">Cancellation fee amount and payment deadline: rule to be confirmed with JBAP.</p></div>`;
    openModal({ title: 'Print cancellation billing', icon: 'print', wide: true, body, note: 'Recording sets the Cancellation Billing Date to today.',
      footer: [{ label: 'Cancel', kind: 'gh', onClick: closeModal }, { label: 'Record billing date & print', kind: 'pr', icon: 'print', onClick: () => {
        recordCancellationBilling(scr, rows);
        printModal(); closeModal(); render(); toast(`${rows.length} cancellation(s) billed. They moved to Cancellation Payment.`);
      } }] });
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
      return REPORTS.email({ from: co.emails.finance, to: `${b.customer} <${b.email}>`, cc: `${co.emails.sales}; ${co.emails.vwd}; ${co.emails.finance}`, subject: 'JBAP VEHICLE FOR RELEASE',
        atts: [{ key: b.cid, name: 'VEHICLE DISPATCH.pdf' }],
        body: `We are pleased to inform you that the vehicle(s) listed in the attached Vehicle Dispatch Form are now available for release. Kindly ensure that vehicles are pulled out on or before the specified deadline to avoid Storage Penalties amounting to Php ${money(PENALTY_PER_DAY)} per day, including weekends and until removal of vehicle. For vehicles requiring the signing of Deed of Absolute Sale (DOAS) and other Legal Documents prior to release, please proceed to the JBAP Office within the prescribed period to complete the signing. Please note that vehicles cannot be released without a signed DOAS / Legal Documents.` });
    }).join('');
    openModal({ title: `Email dispatch form: ${Object.keys(groups).length} buyer(s), ${rows.length} vehicle(s)`, icon: 'mail', wide: true, body: mails,
      note: 'Simulated: no email is actually sent. Click the attachment to preview it.', onAtt: key => openReport('VEHICLE DISPATCH.pdf', docs[key](), () => ACTIONS.emailDispatch(scr)),
      footer: [{ label: 'Cancel', kind: 'gh', onClick: closeModal }, { label: `Send ${Object.keys(groups).length} email(s)`, kind: 'pr', icon: 'mail', onClick: () => {
        recordDispatch(scr, rows, dateFor); closeModal(); render(); toast(`Dispatch form sent to ${Object.keys(groups).length} buyer(s). ${rows.length} vehicle(s) moved to Unreleased Unit.`);
      } }] });
  },
  releaseVehicle(scr, el) {
    const v = scr.rows().find(r => r.id === el.dataset.rid); if (!v) return;
    const block = releaseBlock(v);
    if (block) { openModal({ title: `Cannot release ${v.plate}`, icon: 'ban', body: `<p>${esc(block)}</p>`, footer: [{ label: 'Close', kind: 'gh', onClick: closeModal }] }); return; }
    const items = RELEASE_ITEMS.map((t, i) => `<label class="chkline"><input type="checkbox" class="chk" id="rl-i${i}" value="${esc(t)}">${esc(t)}</label>`).join('');
    openModal({ title: `Release ${v.plate} (${v.model})`, icon: 'play',
      body: `<div class="fgrid two"><div class="fld"><label for="rl-date">Release date</label><input class="ctl" type="date" id="rl-date" value="${TODAY}"><span class="err" id="rl-date-err"></span></div>
        <div class="fld"><label for="rl-to">Released to</label><input class="ctl" id="rl-to" value="${esc(v.customer)}"></div>
        <div class="fld"><label for="rl-type">Type</label><select class="ctl" id="rl-type"><option>Sold</option><option>Return to Seller</option><option>Others</option></select></div><div></div>
        <div class="fld full"><span class="lbl">Checklist</span><div class="cols2">${items}</div></div></div>`,
      note: 'Records the release date and the next VRF No., then prints the release form and gate pass.',
      footer: [{ label: 'Cancel', kind: 'gh', onClick: closeModal }, { label: 'Release & print', kind: 'pr', icon: 'print', onClick: () => {
        const date = $('#rl-date').value, err = !date ? 'Release date is required.' : notFuture(date) || notBefore(date, v.dispatch, 'the Dispatch Date');
        if (err) { $('#rl-date-err').textContent = err; $('#rl-date').classList.add('is-invalid'); return; }
        const f = { date, to: $('#rl-to').value.trim() || v.customer, type: $('#rl-type').value, items: RELEASE_ITEMS.filter((_, i) => $(`#rl-i${i}`).checked) };
        const vrf = recordRelease(scr, v, f); render();
        openModal({ title: `Vehicle release form VRF No. ${vrf}`, icon: 'print', wide: true, body: REPORTS.releaseForm(enrichV(v._raw), f, vrf),
          footer: [{ label: 'Close', kind: 'gh', onClick: closeModal }, { label: 'Print', kind: 'pr', icon: 'print', onClick: printModal }] });
        printModal(); toast(`${v.plate} released (VRF No. ${vrf}).`);
      } }] });
  },
  resetFilter(scr) { const ui = U(scr.id); ui.filters = {}; ui.applied = {}; ui.page = 1; render(); },
  entryClear(scr) { U(scr.id).entry = null; render(); },
};

// ─── Events (delegated) ───────────────────────────────────────────────
function onEdit(el) {
  const scr = currentScr(); if (!scr) return;
  const ui = U(scr.id), id = el.dataset.row, key = el.dataset.key;
  const row = scr.rows().find(r => r.id === id); if (!row) return;
  const val = el.type === 'checkbox' ? el.checked : el.value;
  const orig = row[key], same = el.type === 'checkbox' ? !!orig === val : String(orig ?? '') === String(val ?? '');
  if (same) { if (ui.edits[id]) { delete ui.edits[id][key]; if (!Object.keys(ui.edits[id]).length) delete ui.edits[id]; } }
  else (ui.edits[id] ||= {})[key] = val;
  el.classList.toggle('is-dirty', !same); el.classList.remove('is-invalid');
  el.closest('tr')?.classList.toggle('is-dirty', !!ui.edits[id]);
  // refresh button counters without re-rendering (keeps focus in the table)
  (scr.buttons || []).forEach(b => { const n = b.act === 'save' ? Object.keys(ui.edits).length : effectiveCount(scr, b.count); const s = $(`[data-count="${b.act}"]`); if (s) { s.textContent = n; s.hidden = !n; } });
}
function bind() {
  const content = $('#content'), menu = $('#menu');
  menu.addEventListener('click', ev => {
    const g = ev.target.closest('[data-group]'); if (g) { OPEN[g.dataset.group] = !OPEN[g.dataset.group]; renderSide(route()); return; }
    const d = ev.target.closest('[data-disabled]'); if (d) { toast(`“${esc(d.dataset.disabled)}” is not part of this prototype. Only FAD, SMD, VWD and Log Activity are active.`, 'warn'); return; }
    if (ev.target.closest('.mis, a.mi')) document.body.classList.remove('nav-open');
  });
  content.addEventListener('change', ev => {
    const el = ev.target;
    if (el.dataset.row) return onEdit(el);
    if (el.matches('[data-size]')) { const ui = U(route()); ui.size = +el.value; ui.page = 1; render(); }
  });
  content.addEventListener('input', ev => {
    const el = ev.target;
    if (el.dataset.row && el.type !== 'checkbox') return onEdit(el);
    if (el.dataset.filter) U(route()).filters[el.dataset.filter] = el.value;
  });
  content.addEventListener('submit', ev => {
    ev.preventDefault(); const scr = currentScr(); if (!scr) return; const ui = U(scr.id), form = ev.target.dataset.form;
    if (form === 'filter') { content.querySelectorAll('[data-filter]').forEach(i => { ui.filters[i.dataset.filter] = i.value; }); ui.applied = Object.assign({}, ui.filters); ui.page = 1; render(); }
    if (form === 'query') { ui.asOf = $('#q-asof').value || TODAY; ui.page = 1; render(); toast(`Liability generated as of ${fmtDate(ui.asOf)}.`); }
    if (form === 'find') entryFind(scr);
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
  window.addEventListener('hashchange', () => { closeModal(); render(); window.scrollTo(0, 0); });
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
  e.form = { status: $('#ce-status').value, date: $('#ce-date').value, waived: $('#ce-waived').checked, just: $('#ce-just').value.trim() };
  e.errors = {};
  if (e.form.status !== 'Cancelled') e.errors.status = 'Change Status to Cancelled.';
  if (!e.form.date) e.errors.date = 'Date Cancelled is required.';
  else if (e.form.date > TODAY) e.errors.date = 'Cannot be after today.';
  else if (v.awarding && e.form.date < v.awarding) e.errors.date = `Cannot be before the Awarding Date (${fmtDate(v.awarding)}).`;
  if (!e.form.just) e.errors.just = e.form.waived ? 'Justification is required when the fee is waived.' : 'Enter the reason for cancellation.';
  if (Object.keys(e.errors).length) { render(); return; }
  openModal({ title: 'Cancel this transaction?', icon: 'ban',
    body: `<p>Lot <b>${esc(v.lot)}</b> of Auction <b>${v.auction}</b> (${esc(v.plate)}, ${esc(v.customer)}) will be set to <b>Cancelled</b> on ${fmtDate(e.form.date)}.</p>
      <p>Cancellation fee: <b>${e.form.waived ? 'waived' : 'to be billed'}</b>. The vehicle leaves all FAD work lists${e.form.waived ? '' : ' and appears in Cancellation Billing'}.</p>`,
    footer: [{ label: 'Keep transaction', kind: 'gh', onClick: closeModal }, { label: 'Cancel transaction', kind: 'dg', icon: 'ban', onClick: () => {
      logChange(scr, 'Cancel', v, [['Status', 'text', v._raw.status, 'Cancelled'], ['Date Cancelled', 'date', null, e.form.date],
        ['Cancellation Fee Waived', null, null, e.form.waived], ['Justification of Waiver', 'text', null, e.form.just]]);
      v._raw.status = 'Cancelled';
      S.cancels.unshift({ id: `C-${v.auction}-${v.lot}-new`, auction: v.auction, lot: v.lot, plate: v.plate, customer: v.customer, cid: v.cid, dcancel: e.form.date,
        waived: e.form.waived, just: e.form.just, seller: v.seller, remitted: null, bill_date: null, paid_date: null, amount: null, for_print: false });
      U(scr.id).entry = null; closeModal(); render(); toast(`Lot ${esc(v.lot)} of Auction ${v.auction} cancelled.`);
    } }] });
}

// ─── Init ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (!D) { $('#content').innerHTML = '<div class="msg error">data.js did not load. Keep data.js next to index.html and load it before app.js.</div>'; return; }
  bind(); render();
});
