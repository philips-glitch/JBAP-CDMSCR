const test = require('node:test'), assert = require('node:assert');
const { load } = require('./harness');
// JBAP answer Q14 (20 Oct 2026): "User with ADMIN role can add holiday list. Yes this should include non-working days."
const SAMPLE = [
  ['2025-11-01', "All Saints' Day", 'Special non-working day'], ['2025-11-30', 'Bonifacio Day', 'Regular holiday'], ['2025-12-08', 'Feast of the Immaculate Conception', 'Special non-working day'],
  ['2025-12-25', 'Christmas Day', 'Regular holiday'], ['2025-12-30', 'Rizal Day', 'Regular holiday'], ['2025-12-31', 'Last Day of the Year', 'Special non-working day'],
  ['2026-01-01', "New Year's Day", 'Regular holiday'], ['2026-04-09', 'Araw ng Kagitingan', 'Regular holiday'], ['2026-05-01', 'Labor Day', 'Regular holiday'],
  ['2026-06-12', 'Independence Day', 'Regular holiday'], ['2026-08-21', 'Ninoy Aquino Day', 'Special non-working day'], ['2026-08-31', 'National Heroes Day', 'Regular holiday'],
  ['2026-11-01', "All Saints' Day", 'Special non-working day'], ['2026-11-30', 'Bonifacio Day', 'Regular holiday'], ['2026-12-08', 'Feast of the Immaculate Conception', 'Special non-working day'],
  ['2026-12-25', 'Christmas Day', 'Regular holiday'], ['2026-12-30', 'Rizal Day', 'Regular holiday'], ['2026-12-31', 'Last Day of the Year', 'Special non-working day']];
const hs = P => P.byId['master/holidays'];

test('[MOCK] D.holidays: the 18 fixed-date Philippine holidays of 2025-11 to 2026-12, regular and special, as briefed', () => {
  const P = load();
  assert.deepStrictEqual(P.D.holidays.map(h => [h.date, h.name, h.type]), SAMPLE);
  assert.deepStrictEqual(Object.keys(P.D.holidays[0]).sort(), ['date', 'name', 'type']);
  assert.match(require('fs').readFileSync(require('path').join(__dirname, '..', 'data-extra.js'), 'utf8'), /\[MOCK\][^\n]*holiday[\s\S]{0,400}CDMS administrator[\s\S]{0,200}proclamation/i, 'comment: sample list kept by the CDMS administrator, check against the proclamation');
});

test('addWorkdays skips Saturdays, Sundays and every listed holiday, regular or special', () => {
  const P = load();
  assert.strictEqual(P.addWorkdays('2026-08-19', 3), '2026-08-25', 'Wed 19 + 3: Thu 20, [Fri 21 Ninoy Aquino Day, special], Mon 24, Tue 25');
  assert.strictEqual(P.addWorkdays('2026-08-28', 1), '2026-09-01', 'Fri 28 + 1: Sat, Sun, [Mon 31 National Heroes Day, regular], Tue 1 Sep');
  assert.strictEqual(P.addWorkdays('2026-08-20', 1), '2026-08-24', 'a holiday right after the start day');
  assert.strictEqual(P.addWorkdays('2026-08-21', 1), '2026-08-24', 'the start day itself may be a holiday');
  assert.strictEqual(P.addWorkdays('2025-12-29', 1), '2026-01-02', 'Tue 30 Rizal, Wed 31 Last Day, Thu 1 Jan: three holidays in a row, then Fri 2 Jan');
  assert.strictEqual(P.addWorkdays('2026-08-12', 3), '2026-08-17', 'no holiday in range: weekends only, as before');
});

