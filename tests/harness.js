// Loads the prototype's browser scripts (data.js, app.js, reports.js) in Node with minimal DOM stubs.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
// Top-level names from app.js / reports.js that tests may use (missing ones are returned as undefined).
const EXPORTS = ['D', 'S', 'SELLER', 'byId', 'U', 'V', 'sold', 'B', 'CX', 'enrichV', 'ACTIONS', 'logChange', 'TODAY',
  'sellerMoney', 'dispatchReady', 'releaseOf', 'docValidate', 'cancelSplit', 'recordCancellationBilling', 'recordBillingTransmittal',
  'recordDispatch', 'releaseBlock', 'recordRelease', 'recordDocTransmittal', 'REPORTS', 'DOC_TYPES', 'longDate', 'shortDate', 'cancelLetterGroups',
  'addWorkdays', 'fmtDate',
  // proposed improvements and wishes 4–5 (spec 2026-10-15)
  'isProposed', 'setProposed', 'shown', 'colsOf', 'tagHtml', 'SCREENS', 'selectedRows', 'applyEdits', 'tickDefault', 'tickValue',
  'dirtyCount', 'cdmsCancelsPending', 'recordCancellation', 'recordCommissionBilling', 'recordSaafSent',
  'dropHolds', 'dispatchCc', 'queueCounts', 'PROPOSALS', 'LATEST_AUCTION', 'rtsEligible', 'recordReturnClearance',
  // JBAP feedback round 1 (spec 2026-10-15)
  'doasOf', 'docStatus', 'DOC_STATUSES', 'workdaysBetween', 'cellHtml', 'applyFilters', 'bondOf', 'recordAwarding',
  'bondStatus', 'BOND_STATUSES', 'bondValidate', 'groupOf', 'sideHtml', 'pageHead', 'homeLayout', 'invStatusOf', 'INV_STATUSES',
  'dataCard', 'XLSX', 'rebateRecord', 'rebateLotsIn',
  // Customer Inquiry and customer page (16 Oct 2026)
  'CUST_ID', 'buyerRows', 'buyerOf', 'stepOf', 'custRoute', 'customerPage',
  // JBAP feedback round 2 (16 Oct 2026)
  'routeOf', 'MOVED', 'validateEdits', 'entryLayout'];
function load() {
  const window = { addEventListener() {} };
  new Function('window', fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8'))(window);
  const extra = path.join(ROOT, 'data-extra.js');   // [MOCK] sample data for the proposed improvements and wishes 4–5
  if (fs.existsSync(extra)) new Function('window', fs.readFileSync(extra, 'utf8'))(window);
  const cls = { add() {}, remove() {}, toggle() {}, contains() { return false; } };
  const document = { addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, body: { classList: cls } };
  let src = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  for (const f of ['xlsx.js', 'reports.js']) if (fs.existsSync(path.join(ROOT, f))) src += '\n' + fs.readFileSync(path.join(ROOT, f), 'utf8');   // same order as index.html
  const ret = EXPORTS.map(n => `${n}: typeof ${n} === 'undefined' ? undefined : ${n}`).join(', ');
  const api = new Function('window', 'document', 'location', `${src}\n;return { ${ret} };`)(window, document, { hash: '' });
  return Object.assign({ api }, api);
}
module.exports = { load };
