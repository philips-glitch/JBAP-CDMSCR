const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness');
test('Customer page Sales Actions tab and add form', () => {
  const P = load(), cid = 'B9034', html = P.customerPage(cid, 'sales-actions');
  assert.match(html, />Sales Actions</); assert.match(html, /Add sales action/);
  assert.ok(P.salesActionError({ date: P.TODAY, action: 'Call', notes: '' }).notes);
  assert.ok(P.salesActionError({ date: '2999-01-01', action: 'Call', notes: 'x' }).date);
  assert.ok(P.salesActionError({ date: P.TODAY, action: 'Call', notes: 'x', follow_up: '2000-01-01' }).follow_up);
  assert.strictEqual(P.salesActionError({ date: P.TODAY, action: 'Call', notes: 'Asked about pull-out' }), null);
  const n = P.S.salesActions.length; P.recordSalesAction(cid, { date: P.TODAY, action: 'Call', notes: 'Asked about pull-out', follow_up: '' });
  assert.strictEqual(P.S.salesActions.length, n + 1); assert.strictEqual(P.S.log.at(-1).module, 'SMD'); assert.strictEqual(P.S.log.at(-1).action, 'Create');
  assert.match(P.customerPage(cid, 'sales-actions'), /Asked about pull-out/);
});
test('Customer › Sales Actions list is enabled, view only, newest first, with filters', () => {
  const P = load(), scr = P.byId['customer/sales-actions'];
  assert.ok(scr && scr.isNew && scr.dept === 'Customer'); assert.deepStrictEqual(scr.actions, ['View', 'Filter', 'Sort']);
  const rows = scr.rows(); assert.ok(rows.length >= 6);
  assert.ok(rows.every((r, i) => i === 0 || rows[i - 1].date >= r.date));
  assert.deepStrictEqual(scr.filters.map(f => f.key), ['customer', 'action', 'date', 'due']);
  assert.ok(!P.sideHtml('customer/sales-actions').includes('aria-disabled="true">Sales Actions'));
  assert.strictEqual(P.SCREENS.length, 39);
});

// ─── More checks (JBAP 26 Oct 2026: Sales Actions) ───
const ACTION_TYPES = ['Call', 'Email', 'Visit', 'Meeting', 'Other'];
const tabBar = h => h.slice(h.indexOf('aria-label="Lot lists"'), h.indexOf('</nav>', h.indexOf('aria-label="Lot lists"')));
const tabTable = h => { const i = h.indexOf('<div class="tw">', h.indexOf('aria-label="Lot lists"')); return h.slice(i, h.indexOf('</table>', i)); };
const heads = t => [...t.matchAll(/<th scope="col"><span class="hb">([^<]*)/g)].map(m => m[1]);

test('[MOCK] sample: 7 actions on 3 buyers that are in the data (B9034 among them), 3 Sep to 6 Oct 2026, one follow-up due', () => {
  const P = load(), a = P.D.salesActions, buyers = new Set(a.map(x => x.cid));
  assert.strictEqual(a.length, 7); assert.strictEqual(buyers.size, 3); assert.ok(buyers.has('B9034'));
  for (const x of a) {
    assert.ok(P.buyerOf(x.cid), `${x.cid} is a buyer in the data`); assert.ok(ACTION_TYPES.includes(x.action), x.action);
    assert.ok(x.date >= '2026-09-01' && x.date <= '2026-10-06', x.date); assert.ok(x.notes.trim().length > 10); assert.ok(/^smd\./.test(x.by), 'a sample staff id, not a name');
    assert.ok(!x.follow_up || x.follow_up >= x.date, 'follow-up not before the date');
  }
  assert.strictEqual(a.filter(x => x.follow_up && x.follow_up <= P.TODAY).length, 1, 'exactly one follow-up is due');
  assert.ok(new Set(a.map(x => x.id)).size === 7, 'unique ids');
  assert.notStrictEqual(P.S.salesActions, P.D.salesActions, 'the session copy is not the sample itself');
  P.S.salesActions[0].notes = 'changed'; assert.notStrictEqual(P.D.salesActions[0].notes, 'changed');
});