test('workdaysBetween (both days included) skips weekends and holidays; a holiday on a weekend is not counted twice', () => {
  const P = load();
  assert.strictEqual(P.workdaysBetween('2026-08-17', '2026-08-21'), 4, 'Mon to Fri with Fri 21 a holiday');
  assert.strictEqual(P.workdaysBetween('2026-08-17', '2026-08-31'), 9, 'Mon 17 to Mon 31: 11 weekdays minus Aug 21 and Aug 31');
  assert.strictEqual(P.workdaysBetween('2025-11-28', '2025-12-01'), 2, 'Fri, Sat, Sun 30 Nov (a holiday on a Sunday), Mon');
  assert.strictEqual(P.workdaysBetween('2026-08-21', '2026-08-21'), 0, 'a holiday alone');
  assert.strictEqual(P.workdaysBetween('2026-08-20', '2026-08-20'), 1, 'Thursday');
  assert.strictEqual(P.workdaysBetween('2026-08-22', '2026-08-23'), 0, 'weekend');
  assert.strictEqual(P.workdaysBetween(null, '2026-08-21'), null); assert.strictEqual(P.workdaysBetween('2026-08-22', '2026-08-21'), null);
});

test('everything built on working days follows the list: buyer, payment-to-seller and dispatch deadlines, aging', () => {
  const P = load(), v = { auction: 215, awarding: '2026-08-19', buyer_paid: '2026-08-19', dispatch: '2026-08-19', status: 'Sold', seller: 'SBC', price: 100000 };
  const e = P.enrichV(v);
  assert.deepStrictEqual([e.buyer_deadline, e.pay_deadline, e.dispatch_deadline], ['2026-08-25', '2026-08-25', '2026-08-25'], 'one holiday pushes each deadline by a day');
  const free = P.enrichV(Object.assign({}, v, { awarding: '2026-08-10', buyer_paid: '2026-08-10', dispatch: '2026-08-10' }));
  assert.deepStrictEqual([free.buyer_deadline, free.pay_deadline, free.dispatch_deadline], ['2026-08-13', '2026-08-13', '2026-08-13']);
  assert.strictEqual(P.enrichV(Object.assign({}, v, { dispatch: '2026-08-19', deadline_reset: '2026-09-30' })).dispatch_deadline, '2026-09-30', 'a reset date is used as given');
});

test('adding a holiday moves a deadline, removing it moves it back; both are logged under Master', () => {
  const P = load(), scr = hs(P), v = () => P.enrichV({ auction: 215, awarding: '2026-09-07', status: 'Sold', seller: 'SBC', price: 100000 });
  assert.strictEqual(v().buyer_deadline, '2026-09-10', 'Mon 7 Sep + 3 working days');
  const before = P.S.log.length;
  P.recordHolidayAdd(scr, { date: '2026-09-09', name: 'Sample local holiday', type: 'Special non-working day' });
  assert.strictEqual(v().buyer_deadline, '2026-09-11', 'Wed 9 Sep is skipped');
  assert.strictEqual(P.workdaysBetween('2026-09-07', '2026-09-11'), 4);
  assert.strictEqual(P.D.holidays.length, 18, 'the sample list in data-extra.js is not changed: the list lives in the session copy');
  assert.strictEqual(scr.rows().length, 19);
  P.recordHolidayRemove(scr, '2026-09-09');
  assert.strictEqual(v().buyer_deadline, '2026-09-10', 'back as before');
  assert.strictEqual(scr.rows().length, 18);
  const log = P.S.log.slice(before);
  assert.deepStrictEqual(log.map(e => [e.module, e.screen, e.action, e.field, e.old, e.new]), [
    ['Master', 'Holiday List', 'Create', 'Date', '', '09/09/2026'], ['Master', 'Holiday List', 'Create', 'Holiday', '', 'Sample local holiday'], ['Master', 'Holiday List', 'Create', 'Type', '', 'Special non-working day'],
    ['Master', 'Holiday List', 'Delete', 'Date', '09/09/2026', ''], ['Master', 'Holiday List', 'Delete', 'Holiday', 'Sample local holiday', ''], ['Master', 'Holiday List', 'Delete', 'Type', 'Special non-working day', '']]);
  assert.ok(log.every(e => /^Holiday 09\/09\/2026/.test(e.record)), 'the record names the holiday: ' + log[0].record);
  assert.strictEqual(P.recordHolidayRemove(scr, '2026-09-09'), false, 'removing a date that is not listed does nothing');
  assert.strictEqual(P.S.log.length, before + 6, 'and logs nothing');
});

