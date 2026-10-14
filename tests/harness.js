// Loads the prototype's browser scripts (data.js, app.js, reports.js) in Node with minimal DOM stubs.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
// Top-level names from app.js / reports.js that tests may use (missing ones are returned as undefined).
const EXPORTS = ['D', 'S', 'SELLER', 'byId', 'U', 'V', 'sold', 'B', 'CX', 'enrichV', 'ACTIONS', 'logChange', 'TODAY',
  'sellerMoney', 'dispatchReady', 'releaseOf', 'docValidate', 'cancelSplit', 'recordCancellationBilling', 'recordBillingTransmittal',
  'recordDispatch', 'releaseBlock', 'recordRelease', 'recordDocTransmittal', 'REPORTS', 'DOC_TYPES', 'longDate', 'shortDate'];
function load() {
  const window = { addEventListener() {} };
  new Function('window', fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8'))(window);
  const cls = { add() {}, remove() {}, toggle() {}, contains() { return false; } };
  const document = { addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, body: { classList: cls } };
  let src = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  if (fs.existsSync(path.join(ROOT, 'reports.js'))) src += '\n' + fs.readFileSync(path.join(ROOT, 'reports.js'), 'utf8');
  const ret = EXPORTS.map(n => `${n}: typeof ${n} === 'undefined' ? undefined : ${n}`).join(', ');
  const api = new Function('window', 'document', 'location', `${src}\n;return { ${ret} };`)(window, document, { hash: '' });
  return Object.assign({ api }, api);
}
module.exports = { load };