test('salesActionError: each message, per field; blank follow-up is fine; follow-up may equal the date or lie before today', () => {
  const P = load(), ok = { date: P.TODAY, action: 'Visit', notes: 'x' };
  assert.strictEqual(P.salesActionError({ ...ok, follow_up: '' }), null); assert.strictEqual(P.salesActionError({ ...ok, follow_up: null }).follow_up, 'Type the date as mm/dd/yyyy.');
  assert.strictEqual(P.salesActionError({ ...ok, follow_up: P.TODAY }), null, 'on the date is allowed');
  assert.strictEqual(P.salesActionError({ ...ok, date: '2026-10-01', follow_up: '2026-10-05' }), null, 'a follow-up already past (due) is allowed');
  assert.deepStrictEqual(P.salesActionError({ ...ok, notes: '   ' }), { notes: 'Notes are required.' });
  assert.deepStrictEqual(P.salesActionError({ ...ok, date: '' }), { date: 'Type the date as mm/dd/yyyy.' });
  assert.deepStrictEqual(P.salesActionError({ ...ok, date: null }), { date: 'Type the date as mm/dd/yyyy.' });
  assert.deepStrictEqual(P.salesActionError({ ...ok, date: '2026-10-09' }), { date: 'Date cannot be after today.' }, 'the day after the demo date');
  assert.deepStrictEqual(P.salesActionError({ ...ok, date: '2026-10-05', follow_up: '2026-10-04' }), { follow_up: 'Next follow-up cannot be before the date.' });
  assert.ok(!P.salesActionError({ ...ok, date: '', follow_up: '2026-10-04' }).follow_up, 'no comparison with a missing date');
  assert.deepStrictEqual(P.salesActionError({ ...ok, action: '' }), { action: 'Choose the action.' });
  assert.deepStrictEqual(Object.keys(P.salesActionError({ date: '', action: 'Call', notes: '', follow_up: null })), ['date', 'notes', 'follow_up'], 'every problem at once');
  assert.deepStrictEqual(P.SALES_ACTIONS, ACTION_TYPES);
});

test('recordSalesAction: newest on top, SMD user, notes trimmed, blank follow-up is null, logged under SMD (Create: Action, Notes) on the buyer', () => {
  const P = load(), cid = 'B9034', name = P.buyerOf(cid).name, n = P.S.salesActions.length, logs = P.S.log.length;
  const a = P.recordSalesAction(cid, { date: P.TODAY, action: 'Meeting', notes: '  Agreed on a pick-up date  ', follow_up: '' });
  assert.strictEqual(P.S.salesActions[0], a); assert.strictEqual(a.id, `SA-${n + 1}`); assert.strictEqual(a.by, 'SMD user'); assert.strictEqual(a.follow_up, null); assert.strictEqual(a.notes, 'Agreed on a pick-up date');
  assert.strictEqual(a.cid, cid); assert.strictEqual(a.date, P.TODAY); assert.strictEqual(a.action, 'Meeting');
  const added = P.S.log.slice(logs); assert.strictEqual(added.length, 2);
  assert.deepStrictEqual(added.map(l => [l.module, l.screen, l.action, l.field, l.old, l.new]), [['SMD', 'Sales Actions', 'Create', 'Action', '', 'Meeting'], ['SMD', 'Sales Actions', 'Create', 'Notes', '', 'Agreed on a pick-up date']]);
  assert.ok(added.every(l => l.record === `Customer ${cid} · ${name}`), added[0].record);
  const b = P.recordSalesAction(cid, { date: P.TODAY, action: 'Call', notes: 'Second one today', follow_up: '2026-10-20' });
  assert.strictEqual(b.follow_up, '2026-10-20'); assert.strictEqual(P.buyerOf(cid).sales[0], b, 'of two actions on one date the last added is first');
  assert.strictEqual(P.D.salesActions.length, 7, 'the sample is not changed');
});

test('newest first also for a back-dated entry: the list sorts by date, not by when it was added', () => {
  const P = load(), scr = P.byId['customer/sales-actions'];
  P.recordSalesAction('B9034', { date: '2026-08-01', action: 'Other', notes: 'Back-dated', follow_up: '' });
  const rows = scr.rows(); assert.strictEqual(rows.at(-1).notes, 'Back-dated'); assert.ok(rows.every((r, i) => i === 0 || rows[i - 1].date >= r.date));
  const mine = P.buyerOf('B9034').sales; assert.strictEqual(mine.at(-1).notes, 'Back-dated'); assert.ok(mine.every((r, i) => i === 0 || mine[i - 1].date >= r.date));
});