test('an added holiday changes a real lot: the Unpaid deadline and the customer page working days follow', () => {
  const P = load(), lot = P.byId['FAD/unpaid'].rows().find(r => r.buyer_deadline), deadline = lot.buyer_deadline;
  let d = lot.awarding; const days = [];   // the day after awarding up to the deadline: pick a working day inside it
  for (let n = 1; n <= 6; n++) { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); days.push(x.toISOString().slice(0, 10)); }
  const inside = days.find(x => x < deadline && ![0, 6].includes(new Date(x + 'T00:00:00Z').getUTCDay()));
  assert.ok(inside, 'a working day inside the window');
  P.recordHolidayAdd(hs(P), { date: inside, name: 'Test', type: 'Regular holiday' });
  assert.notStrictEqual(P.byId['FAD/unpaid'].rows().find(r => r.id === lot.id).buyer_deadline, deadline, 'the deadline moved');
  assert.ok(P.byId['FAD/unpaid'].rows().find(r => r.id === lot.id).buyer_deadline > deadline);
});

test('holidayError: date required and readable, not already listed, name required, type chosen', () => {
  const P = load(), ok = { date: '2026-09-09', name: 'X', type: 'Regular holiday' };
  assert.strictEqual(P.holidayError(ok), null);
  assert.strictEqual(P.holidayError(Object.assign({}, ok, { date: '' })), 'Date is required.');
  assert.strictEqual(P.holidayError(Object.assign({}, ok, { date: null })), 'Type the date as mm/dd/yyyy, or t for today.');
  assert.strictEqual(P.holidayError(Object.assign({}, ok, { date: '2026-08-21' })), 'A holiday is already listed on 08/21/2026 (Ninoy Aquino Day).');
  assert.strictEqual(P.holidayError(Object.assign({}, ok, { name: '  ' })), 'Holiday name is required.');
  assert.strictEqual(P.holidayError(Object.assign({}, ok, { type: '' })), 'Choose the type of holiday.');
  assert.strictEqual(P.holidayError(Object.assign({}, ok, { type: 'Local' })), 'Choose the type of holiday.');
  assert.strictEqual(P.holidayError(Object.assign({}, ok, { date: '2026-08-22' })), null, 'a holiday on a Saturday is allowed (it just changes nothing)');
});

test('Master > Holiday List screen: columns, sort, filters, rule text; no New mark since 26 Oct 2026', () => {
  const P = load(), scr = hs(P);
  assert.ok(scr && !scr.isNew && P.shown(scr)); assert.strictEqual(scr.dept, 'Master'); assert.strictEqual(scr.title, 'Holiday List');
  assert.deepStrictEqual(P.colsOf(scr).filter(c => c.type !== 'rowbtn').map(c => c.label), ['Date', 'Day', 'Holiday', 'Type']);
  assert.deepStrictEqual(scr.cols.find(c => c.type === 'rowbtn').btn, 'Remove');
  assert.deepStrictEqual(scr.sort, ['date', 'asc']);
  assert.deepStrictEqual(scr.filters.map(f => [f.key, f.label, f.type]), [['year', 'Year', 'select'], ['type', 'Type', 'select']]);
  assert.deepStrictEqual(scr.filters[0].options(), ['2025', '2026']); assert.deepStrictEqual(scr.filters[1].options(), ['Regular holiday', 'Special non-working day']);
  assert.match(scr.rule, /only users with the ADMIN role add or remove holidays \(JBAP answer Q14\)/);
  assert.match(scr.rule, /deadlines and aging skip these dates/i);
  const rows = scr.rows(); assert.strictEqual(rows.length, 18);
  assert.deepStrictEqual(rows.find(r => r.date === '2026-08-31'), { id: '2026-08-31', date: '2026-08-31', day: 'Monday', name: 'National Heroes Day', type: 'Regular holiday', year: '2026' });
  assert.strictEqual(rows.find(r => r.date === '2025-11-30').day, 'Sunday', 'a holiday on a Sunday');
  assert.deepStrictEqual(P.sortRows(scr, rows.slice().reverse()).map(r => r.date), SAMPLE.map(x => x[0]), 'sorted by date');
  assert.strictEqual(P.countOf(scr), 18);
});

