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
  // [MOCK] JBAP answer Q14 (20 Oct 2026): holiday list for Master > Holiday List. Sample list of the fixed-date Philippine holidays of 2025-11 to 2026-12, to be kept by the CDMS administrator (ADMIN role);
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
  // [MOCK] JBAP 26 Oct 2026: sales actions (fields are LOGIQUE's proposal). Seven actions on three buyers that are in the data (B9034, and B0313 and B0193 with unpaid lots), 3 Sep to 6 Oct 2026, newest first.
  // SA-6 has a Next Follow-up before the demo date (10/08/2026), so it shows under Follow-up due = Yes. "By" holds sample staff ids, not names.
  D.salesActions = [
    { id: 'SA-7', cid: 'B9034', date: '2026-10-06', action: 'Call', notes: 'Buyer asked when the original documents can be picked up. Told the buyer the DOAS has to be signed first.', follow_up: '2026-10-12', by: 'smd.staff' },
    { id: 'SA-6', cid: 'B0313', date: '2026-10-05', action: 'Email', notes: 'Sent the list of unpaid lots and the payment deadline. Buyer to reply with the proof of payment.', follow_up: '2026-10-07', by: 'smd.staff' },
    { id: 'SA-5', cid: 'B0193', date: '2026-10-02', action: 'Visit', notes: 'Buyer came to the office to pay for two lots and asked about the other unpaid lots.', follow_up: '2026-10-15', by: 'smd.staff' },
    { id: 'SA-4', cid: 'B9034', date: '2026-09-28', action: 'Meeting', notes: 'Met the buyer about the DOAS waiting for signature. The buyer will sign this week.', follow_up: null, by: 'smd.manager' },
    { id: 'SA-3', cid: 'B0313', date: '2026-09-22', action: 'Call', notes: 'Reminded the buyer of the payment deadline for the lots of the last auction.', follow_up: null, by: 'smd.staff' },
    { id: 'SA-2', cid: 'B9034', date: '2026-09-15', action: 'Email', notes: 'Sent the vehicle dispatch form and the pick-up schedule.', follow_up: null, by: 'smd.staff' },
    { id: 'SA-1', cid: 'B9034', date: '2026-09-03', action: 'Call', notes: 'Asked if the buyer will join the next auction. The buyer will check the list of cars first.', follow_up: null, by: 'smd.staff' },
  ];
  // [MOCK] Q11: SAAF state on Pending Awarding lots, one state per auction and seller (27 Oct 2026): Auctions 215, 216 and 217 of EWB approved by the seller (ready for FAD),
  // Auction 218 of SBC (3 lots) sent and awaiting the seller, the rest not sent
  const saaf = { V102: ['2026-08-20', '2026-08-24'], V103: ['2026-08-27', '2026-08-31'], V092: ['2026-09-03', '2026-09-07'],
    V096: ['2026-09-10', null], V087: ['2026-09-10', null], V097: ['2026-09-10', null] };
  D.vehicles.forEach(v => { const s = saaf[v.id]; if (s) { v.saaf_sent = s[0]; v.saaf_approved = s[1]; } });
  // [MOCK] 29 Oct 2026: KYC approved in Auction › Result Price on the lots whose SAAF was sent (the day before) and on four lots ready to send (Auction 219 of SBC: V017, V093, V098; Auction 221 of TFS: V076)
  const kyc = { V102: '2026-08-19', V103: '2026-08-26', V092: '2026-09-02', V096: '2026-09-09', V087: '2026-09-09', V097: '2026-09-09', V017: '2026-10-06', V093: '2026-10-06', V098: '2026-10-06', V076: '2026-10-07' };
  D.vehicles.forEach(v => { if (kyc[v.id]) { v.kyc_status = 'Approved'; v.kyc_approved = kyc[v.id]; } });
  // [MOCK] User request (29 Oct 2026): Auction 221 of EWB has 20 sold lots waiting for the SAAF, 15 with KYC Approved and 5 Pending. Its 2 Access lots (V072, V082) stay Pending;
  // 18 dummy lots are added (V210 to V227, lots 120 to 137, plates XEW1001 to XEW1018), 15 of them KYC Approved on 08 Oct 2026 and 3 Pending. Buyers are dummy (Sample Buyer A to F, D9001 to D9006).
  const ewbModels = ['TOYOTA VIOS 1.3 XLE', 'MITSUBISHI MIRAGE G4 GLX', 'NISSAN ALMERA 1.5 E', 'HONDA CITY 1.5 S', 'TOYOTA INNOVA 2.8 E', 'SUZUKI ERTIGA GL'];
  const ewbColors = ['WHITE', 'SILVER', 'GRAY', 'RED', 'BLACK', 'BLUE'];
  for (let i = 0; i < 18; i++) {
    const n = i + 1, b = i % 6, cid = `D900${b + 1}`;
    D.vehicles.push({ id: `V${210 + i}`, auction: 221, lot: String(120 + i).padStart(3, '0'), plate: `XEW${1000 + n}`, model: ewbModels[i % 6], seller: 'EWB',
      customer: `SAMPLE BUYER ${'ABCDEF'[b]}`, cid, email: `${cid.toLowerCase()}@buyers.example.com`, status: 'Sold', price: 300000 + n * 25000, transfer_fee: 1000, rebate: null,
      vcn: `VCN-221${String(120 + i).padStart(3, '0')}`, for_baaf: false, print_seller: false, print_comm: false, awarding: null, buyer_paid: null, pay_seller: null, seller_ack: null,
      dispatch: null, release: null, rcv_doas: null, buyer_doas: null, seller_doas: null, orig_docs: null, to_buyer: null, rebate_paid: null, billed: false, location: 'Pasay City',
      year: 2018 + (i % 6), color: ewbColors[(i + 2) % 6], fuel: 'Gas', cs_no: `XE${String(n).padStart(4, '0')}`, vrf_no: null, docs_received: [], docs_others: '', atf_no: null,
      for_dispatch_email: false, print_doc_trans: false, ...(i < 15 ? { kyc_status: 'Approved', kyc_approved: '2026-10-08' } : {}) });
  }
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
  // [MOCK] JBAP feedback (26 Oct 2026): Auction › Result Price opens with the lots that can take a rebate (sold, not released, not awarded yet) so JBAP notices the Rebate column; the order is the data's own, the page has no default sort
  D.vehicles.sort((a, b) => { const can = v => v.status === 'Sold' && !v.release && !v.awarding; return can(b) - can(a); });   // stable: each group keeps its order
})(window.MOCK_DATA);