test('customer page tab: only this buyer\'s actions, columns Date, Action, Notes, Next Follow-up, By, form above the list, count on the tab', () => {
  const P = load(), cid = 'B9034', b = P.buyerOf(cid), h = P.customerPage(cid, 'sales-actions');
  assert.strictEqual(b.sales.length, 4); assert.ok(b.sales.every(a => a.cid === cid));
  assert.match(tabBar(h), /aria-current="page">Sales Actions<span class="ptag mini new"[^>]*>New<\/span><span class="cnt">4<\/span>/);
  assert.match(P.customerPage(cid, 'sold'), /Sales Actions<span class="ptag mini new"[^>]*>New<\/span><span class="cnt">4<\/span>/, 'the count is on every tab bar');
  const t = tabTable(h); assert.deepStrictEqual(heads(t), ['Date', 'Action', 'Notes', 'Next Follow-up', 'By']);
  assert.strictEqual((t.match(/<tr data-lot=/g) || []).length, 4);
  assert.ok(h.indexOf('Add sales action') < h.indexOf('<div class="tw">', h.indexOf('aria-label="Lot lists"')), 'form above the list');
  assert.ok(t.indexOf('Buyer asked when the original documents') < t.indexOf('Met the buyer about the DOAS') && t.indexOf('Met the buyer about the DOAS') < t.indexOf('Asked if the buyer will join'), 'newest first');
  assert.ok(t.includes('>10/06/2026<') && t.includes('>10/12/2026<'), 'dates as mm/dd/yyyy'); assert.ok(!t.includes('2026-10-06'));
  assert.ok(t.includes('class="tx wrap"') && t.includes('>smd.manager<'), 'long notes wrap; By shown');
  assert.ok(!t.includes('Sent the list of unpaid lots'), 'another buyer\'s action is not shown');
  assert.match(h, /aria-label="Sales Actions"><div class="card-h"><div class="ico">[\s\S]*?<\/div>Sales Actions<\/div>/, 'the card is called Sales Actions on this tab');
  assert.match(P.customerPage(cid, 'sold'), /aria-label="Lots"><div class="card-h"><div class="ico">[\s\S]*?<\/div>Lots<\/div>/, 'and Lots on the others');
  const none = P.buyerRows().find(r => !P.S.salesActions.some(a => a.cid === r.cid)).cid;
  assert.match(P.customerPage(none, 'sales-actions'), /No sales actions recorded for this buyer yet/); assert.match(P.customerPage(none, 'sales-actions'), /Add sales action/, 'the form is there for a buyer with none');
  assert.doesNotMatch(P.customerPage(cid, 'sold'), /id="sa-notes"/, 'no form on the other tabs');
  assert.match(h, /<span class="pill">View<\/span><span class="pill u">Update<\/span>/); assert.doesNotMatch(P.customerPage(cid, 'sold'), /pill u/, 'View only on the lot tabs');
  assert.match(P.customerPage(cid, 'sold').match(/<p class="rule">[\s\S]*?<\/p>/)[0], /Sales Actions = what SMD did to follow up with this buyer/);
});

test('Add sales action form: labels, defaults (today, Call), five actions, no problems shown at first', () => {
  const P = load(), h = P.customerPage('B9034', 'sales-actions'), f = h.slice(h.indexOf('<form class="fb" data-form="salesaction"'), h.indexOf('</form>', h.indexOf('data-form="salesaction"')));
  for (const [id, label] of [['sa-date', 'Date'], ['sa-action', 'Action'], ['sa-notes', 'Notes'], ['sa-follow_up', 'Next Follow-up (optional)']]) assert.match(f, new RegExp(`<label for="${id}">${label.replace(/[()]/g, '\\$&')}</label>`), id);
  assert.match(f, /value="10\/08\/2026" id="sa-date"/); assert.match(f, /value="" id="sa-follow_up"/);
  assert.deepStrictEqual([...f.matchAll(/<option( selected)?>([^<]*)<\/option>/g)].map(m => [m[2], !!m[1]]), [['Call', true], ['Email', false], ['Visit', false], ['Meeting', false], ['Other', false]]);
  assert.match(f, /<textarea class="ctl" id="sa-notes" rows="3" ><\/textarea>/); assert.match(f, /<button type="submit" class="btn pr">[\s\S]*Add sales action<\/button>/);
  assert.doesNotMatch(f, /role="alert"|aria-invalid|is-invalid/); assert.match(f, /novalidate/);
});