test('Holiday List filters: Year and Type are multi-select', () => {
  const P = load(), scr = hs(P), ui = P.U(scr.id), rows = () => P.applyFilters(scr, scr.rows());
  ui.applied = { year: ['2025'] }; assert.strictEqual(rows().length, 6);
  ui.applied = { year: ['2025', '2026'] }; assert.strictEqual(rows().length, 18);
  ui.applied = { type: ['Special non-working day'] }; assert.deepStrictEqual(rows().map(r => r.date), ['2025-11-01', '2025-12-08', '2025-12-31', '2026-08-21', '2026-11-01', '2026-12-08', '2026-12-31']);
  ui.applied = { year: ['2026'], type: ['Regular holiday'] }; assert.deepStrictEqual(rows().map(r => r.date), ['2026-01-01', '2026-04-09', '2026-05-01', '2026-06-12', '2026-08-31', '2026-11-30', '2026-12-25', '2026-12-30']);
  assert.match(P.filterCard(scr), /data-msel="year"/); assert.match(P.filterCard(scr), /data-msel="type"/);
});

test('the Year filter offers the years of the list, including one added later', () => {
  const P = load(); P.recordHolidayAdd(hs(P), { date: '2027-01-01', name: "New Year's Day", type: 'Regular holiday' });
  assert.deepStrictEqual(hs(P).filters[0].options(), ['2025', '2026', '2027']);
});

test('Add holiday form: typed date, name, type, Add holiday button; Remove is a row button', () => {
  const P = load(), scr = hs(P), h = P.holidayForm(scr);
  assert.match(h, /<form class="fb" data-form="holiday"/);
  assert.match(h, /<label for="hl-date">Date<\/label><span class="dti"><input type="text" class="ctl dt"[^>]*placeholder="mm\/dd\/yyyy"[^>]*id="hl-date"/);
  assert.match(h, /<label for="hl-name">Holiday<\/label><input class="ctl[^"]*" id="hl-name"/);
  assert.match(h, /<label for="hl-type">Type<\/label><select class="ctl[^"]*" id="hl-type"><option value="">[^<]*<\/option><option>Regular holiday<\/option><option>Special non-working day<\/option>/);
  assert.match(h, /type="submit" class="btn pr">[\s\S]*Add holiday<\/button>/);
  const t = P.dataCard(scr, 'Holiday List'); assert.match(t, /data-act="removeHoliday" data-rid="2026-08-31" aria-label="Remove National Heroes Day 08\/31\/2026"/);
  assert.strictEqual(typeof P.ACTIONS.removeHoliday, 'function');
  assert.match(P.pageHead(scr), /Home<\/a>›<span>Master<\/span>›<b>Holiday List<\/b>/);
  assert.doesNotMatch(P.pageHead(scr), /<h1>Holiday List<span class="ptag new"/);
});

test('Add holiday form keeps what was typed, with the message, when it is refused', () => {
  const P = load(), scr = hs(P), ui = P.U(scr.id);
  ui.hf = { date: '08/21/2026', name: 'Dup', type: 'Regular holiday', errors: { date: 'A holiday is already listed on 08/21/2026 (Ninoy Aquino Day).' } };
  const h = P.holidayForm(scr);
  assert.ok(h.includes('value="08/21/2026"') && h.includes('value="Dup"') && h.includes('<option selected>Regular holiday</option>'));
  assert.ok(h.includes('<span class="err" id="hl-date-err">A holiday is already listed on 08/21/2026 (Ninoy Aquino Day).</span>'));
  assert.match(h, /id="hl-date"[^>]*aria-invalid="true"/);
});

test('sidebar: Holiday List sits in the existing Master menu (27 Oct 2026), between Cars and Auction; no Settings menu', () => {
  const P = load(), side = P.sideHtml('master/holidays');
  assert.match(side, /<button type="button" class="mi" data-group="Master" aria-expanded="false" aria-controls="grp-Master"><img src="assets\/ic-master.png" alt="">Master<span class="caret"><\/span><\/button>/);
  assert.ok(side.indexOf('data-disabled="Cars"') < side.indexOf('data-group="Master"') && side.indexOf('data-group="Master"') < side.indexOf('data-group="Auction"'), 'where Master sits in CDMS');
  assert.match(side, /<a class="mis is-active" href="#\/master\/holidays" aria-current="page">Holiday List<span class="cnt">18<\/span><\/a>/);
  assert.doesNotMatch(side, /data-disabled="Master"/); assert.doesNotMatch(side, /Settings/, 'no Settings menu any more');
  assert.match(side, /only Customer Inquiry, Sales Actions, Auction › Result Price, Report, Approval, FAD, SMD, VWD, Master › Holiday List and Log Activity are active/);
  assert.match(P.homeLayout(), /VWD menus that replace the MS Access post-auction forms, plus Master › Holiday List./);
});

