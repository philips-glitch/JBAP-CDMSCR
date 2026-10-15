// data-extra.js — [MOCK] sample data for the proposed improvements (P2–P6) and JBAP's wishes 4–5 (spec 2026-10-15). Not from MS Access.
// Loaded after data.js and before app.js. It only adds to window.MOCK_DATA, so data.js stays the Access-merged dataset.
(function (D) {
  if (!D) return;
  // Role titles for the SAAF and Return to Seller forms (titles only, no names)
  Object.assign(D.meta.company.roles, { smdStaff: 'SMD staff', smdManager: 'SMD Manager', fadManager: 'FAD Manager' });
  // [MOCK] Security Bond (JBAP feedback, 15 Oct 2026): sample amount per vehicle until JBAP confirms which sellers bill one and how much (Q44, Q45).
  // INSPIRO bills a bond in JBAP's Security Bond sheet; ORICO and ASIALINK carry one here only so the demo has enough paid lots.
  D.sellers.forEach(s => { if (['INSPIRO', 'ORICO', 'ASIALINK'].includes(s.code)) s.security_bond = 20000; });
  // [MOCK] Security Bond progress on the paid bond lots: V166 Complete, V030 Pending Refund, V054 Forfeited; V050, V058 and V063 Pending Documents.
  // Waiting ORCR shows once FAD enters Buyer Receipt of Documents for a bond lot in Document Monitoring.
  const bond = { V166: { bond_orcr_jbap: '2026-03-02', bond_orcr_seller: '2026-03-09', bond_refund_jbap: '2026-03-20', bond_refund_buyer: '2026-03-24', bond_refund_via: 'Deposit c/o JBAP' },
    V030: { bond_orcr_jbap: '2026-10-01', bond_orcr_seller: '2026-10-05' },
    V054: { bond_forfeited: '2026-10-07', bond_remarks: 'Sample: buyer did not transfer the ORCR' } };
  D.vehicles.forEach(v => { if (bond[v.id]) Object.assign(v, bond[v.id]); });
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
  // [MOCK] Wish 5: Date of Entry (CDMS Cars > Car List). Inferred: start of the lot's auction minus 7 to 21 days
  const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  D.vehicles.forEach(v => { const a = D.auctions[String(v.auction)]; if (a) v.entry_date = addDays(a[0], -(7 + Number(v.id.slice(1)) % 15)); });
})(window.MOCK_DATA);
