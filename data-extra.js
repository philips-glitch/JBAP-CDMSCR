// data-extra.js — [MOCK] sample data for the proposed improvements (P3–P6) and JBAP's wishes 4–5 (spec 2026-10-15). Not from MS Access.
// Loaded after data.js and before app.js. It only adds to window.MOCK_DATA, so data.js stays the Access-merged dataset.
(function (D) {
  if (!D) return;
  // Role titles for the SAAF and Return to Seller forms (titles only, no names)
  Object.assign(D.meta.company.roles, { smdStaff: 'SMD staff', smdManager: 'SMD Manager', fadManager: 'FAD Manager' });
  // [MOCK] Security Bond (JBAP feedback, 15 Oct 2026): sample amount per vehicle until JBAP confirms which sellers bill one and how much (Q44, Q45).
  // INSPIRO bills a bond in JBAP's Security Bond sheet; ORICO and ASIALINK carry one here only so the demo has enough paid lots.
  D.sellers.forEach(s => { if (['INSPIRO', 'ORICO', 'ASIALINK'].includes(s.code)) s.security_bond = 20000; });
  // [MOCK] Access lots keep the amounts Access shows: no bond. V166 (INSPIRO) is a Liability to Seller lot in Access; a bond would put its total 20,000 above Access's SumOfTOTAL.
  D.vehicles.forEach(v => { if (v.id === 'V166') v.security_bond = 0; });
  // [MOCK] Security Bond progress on the paid bond lots: V030 Complete, V050 Pending Refund, V054 Forfeited; V058 and V063 Pending Documents.
  // Waiting ORCR shows once FAD enters Buyer Receipt of Documents for a bond lot in Document Monitoring.
  const bond = { V030: { bond_orcr_jbap: '2026-10-01', bond_orcr_seller: '2026-10-05', bond_refund_jbap: '2026-10-06', bond_refund_buyer: '2026-10-07', bond_refund_via: 'Deposit c/o JBAP' },
    V050: { bond_orcr_jbap: '2026-10-06', bond_orcr_seller: '2026-10-07' },
    V054: { bond_forfeited: '2026-10-07', bond_remarks: 'Sample: buyer did not transfer the ORCR' } };
  D.vehicles.forEach(v => { if (bond[v.id]) Object.assign(v, bond[v.id]); });
  // [MOCK] JBAP 26 Oct 2026: rebates typed by SMD in Result Price, decided by the President. The six Pending Awarding lots that carry a rebate in the Access data show each state:
  // V102 and V095 Approved (FAD can award them), V092 (also SAAF-approved, so pre-ticked with the switch on), V067 and V074 Pending approval (Email BAAF and Save changes hold them back), V082 Rejected (no rebate is given).
  const rebates = {
    V102: { rebate_status: 'Approved', rebate_requested: '2026-08-21', rebate_approved: '2026-08-25' },
    V095: { rebate_status: 'Approved', rebate_requested: '2026-09-25', rebate_approved: '2026-09-28' },
    V092: { rebate_status: 'Pending approval', rebate_requested: '2026-10-02' },
    V067: { rebate_status: 'Pending approval', rebate_requested: '2026-10-07' },
    V074: { rebate_status: 'Pending approval', rebate_requested: '2026-10-08' },
    V082: { rebate_status: 'Rejected', rebate_requested: '2026-10-07', rebate_rejected: '2026-10-08', rebate_reject_reason: 'The rebate is too high for this lot' } };
  D.vehicles.forEach(v => { if (rebates[v.id]) Object.assign(v, rebates[v.id]); });
  // [MOCK] JBAP answer Q14 (20 Oct 2026): holiday list for Settings > Holiday List. Sample list of the fixed-date Philippine holidays of 2025-11 to 2026-12, to be kept by the CDMS administrator (ADMIN role);
  // check it against the official proclamation (moving holidays such as Holy Week and Eid are not listed). Working days skip these dates, both types, as well as weekends.
  D.holidays = [
    { date: '2025-11-01', name: "All Saints' Day", type: 'Special non-working day' },
    { date: '2025-11-30', name: 'Bonifacio Day', type: 'Regular holiday' },
    { date: '2025-12-08', name: 'Feast of the Immaculate Conception', type: 'Special non-working day' },
    { date: '2025-12-25', name: 'Christmas Day', type: 'Regular holiday' },
    { date: '2025-12-30', name: 'Rizal Day', type: 'Regular holiday' },
    { date: '2025-12-31', name: 'Last Day of the Year', type: 'Special non-working day' },
    { date: '2026-01-01', name: "New Year's Day", type: 'Regular holiday' },
    { date: '2026-04-09', name: 'Araw ng Kagitingan', type: 'Regular holiday' },
    { date: '2026-05-01', name: 'Labor Day', type: 'Regular holiday' },
    { date: '2026-06-12', name: 'Independence Day', type: 'Regular holiday' },
    { date: '2026-08-21', name: 'Ninoy Aquino Day', type: 'Special non-working day' },
    { date: '2026-08-31', name: 'National Heroes Day', type: 'Regular holiday' },
    { date: '2026-11-01', name: "All Saints' Day", type: 'Special non-working day' },
    { date: '2026-11-30', name: 'Bonifacio Day', type: 'Regular holiday' },
    { date: '2026-12-08', name: 'Feast of the Immaculate Conception', type: 'Special non-working day' },
    { date: '2026-12-25', name: 'Christmas Day', type: 'Regular holiday' },
    { date: '2026-12-30', name: 'Rizal Day', type: 'Regular holiday' },
    { date: '2026-12-31', name: 'Last Day of the Year', type: 'Special non-working day' },
  ];
  // [MOCK] Q11: SAAF state on Pending Awarding lots: 4 approved by the seller (ready for FAD), 3 sent and awaiting the seller, the rest not sent
  const saaf = { V102: ['2026-08-20', '2026-08-24'], V103: ['2026-08-27', '2026-08-31'], V092: ['2026-09-03', '2026-09-07'], V096: ['2026-09-10', '2026-09-14'],
    V087: ['2026-09-10', null], V097: ['2026-09-10', null], V017: ['2026-09-17', null] };
  D.vehicles.forEach(v => { const s = saaf[v.id]; if (s) { v.saaf_sent = s[0]; v.saaf_approved = s[1]; } });
  // [MOCK] Wish 5: Date of Entry (CDMS Cars > Car List). Inferred: start of the lot's auction minus 7 to 21 days
  const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  D.vehicles.forEach(v => { const a = D.auctions[String(v.auction)]; if (a && !v.entry_date) v.entry_date = addDays(a[0], -(7 + Number(v.id.slice(1)) % 15)); });   // [MOCK] only for lots without a usable date of entry from JBAP's parking inventory
  // [MOCK] JBAP feedback (16 Oct 2026, #19): auction 222 (JBAP's parking file shows A222 lots by 12 Oct) with three unsold units relisted, so Return to Seller leaves them out
  D.auctions['222'] = ['2026-10-12', '2026-10-14'];
  D.vehicles.forEach(v => { if (['V066', 'V070', 'V077'].includes(v.id)) v.next_auction = 222; });
  // [MOCK] JBAP feedback (19 Oct 2026, SMD #2): earlier listings of units now waiting in Return to Seller, so Number of Listing shows more than 1 (JBAP's earlier-auction history is not in CDMS data yet)
  D.vehicles.forEach(v => { const p = { V031: 2, V037: 1, V055: 3, V014: 1 }[v.id]; if (p) v.prior_listings = p; });
  // [MOCK] JBAP feedback (19 Oct 2026, VWD #4b): vehicles captured at inspection, not yet in an auction (the real CDMS takes them from Inspection)
  D.inspectionUnits = [
    { id: 'N001', plate: 'NEW1001', model: 'TOYOTA VIOS 1.3 XLE', color: 'WHITE', year: 2021, seller: 'TFS', parking: 'OPEN PARKING', entry_date: '2026-10-05', source: 'inspection' },
    { id: 'N002', plate: 'NEW1002', model: 'MITSUBISHI MIRAGE G4 GLX', color: 'RED', year: 2020, seller: 'EWB', parking: 'OPEN PARKING', entry_date: '2026-10-06', source: 'inspection' },
    { id: 'N003', plate: 'NEW1003', model: 'NISSAN NAVARA 2.5 EL', color: 'GRAY', year: 2019, seller: 'ORIX', parking: 'OPEN PARKING', entry_date: '2026-10-07', source: 'inspection' },
  ];
})(window.MOCK_DATA);