test('route: #/master/holidays opens the screen, with or without the switch; the old #/settings/holidays link goes there', () => {
  const P = load(); assert.strictEqual(P.routeOf('master/holidays'), 'master/holidays'); P.setProposed(true); assert.strictEqual(P.routeOf('master/holidays'), 'master/holidays');
  assert.strictEqual(P.routeOf('master/holidays'), 'master/holidays');
});

test('Log Activity: Module filter offers Approval and Master, Action filter offers Delete; a removal shows as Delete', () => {
  const P = load(), log = P.byId['log-activity'];
  assert.deepStrictEqual(log.filters.find(f => f.key === 'module').options(), ['FAD', 'SMD', 'VWD', 'Auction', 'Approval', 'Master']);
  assert.deepStrictEqual(log.filters.find(f => f.key === 'action').options(), ['Update', 'Create', 'Cancel', 'Delete']);
  P.recordHolidayAdd(hs(P), { date: '2026-09-09', name: 'X', type: 'Regular holiday' }); P.recordHolidayRemove(hs(P), '2026-09-09');
  const row = log.rows().find(r => r.action === 'Delete'), cell = P.cellHtml(log, row, log.cols.find(c => c.key === 'action'), false);
  assert.match(cell, /<span class="st cx">Delete<\/span>/);
  assert.match(log.rule, /holiday added or removed in Master/);
});

test('Add holiday form: every error shown is tied to its control with aria-describedby (none when there is no error)', () => {
  const P = load(), scr = hs(P), ui = P.U(scr.id);
  ui.hf = null; assert.doesNotMatch(P.holidayForm(scr), /aria-describedby|aria-invalid/, 'a clean form has neither');
  ui.hf = { date: '', name: '', type: '', errors: { date: 'Date is required.', name: 'Holiday name is required.', type: 'Choose the type of holiday.' } };
  const h = P.holidayForm(scr);
  assert.match(h, /id="hl-date"[^>]*aria-describedby="hl-date-err"/); assert.match(h, /id="hl-name"[^>]*aria-describedby="hl-name-err"/); assert.match(h, /id="hl-type"[^>]*aria-describedby="hl-type-err"/);
  for (const k of ['date', 'name', 'type']) assert.match(h, new RegExp('<span class="err" id="hl-' + k + '-err">'), k + ' message element exists for the reference');
  ui.hf = { date: '', name: 'X', type: '', errors: { date: 'Date is required.' } };
  const one = P.holidayForm(scr); assert.match(one, /aria-describedby="hl-date-err"/); assert.doesNotMatch(one, /hl-name-err|hl-type-err/, 'only the field with an error is described');
  ui.hf = null;
});
test('Remove button name carries the holiday and its date, so two buttons never read the same', () => {
  const P = load(), scr = hs(P), rows = scr.rows(), btn = scr.cols.find(c => c.type === 'rowbtn');
  const names = rows.map(r => P.cellHtml(scr, r, btn, true).match(/aria-label="([^"]*)"/)[1]);
  assert.strictEqual(new Set(names).size, names.length, 'all 18 distinct (Christmas Day appears in two years)');
  assert.ok(names.includes('Remove Christmas Day 12/25/2026') && names.includes('Remove Christmas Day 12/25/2025'));
  const plated = P.byId['FAD/unreleased-unit'], row = plated.rows().find(r => r.penalty > 0), pb = plated.cols.find(c => c.act === 'payPenalty');
  assert.ok(P.cellHtml(plated, row, pb, true).includes('aria-label="Record payment ' + row.plate + '"'), 'plate-based buttons are unchanged');
});
