// data-extra.js — [MOCK] sample data for the proposed improvements (P1–P6) and JBAP's wishes 4–5 (spec 2026-10-15). Not from MS Access.
// Loaded after data.js and before app.js. It only adds to window.MOCK_DATA, so data.js stays the Access-merged dataset.
(function (D) {
  if (!D) return;
  // Role titles for the SAAF and Return to Seller forms (titles only, no names)
  Object.assign(D.meta.company.roles, { smdStaff: 'SMD staff', smdManager: 'SMD Manager', fadManager: 'FAD Manager' });
  // P1: payments CDMS recorded per lot (Unpaid lots). Fully paid: V110, V111, V123, V124, V126 (two parts); partly paid: V108, V121, V122; the rest none
  D.cdmsPayments = {
    V110: [{ date: '2026-09-25', amount: 230400, or_no: 'OR-50101' }],
    V111: [{ date: '2026-09-29', amount: 409000, or_no: 'OR-50102' }],
    V123: [{ date: '2026-10-01', amount: 300400, or_no: 'OR-50103' }],
    V124: [{ date: '2026-10-01', amount: 250900, or_no: 'OR-50104' }],
    V126: [{ date: '2026-09-30', amount: 100000, or_no: 'OR-50105' }, { date: '2026-10-02', amount: 138012, or_no: 'OR-50106' }],
    V108: [{ date: '2026-09-28', amount: 300000, or_no: 'OR-50107' }],
    V121: [{ date: '2026-10-01', amount: 200000, or_no: 'OR-50108' }],
    V122: [{ date: '2026-10-02', amount: 120000, or_no: 'OR-50109' }],
  };
  // [MOCK] P2: lots cancelled in CDMS that FAD has not recorded yet (FAD confirms them on Cancellation Entry)
  D.cdmsCancels = [
    { vid: 'V107', date: '2026-09-29', reason: 'Buyer did not pay within the buyer deadline' },
    { vid: 'V109', date: '2026-09-30', reason: 'Buyer withdrew the bid' },
    { vid: 'V112', date: '2026-10-05', reason: 'Buyer did not pay within the buyer deadline' },
  ];
  // [MOCK] P5: SAAF state on Pending Awarding lots: 4 approved by the seller (ready for FAD), 3 sent and awaiting the seller, the rest not sent
  const saaf = { V102: ['2026-08-20', '2026-08-24'], V103: ['2026-08-27', '2026-08-31'], V092: ['2026-09-03', '2026-09-07'], V096: ['2026-09-10', '2026-09-14'],
    V087: ['2026-09-10', null], V097: ['2026-09-10', null], V017: ['2026-09-17', null] };
  D.vehicles.forEach(v => { const s = saaf[v.id]; if (s) { v.saaf_sent = s[0]; v.saaf_approved = s[1]; } });
})(window.MOCK_DATA);