test('refused form: what was typed stays, each message is role="alert", linked by aria-describedby, the field is marked invalid', () => {
  const P = load(), cid = 'B9034', errors = P.salesActionError({ date: null, action: 'Email', notes: '', follow_up: null });
  P.salesDraft[cid] = { date: 'tomorrow', action: 'Email', notes: '', follow_up: '13/45', errors };
  const h = P.customerPage(cid, 'sales-actions'), f = h.slice(h.indexOf('data-form="salesaction"'), h.indexOf('</form>', h.indexOf('data-form="salesaction"')));
  for (const k of ['date', 'notes', 'follow_up']) {
    assert.match(f, new RegExp(`id="sa-${k}"[^>]*aria-invalid="true" aria-describedby="sa-${k}-err"`), k);
    assert.match(f, new RegExp(`<span class="err" id="sa-${k}-err" role="alert">[^<]+</span>`), k);
  }
  assert.ok(f.includes('value="tomorrow"') && f.includes('value="13/45"'), 'the text that was typed'); assert.match(f, /<option selected>Email<\/option>/);
  assert.ok(f.includes('Notes are required.') && f.includes('Type the date as mm/dd/yyyy.'));
  assert.doesNotMatch(f, /id="sa-action-err"/, 'no message for a field without a problem');
  assert.doesNotMatch(P.customerPage('B0313', 'sales-actions'), /role="alert"/, 'the draft belongs to one buyer');
});

test('the Customer page keeps the Customer Inquiry highlighted; the Sales Actions menu item is highlighted on its own list only', () => {
  const P = load(), item = (side, href) => side.match(new RegExp(`<a class="mis (is-active)?" href="#/${href}"`));
  const own = P.sideHtml('customer/sales-actions'), page = P.sideHtml('customer/B9034/sales-actions');
  assert.ok(item(own, 'customer/sales-actions')[1] && !item(own, 'customer-inquiry')[1], 'the list highlights Sales Actions');
  assert.ok(!item(page, 'customer/sales-actions')[1] && item(page, 'customer-inquiry')[1], 'a customer page, even on its Sales Actions tab, is Customer Inquiry');
  assert.match(own, /Sales Actions<span class="ptag mini new"[^>]*>New<\/span><span class="cnt">7<\/span>/, 'New mark and the number of actions');
  assert.match(P.sideHtml('customer-inquiry'), /only Customer Inquiry, Sales Actions, Report/);
});

test('routing: customer/sales-actions is the list screen, not a customer page of a buyer called "sales-actions"; the customer tab still routes', () => {
  const P = load();
  assert.strictEqual(P.custRoute('customer/sales-actions'), null); assert.strictEqual(P.routeOf('customer/sales-actions'), 'customer/sales-actions');
  assert.deepStrictEqual(P.custRoute('customer/B9034/sales-actions'), { cid: 'B9034', tab: 'sales-actions' }); assert.strictEqual(P.routeOf('customer/B9034/sales-actions'), 'customer/B9034/sales-actions');
  assert.deepStrictEqual(P.custRoute('customer/B9034'), { cid: 'B9034', tab: 'sold' }); assert.strictEqual(P.custRoute('customer/B9034/sales-actions/x'), null);
  assert.match(P.pageHead(P.byId['customer/sales-actions']), /Home<\/a>›<span>Customer<\/span>›<b>Sales Actions<\/b>/);
  assert.match(P.pageHead(P.byId['customer/sales-actions']), /<h1>Sales Actions<span class="ptag new"[^>]*>New<\/span><\/h1>/);
});

test('list: name and Buyer ID open the customer page on its Sales Actions tab; Notes wrap; By and Next Follow-up shown', () => {
  const P = load(), scr = P.byId['customer/sales-actions'], r = scr.rows().find(x => x.cid === 'B9034');
  const col = k => scr.cols.find(c => c.key === k), cell = k => P.cellHtml(scr, r, col(k), false);
  assert.ok(cell('cid').includes('<a class="blink" href="#/customer/B9034/sales-actions">B9034</a>'), cell('cid'));
  assert.ok(cell('customer').includes('<a class="blink" href="#/customer/B9034/sales-actions">RYAN CATAPIA SUAREZ</a>'), cell('customer'));
  assert.deepStrictEqual(scr.cols.map(c => c.label), ['Date', 'Buyer ID', 'Customer Name', 'Action', 'Notes', 'Next Follow-up', 'By']);
  assert.match(cell('notes'), /^<td class="\s*"><div class="tx wrap" style="max-width:300px" title="Buyer asked when/);
  assert.ok(cell('date').includes('10/06/2026') && cell('follow_up').includes('10/12/2026') && cell('by').includes('smd.staff'));
  assert.ok(P.customerPage('B9034', 'sold').includes('href="#/customer/B9034/sales-actions"'));
  const lotLink = P.cellHtml(P.byId['FAD/unpaid'], { cid: 'B9034', customer: 'X' }, P.byId['FAD/unpaid'].cols.find(c => c.key === 'customer'), false);
  assert.ok(lotLink.includes('href="#/customer/B9034"') && !lotLink.includes('sales-actions'), 'other screens still open the Sold tab');
  assert.ok(scr.rule.includes('customer page, tab Sales Actions'));
});

test('list filters: Customer Name / Buyer ID, Action (several), Date range, Follow-up due (on or before today)', () => {
  const P = load(), scr = P.byId['customer/sales-actions'], run = applied => { P.U(scr.id).applied = applied; return P.applyFilters(scr, scr.rows()); };
  assert.strictEqual(run({}).length, 7);
  assert.deepStrictEqual([...new Set(run({ customer: 'b9034' }).map(r => r.cid))], ['B9034'], 'by Buyer ID, any case'); assert.strictEqual(run({ customer: 'B9034' }).length, 4);
  assert.strictEqual(run({ customer: 'sanchez de guzman' }).length, 2, 'by part of the name'); assert.strictEqual(run({ customer: 'nobody' }).length, 0);
  assert.strictEqual(run({ action: ['Call'] }).length, 3); assert.strictEqual(run({ action: ['Call', 'Visit'] }).length, 4); assert.strictEqual(run({ action: [] }).length, 7);
  assert.deepStrictEqual(scr.filters.find(f => f.key === 'action').options(), ACTION_TYPES);
  assert.deepStrictEqual(run({ date__from: '2026-10-01', date__to: '2026-10-06' }).map(r => r.id), ['SA-7', 'SA-6', 'SA-5']); assert.strictEqual(run({ date__to: '2026-09-15' }).length, 2);
  const due = run({ due: ['Yes'] }); assert.deepStrictEqual(due.map(r => r.id), ['SA-6']); assert.ok(due.every(r => r.follow_up && r.follow_up <= P.TODAY));
  assert.strictEqual(run({ due: ['No'] }).length, 6, 'No = a follow-up still ahead, or none'); assert.strictEqual(run({ due: ['Yes', 'No'] }).length, 7);
  P.recordSalesAction('B9034', { date: '2026-10-01', action: 'Call', notes: 'Due today', follow_up: P.TODAY });
  assert.strictEqual(run({ due: ['Yes'] }).length, 2, 'a follow-up on today is due'); assert.strictEqual(run({ due: ['No'] }).length, 6);
  const f = P.filterCard(scr); assert.match(f, /Follow-up due/); assert.match(f, /Customer Name \/ Buyer ID/);
});

test('an action added on the customer page shows in Customer › Sales Actions and the count of the menu; view only there', () => {
  const P = load(), scr = P.byId['customer/sales-actions'];
  P.recordSalesAction('B0193', { date: P.TODAY, action: 'Other', notes: 'Left a message', follow_up: '' });
  const r = scr.rows()[0]; assert.strictEqual(r.notes, 'Left a message'); assert.strictEqual(r.customer, P.buyerOf('B0193').name); assert.strictEqual(r.by, 'SMD user'); assert.strictEqual(scr.rows().length, 8);
  assert.match(P.sideHtml('x'), /Sales Actions<span class="ptag mini new"[^>]*>New<\/span><span class="cnt">8<\/span>/);
  assert.match(P.dataCard(scr, 'Sales Actions list'), /Left a message/); assert.doesNotMatch(P.dataCard(scr, 'x'), /data-form="salesaction"|data-act=/, 'no add form or button on the list');
  assert.match(P.customerPage('B0193', 'sales-actions'), /Left a message/);
  assert.ok(!scr.actions.includes('Update')); assert.ok(!scr.buttons);
  const log = P.byId['log-activity']; assert.match(log.rule, /sales action added on a customer page is logged under SMD/);
  P.U(log.id).applied = { module: ['SMD'] }; assert.match(log.emptyNote(), /adds a sales action on a customer page/);
  assert.ok(log.rows().some(l => l.screen === 'Sales Actions' && l.module === 'SMD'));
});
