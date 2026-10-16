# Prototype: CDMS Post-Auction Menus (Customer Inquiry, Report, FAD, SMD, VWD), JBA Philippines

> **Generated**: 2026-10-09 via /logique-b1-prototyping; updated 2026-10-16 for JBAP's feedback of 16 Oct 2026 (items 1 to 23 and Customer Transaction History)
> **Scope**: Clickable to-be prototype of the new FAD, SMD and VWD menus in CDMS (plus Customer Inquiry and Report) that replace the MS Access post-auction forms (frmFAD, frmSMD, frmVWD). Built from the approved screen designs and the CR form.
> **Status**: Prototype, not production code

## How to open

**Double-click `index.html`.** That's it: no server and no setup needed.

The prototype is plain HTML, CSS and JavaScript. Data sits in `data.js` and is loaded with a `<script>` tag, so it works straight from the folder (no `fetch()`). `xlsx.js` is a small built-in Excel writer for downloadable reports (no library).

Sample data for the proposed improvements and the wish-list screens sits in `data-extra.js` (loaded right after `data.js`). The header switch **Proposed improvements** turns on LOGIQUE's proposals P2 to P6 (P1 was withdrawn after JBAP's feedback of 15 Oct 2026: JBAP keeps the Access format for Buyer Paid); a link ending in `?proposed=1` (for example `index.html?proposed=1`) opens with it on.

**Works in** Chrome, Edge, Firefox and Safari on Windows, macOS or Linux. If double-click does not open a browser: right-click `index.html` > Open With > choose a browser.

## What is clickable

- **Only Customer › Customer Inquiry, Report, FAD, SMD, VWD and Log Activity are active.** All other CDMS menus (Dashboard, Customer › Sales Actions, Cars, Payment, etc.) are disabled and show a short message when clicked.
- **34 screens**: Customer Inquiry 1, Report 2, FAD 16, SMD 9, VWD 5, Log Activity 1 (last item in the sidebar, below Staff), plus a Home page (cards for FAD, SMD, VWD and Report, with counts per list) and a customer page per buyer. FAD's **Commission Billing**, **Billing Monitoring** and **Unpaid Billing** are three tabs of one **Billing** menu entry, and **Rebate Monitoring** and **Rebate Payable** are two tabs of one **Rebate** menu entry. The SMD **Seller Awarding Acknowledgement** screen shows only with the **Proposed improvements** switch on (33 screens with it off). **Report** holds **Result Summary** and **Auction Monitoring**, which left FAD and SMD (JBAP, 16 Oct 2026); old links to the moved screens still work and open the new screen.
- Every menu item in the sidebar shows its **number of records** (FAD › Billing and FAD › Rebate show a count on each of their tabs instead; with the Proposed improvements switch on, the P6 badges replace the number; Log Activity has none).
- Every list has working **filters, column sorting, page size and paging**, an empty state, and totals where the design has them.
- **Dates can be typed** in every editable date cell and in the date fields of forms: `10/07/2026`, `10/07/26`, `10/07`, `1007`, `2026-10-07`, or **`t` for today** (the demo date). The calendar button next to the date still opens the date picker. A date that cannot be read stays in the box, turns red and is reported when you save. Filter date ranges keep the browser's picker.

## Flow walkthrough (FAD, data flows between lists and into VWD)

1. **Pending Awarding**: tick *For BAAF* on 1 or more lots (optionally change Awarding Date, Transfer Fees or Security Bond) > **Email BAAF** > preview one email per buyer > **Send**. Lots move to **Unpaid**.
2. **Unpaid**: enter *Buyer Paid* (type `t` for today, the demo date, or use the calendar button; the row is marked unsaved) > **Save changes**. Lot moves to **Payment Seller**. Try a future date, or `13/45`, to see validation.
3. **Payment Seller**: tick *Print Payment to Seller* > **Print payment to seller** (report per seller). Enter *Payment to Seller Date* > **Save**. Lot moves to **Seller Acknowledgement** and **Billing › Commission Billing**.
4. **Seller Acknowledgement**: enter the date and save. **For Dispatch** lists lots whose seller condition is met (Buyer Payment / DOAS sellers after Buyer Paid, others after Seller Acknowledgement): enter the date and save. **Document Monitoring** (JBAP's Documents Monitoring columns): enter the EWB, DOAS and document dates; Status and the two aging columns update by themselves, and the Open view hides Complete and Cancelled lots. Dispatched lots appear in **Unreleased Unit** (FAD) and in VWD **Unreleased Unit / Unreleased Unit (Overdue)**. VWD can then click **Release vehicle** on a row (see *Reports and emails*). A lot with a storage penalty cannot be released: on FAD **Unreleased Unit** press **Record payment** (optional Reference / OR No.). The payment is recorded as paid today, the dispatch deadline becomes today, the lot leaves VWD *Unreleased Unit (Overdue)* and can be released (JBAP, 16 Oct 2026, #9).
5. **Billing › Commission Billing**: tick *Print?* for lots of **one seller** > **Print commission billing** > enter NOAH Billing No. and date > **Record billing & print**. A new billing appears in the *Billing Monitoring* and *Unpaid Billing* tabs.
6. **Billing › Unpaid Billing**: enter Payment Date + Collection Receipt > **Save**.
7. **Cancellation Entry**: enter an Auction No. and Lot (tip: copy one from Unpaid) > **Find** > set Status to *Cancelled*, date, waiver and reason > **Cancel transaction**. The list under the form shows every cancellation (filters: Auction No., Customer Name / Buyer ID, Plate Number, Waived) with its billing and payment dates. If the fee is not waived, the lot also appears in **Cancellation Billing & Payment**: tick *For Print?* > **Print cancellation billing**, then enter *Date Paid* (Amount is filled in) > **Save**; paid lots leave that list. Cancellation Monitoring and Cancellation Payment no longer exist (JBAP, 16 Oct 2026, #13, #14).
8. **Rebate › Rebate Payable**: enter *Rebate Paid* > **Save**. **Rebate › Rebate Monitoring** > **Download report**: pick From and To auction > **Download .xlsx**. **Liability to Seller**: pick a date > **Generate**.
9. **Log Activity**: every change from steps 1 to 8 (including *Penalty Paid* and the new dispatch deadline), every VWD release or return and every SMD Return to Seller clearance appears here as user `system`, one row per changed field with the old and new value (newest first). Filter by date, user, module, action or record/plate. Prints and emails that record a value (Awarding Date, Billing #, Transmittal Date, Dispatch Date, cancellation billing date and amount, vehicle release with type and checklist, documents received with Others/Remarks and ATF No.) are logged; previews that change nothing and *Generate* are not.
10. **Return to Seller** (SMD, wish 4): the list holds units with status *Not Sold* or *Cancelled* that are **not listed in an ongoing or future auction** (JBAP, 16 Oct 2026, #19; 17 units in the sample). Tick *For Return* > **Print & email clearance form** > **Send & print**. The units move to VWD **For Return to Seller** > **Release vehicle** (type *Return to Seller*). Sample: [MOCK] auction 222 (12 to 14 Oct 2026) holds three relisted units, which stay off the list.
11. **Inventory Monitoring** (VWD; SMD has the same list as *Inventory*; wish 5, JBAP 16 Oct 2026, #2, #20, #23): one row per vehicle in the columns of JBAP's *2026 Open & IMET Parking Inventory* file (Date of Entry, VCN, Plate Number, CS No., Make/Model, Color, Year, Seller, Logistics, Originating Warehouse, Parking Location, Transfer Date, Auction Status, Inventory Status, Released to Buyer, Returned to Seller, Returned to Seller WH, Days in Yard). Filter *In yard / Out*, *Auction Status*, *Inventory Status*, *Seller*, *Parking Location*, *Latest auction* or *Plate Number*. **View only** for SMD and VWD: *Inventory Status* is always calculated, in this order: Listed, Awarded (sold), **For Release** (dispatched, waiting for the buyer's pull-out), **For Return** (cleared by SMD), Released, Returned (Q71, Q72). VWD Auction Monitoring no longer exists.
12. **Security Bond** (FAD, JBAP feedback of 15 Oct 2026): lots with a bond appear once paid. Enter the ORCR and refund dates, Refund Via, or Forfeited. Tip: enter JBAP Receipt of Documents and Buyer Receipt of Documents for Auction 220, Lot 119 (plate NYL9684) in Document Monitoring, any date from 10/04 to 10/08/2026, to see *Waiting ORCR*.
13. **Report** (JBAP, 16 Oct 2026, #1): **Result Summary** (Access snapshot, auctions 197 to 220) and **Auction Monitoring** (live lots, with totals). View, filter, sort only.
14. **Customer Inquiry**: click a buyer to open the customer page. Its lot tabs are *Sold*, *Pending Awarding*, *Unpaid*, **Pending DOAS signature** (Receipt of DOAS filled, signed DOAS not back yet), **Documents for release** (JBAP has the documents, the buyer does not yet) and *Cancellation* (JBAP, 16 Oct 2026; Q81, Q82).
15. **Proposed improvements**: turn on the switch in the header (see *Proposed improvements* below).

## Reports and emails (layouts of the MS Access samples, 12 Oct 2026)

| Access report | Where | What it records |
|---|---|---|
| JBAP_AWARDING + qryRebatePrint | Pending Awarding › Email BAAF (attachments in the email preview) | Awarding Date |
| qryPAYMENTSELLERPrint | Payment Seller › Print payment to seller | – |
| qryBillingSeller | Billing › Commission Billing › Print commission billing | Billing # and date |
| BILLING TRANSMITTAL | Billing › Billing Monitoring › Print Transmittal? › Print billing transmittal | Transmittal Date |
| VEHICLE_DISPATCH (email + form) | For Dispatch › For Dispatch Email? › Email dispatch form | Dispatch Date |
| rptVehiclerelease (release form + gate pass) | VWD Unreleased Unit / Overdue › Release vehicle; VWD For Return to Seller › Release vehicle (type Return to Seller) | Release date, VRF No. |
| Penalty payment (no Access report; entered on screen) | FAD Unreleased Unit › Record payment | Penalty paid (today, amount due, optional OR / reference no.) and the new dispatch deadline |
| rptCancellationPenalty | Cancellation Billing & Payment › Print cancellation billing (one letter per buyer) | Billing date, amount due |
| DocumentTransmittalPrint | Document Monitoring › Print Transmittal? › Print document transmittal | Documents received, ATF control no. |
| Rebate Monitoring (JBAP's Excel file) | Rebate › Rebate Monitoring › Download report (an .xlsx file, auction range) | Nothing: download only |
| SAAF (proposed P5; layout to be confirmed, no Access sample) | SMD Seller Awarding Acknowledgement › For SAAF › Email SAAF (switch on) | SAAF Sent |
| Vehicle Dispatch Clearance Form (Return to Seller), wish 4 | SMD Return to Seller › For Return › Print & email clearance form | Return Clearance Date |

Reports print role titles and a placeholder bank account, not JBAP's staff names or account number. Print or save as PDF with the browser's print dialog.

## Proposed improvements (switch in the header)

With the switch **off**, every screen works as the CR form describes. With it **on**, LOGIQUE's proposals P2 to P6 appear; each changed column, button or screen is tagged "Proposed P#", and Home lists them with a link to each screen. The proposal document for JBAP describes the same items.

| Item | Where | What changes |
|---|---|---|
| P1 | — | **Withdrawn** (JBAP feedback, 15 Oct 2026): JBAP keeps the Access format, so FAD types Buyer Paid once on Unpaid |
| P2 | Cancellation Entry | Lots cancelled in CDMS wait at the top; add the waiver decision and **Confirm** |
| P3 | Commission Billing, Unpaid Billing, Payment Seller | NOAH numbers stay typed for now; JBAP's existing NOAH integration will be re-routed from Access to CDMS; optional *Payment Voucher No.* on Payment Seller |
| P4 | Pending Awarding, Payment Seller, Commission Billing, Billing Monitoring, For Dispatch, Document Monitoring, Cancellation Billing & Payment (unbilled lots only) | Ready lots arrive pre-ticked (untick to hold back; the untick survives Save); Commission Billing records one billing per seller in one go |
| P5 | SMD Seller Awarding Acknowledgement, Pending Awarding, For Dispatch | SMD emails the SAAF (placeholder layout) and records the seller's approval; approved lots are pre-ticked for BAAF; the dispatch email is copied to Finance only |
| P6 | Menu, Home | Counts of ready and overdue lots on each work list; *Waiting for you* on Home |

## JBAP feedback, 15 Oct 2026

| Change | Where | What it does |
|---|---|---|
| Document Monitoring on JBAP's sheet | FAD › Document Monitoring | JBAP's columns: Seller Payment, EWB Call Out, Date DOAS Signed (EWB), EWB HO/Store, Receipt of DOAS, DOAS Aging, JBAP Receipt of Signed DOAS, Seller Receipt of Signed DOAS, JBAP Receipt of Documents, Buyer Receipt of Documents, Docs Aging, Status, Remarks. Every sold or cancelled lot, TFS included. Status is the furthest step reached; aging counts working days while a step waits. EWB columns apply to EWB only; DOAS columns show n/a for TFS and TFSPH |
| DOAS signing per seller | Seller settings | `doas_signing`: at JBAP (default), at the seller's branch (EWB), none (sellers released on Buyer Payment) |
| Security Bond billing | Pending Awarding, BAAF, Unpaid, Payment Seller, Liability to Seller | Seller setting `security_bond` (sample: PHP 20,000 for INSPIRO, ORICO, ASIALINK), editable per lot; on the BAAF only when a lot has one; inside *Notarial / Transfer / Bond* and Payable to Seller. Only INSPIRO bills a bond in JBAP's sheet; ORICO and ASIALINK carry a sample bond for the demo. Access lots keep their Access amounts (no bond) |
| Security Bond monitor | FAD › Security Bond (Wish list) | ORCR transfer, refund (with Refund Via), forfeiture; status worked out from the dates; Open view hides Complete and Forfeited |
| Billing menu | FAD › Billing | Commission Billing, Billing Monitoring and Unpaid Billing as three tabs of one menu entry (Commission Billing first) |
| Rebate menu | FAD › Rebate | Rebate Monitoring and Rebate Payable as two tabs of one menu entry (SMD keeps its own Rebate Monitoring) |
| Inventory status | VWD › Inventory | **Replaced on 16 Oct 2026**: it was Released, Returned, Listed, Awarded or For Return, suggested from the lot, and VWD could change it while the unit was in the yard (Q57). Inventory is now view only and the status is calculated (see JBAP feedback, 16 Oct 2026) |
| Rebate Monitoring columns | FAD › Rebate › Rebate Monitoring | The key columns of JBAP's Rebate Monitoring file: Auction No., Lot, Plate Number, Make/Model, Seller, Buyer, Minimum Bid, Highest Offer, Rebate, Commission, Revenue (Net of Rebate), Date Remitted, with a totals row (lots, Rebate, Commission, Revenue). Same figures as the download; blank when a lot has no result price (17 of the 44 sample lots from Access). SMD's Rebate Monitoring keeps its Access columns |
| Rebate report | FAD › Rebate › Rebate Monitoring | **Download report** saves an Excel file of the rebates in an auction range, laid out like JBAP's Rebate Monitoring file: Month, Auction No., Lot, VCN, Year, Brand, Model, Color, Seller, Minimum Bid, Highest Offer, Awarded Price, Buyer ID, Buyer, Rebate, Date Remitted to Buyer, Commission, Revenue (Net of Rebate), with SUM totals. CDMS keeps no minimum bid or highest offer, so Minimum Bid = Awarded Price and Highest Offer = Awarded Price − Rebate, as in JBAP's file; Revenue = Commission − Rebate. Left out because CDMS has no data for them: Open House, ONOF, transmission, mileage, condition grades, start price (Q64, Q65) |

## JBAP feedback, 16 Oct 2026 (round 2)

Item numbers are those of JBAP's feedback. Qn = our question to JBAP (Q69 to Q82); nothing JBAP left unclear was built.

| Change | Where | What it does |
|---|---|---|
| Report menu (#1) | Sidebar › Report | **Result Summary** and **Auction Monitoring** (the FAD versions) moved to a new Report menu and left FAD and SMD. Old links (`#/FAD/result-summary`, `#/SMD/auction-monitoring` …) open the new screen and the address bar shows the new link. Cancellation Monitoring did not move: see #14 and Q69 |
| Inventory Monitoring (#2, #20, #23) | VWD › Inventory Monitoring, SMD › Inventory | VWD Auction Monitoring is gone. Inventory is in the columns of JBAP's parking inventory file; **view only** for SMD and VWD; Inventory Status includes **For Release** and **For Return** and is always calculated (Q70, Q71, Q72). This reverses the 15 Oct decision that VWD can change the status |
| Record counts (#3) | Sidebar, Home | Every menu item shows its number of records; Billing and Rebate show one count on each tab |
| Typed dates (#4) | Every editable date cell and form date field | Type `10/07/2026`, `10/07`, `1007` or `t` (today, the demo date); a calendar button still opens the picker; an unreadable date turns red and Save reports it |
| Transfer fees read-only (#5) | FAD › Pending Awarding | Transfer Fees always come from the seller parameters and cannot be changed per lot (Q78) |
| Seller codes and Auction No. (#5 to #10, #12, #15 to #18, #21, #22) | Pending Awarding, Seller Acknowledgement, For Dispatch, Payment Seller, Unreleased Unit, Liability to Seller, Cancellation Entry, and the SMD and VWD versions | *Seller* shows the code (TFS, EWB …) and *Auction Date* is replaced by **Auction No.** where JBAP asked. FAD Pending Awarding already showed the code (Q79: TFS and TFSPH). The SMD snapshot rows get their code and auction number from the seller name and the auction's date range |
| Penalty payment (#9) | FAD › Unreleased Unit › Record payment | Records the penalty paid today (amount due, optional OR / reference no.) in the Activity Log and sets the dispatch deadline to today; the lot leaves VWD *Unreleased Unit (Overdue)* and the penalty no longer blocks the release. Deadline extension and partial payment are not built (Q74, Q75) |
| Commission Billing (#13) | FAD › Billing › Commission Billing | Adds the Seller (code) and the Auction Date columns (Q80: Auction Date or Auction No.) |
| Cancellation Billing & Payment (#13) | FAD › Cancellation Billing & Payment | One screen: tick and print to bill, then enter Date Paid; paid lots leave the list. Replaces Cancellation Billing and Cancellation Payment |
| Cancellation Entry list (#14) | FAD › Cancellation Entry | The list under the form is the monitoring list: every cancellation with filters (Auction No., Customer Name / Buyer ID, Plate Number, Waived) and its billing and payment dates. Cancellation Monitoring is removed from FAD and SMD, so SMD has no cancellation view until JBAP answers Q69 |
| Return to Seller (#19) | SMD › Return to Seller | Units with status Not Sold or Cancelled that are not listed in an ongoing or future auction: the lot's own auction has not ended, or its *next auction* has not ended (Q77). Approval by the SMD and FAD Managers is a question (Q76), not built |
| Customer page tabs | Customer › open a buyer | **Pending DOAS signature** (Receipt of DOAS filled, JBAP Receipt of Signed DOAS blank) and **Documents for release** (JBAP Receipt of Documents filled, Buyer Receipt of Documents blank). Sales action notes are a question (Q81, Q82) |
| Already possible (answer only) | FAD › Pending Awarding, For Dispatch, Rebate | One email per buyer when several buyers are ticked (BAAF, dispatch form); the rebate payment is entered in Rebate › Rebate Payable (#5, #8, #11). Where the rebate is entered is Q73 |

## Access per menu

| Menu | Access in this prototype |
|------|--------------------------|
| Report | **Result Summary** and **Auction Monitoring**: view, filter, sort. Result Summary is the Access snapshot; Auction Monitoring uses the live lots |
| FAD | View, filter, sort; update on the screens marked *Update* (CR form). **Cancellation Entry** (cancel and the list of every cancellation), **Cancellation Billing & Payment** (print to bill, Date Paid) and **Unreleased Unit** (Record payment of a penalty) also update. No Result Summary, Auction Monitoring or Cancellation Monitoring any more |
| SMD | View, filter, sort. Shows the **legacy SMD sample data** (snapshot), so FAD actions do not change those lists. Live data on three screens: **Return to Seller** (update: clearance form, wish 4), **Inventory** (**view only**, wish 5) and, with the switch on, **Seller Awarding Acknowledgement** (update: SAAF, P5). No Result Summary or Auction Monitoring (both moved to Report) and no Cancellation Monitoring (removed) |
| VWD | View, filter, sort; **Release vehicle** on Unreleased Unit and Unreleased Unit (Overdue) (JBAP Q9). Blocked when a DOAS seller's lot has no signed DOAS (*JBAP Receipt of Signed DOAS* or *Seller Receipt of Signed DOAS*; EWB: *Date DOAS Signed (EWB)*) or a storage penalty is unpaid. **For Return to Seller**: Release vehicle with type *Return to Seller* (wish 4; never blocked). **Inventory Monitoring** (**view only**, wish 5) instead of Auction Monitoring. Uses the same live data as FAD |
| Customer | **Customer Inquiry**: view, filter, sort; one row per Buyer ID (lots and cancellations). Click a Buyer ID or buyer name (here or on any FAD, SMD or VWD list) to open the **customer page** (`#/customer/<Buyer ID>`): *Customer Information* is not part of the prototype; *Customer Transaction History* shows Lots bought, Total bought, Pending awarding, Unpaid and Cancellations, Purchases by seller, and the buyer's lots as tabs (Sold, Pending Awarding, Unpaid, Pending DOAS signature, Documents for release, Cancellation) with Notarial (transfer fee), Commission, Total (with Security Bond) and Step (Pending award, Unpaid, Paid, Seller Ack., For Dispatch, Unreleased, Released or Returned). The Pending DOAS signature and Documents for release tabs list lots waiting on a signed DOAS or on the documents. Read-only. Sales Actions stays disabled (no data) |
| Log Activity | View, filter, sort only. Entries cannot be edited or deleted. FAD changes, VWD releases and returns, and SMD Return to Seller clearances (plus the SAAF with the switch on) are logged |

## Seeded test data (`data.js` > `window.MOCK_DATA`)

- **vehicles**: 209 lots. **134 come from the MS Access FAD Maintenance screenshots of 10/08/2026** (Pending Awarding, Unpaid, Payment Seller, Seller Acknowledgement, For Dispatch, Unreleased Units, Liability to Seller, Rebate Monitoring, Commission Billing). The other 75 are the earlier generated sample lots, kept so every walkthrough step has data. Lots were merged by plate number: a generated lot whose plate appears in Access now holds the Access data (10 of them are now the cancelled sale from Access Cancellation Monitoring).
- **JBAP parking inventory** (JBAP, 16 Oct 2026): the 168 lots whose plate matches JBAP's *2026 Open & IMET Parking Inventory* file (sheet *JBAP*, as of 12 Oct 2026) carry its Logistics, Originating Warehouse, Parking Location, Transfer Date, Returned to Seller WH and Date of Entry (when a plate has several rows in the file, the latest row on or before the lot's auction end; the file's Date of Entry is used only when it is on or before the auction end). VCN, CS No., colour, year, model, seller, status and the release and return dates stay as in CDMS/Access, and the file's *Remarks/Status* is not copied, because CDMS calculates the status. **12 lots carry a Returned to Seller WH value from the file while CDMS shows another status**: that column holds remarks such as "SOLD BY ORICO" or "RETURNED BY SBC", and CDMS shows it as written (Q70). The file's *First auction listing* and *End date of listing* columns are almost empty and are left out (Q70)
- **JBAP Document Monitoring dates**: the 122 lots that match JBAP's *2026 Documents Monitoring (updated)* sheet (received 15 Oct 2026) on plate and auction carry its EWB, DOAS and document dates and remarks. Seller Payment stays the Access value, because JBAP's sheet agrees with Access on only 12 of 46 lots where both are filled (Q48); dates after the demo day are left out; EWB and DOAS columns only where the seller uses them.
- **sellers**: release condition, VAT handling, NET/GROSS and notarial fees per seller (ORICO, ASIALINK and the sample code TFSPH are not in JBAP's list: marked unconfirmed). TFSPH (Toyota Financial Services Philippines) uses the TFS settings: Buyer Payment release, GROSS
- **location**: every lot is "Pasay City" until JBAP lists its storage locations (Q31)
- **year, color, fuel, CS no.**: sample values on generated lots; blank on Access lots (not in the screenshots)
- **auctions**: weekly Monday to Wednesday calendar, auction 220 = 09/21 to 09/23/2026 (from Access), 197 to 221, plus 175, 180 and 181 (Nov and Dec 2025) for the Liability to Seller rows
- **fadResult**: Result Summary copied from Access (auctions 197 to 220), shown in Report › Result Summary. It does not recalculate when lots change, because the sample holds only some lots per auction
- **meta.company**: company name, finance/sales/VWD email placeholders, role titles for signatures and a placeholder bank account used by the reports
- **cancellations**: 46 records: Access Cancellation Monitoring (23 rows), legacy SMD records and generated ones
- **billing**: 48 records: Access Billing Monitoring (#486 to #510) and Unpaid Billing (24 rows, including #428 three times as in Access)
- **smd**: legacy SMD screenshots (Result Summary, Auction Monitoring, Pending Awarding, Unpaid, Pending Seller Ack., For Dispatch, Unreleased Units, Rebates, Cancellations). Since JBAP's feedback of 16 Oct 2026 no screen shows the Result Summary, Auction Monitoring or Cancellations snapshots; the rows stay in `data.js`
- **activityLog**: 38 sample Log Activity entries (09/01 to 10/06/2026) by 3 sample users (`fad.ana`, `fad.rico`, `fad.lea`), built from the lot and cancellation dates above so every new value matches the lists. Includes one correction (old value to new value) and one cancellation
- **data-extra.js** ([MOCK], not Access): **auction 222** (12 to 14 Oct 2026; JBAP's parking file shows A222 lots by 12 Oct) with three Not Sold units relisted in it (V066, V070 and V077), so Return to Seller leaves them out (JBAP, 16 Oct 2026, #19); 3 lots cancelled in CDMS (P2), SAAF dates on 7 Pending Awarding lots (P5: 4 approved, 3 awaiting the seller), a Date of Entry on every vehicle that is not in the JBAP parking file or has no entry on or before its auction end (wish 5), a sample Security Bond of PHP 20,000 for INSPIRO, ORICO and ASIALINK (only INSPIRO bills a bond in JBAP's sheet; ORICO and ASIALINK carry one for the demo; Access lots keep their Access amounts, no bond) with sample progress on three lots (Auction 218 Lot 107, plate GBF4509: Complete; Auction 220 Lot 022, plate NHT5509: Pending Refund; Auction 220 Lot 062, plate NGU3045: Forfeited) and the SMD/FAD role titles for the new forms
- **Demo date** is fixed at **10/08/2026** (`meta.demoToday`), the day the Access screenshots were taken, so deadlines and penalties match Access. Buyer emails are placeholders (example.com).

### Values not visible in the Access screenshots (inferred)

Names cut off in Access end in "…". Everything shown in a screenshot is copied as is; these values were filled in so the lots follow the prototype rules, and are **not** Access data:

| Value | How it was filled |
|-------|-------------------|
| Awarding Date | Buyer deadline minus 3 working days (Unpaid), Sold-Accounting date, or auction end plus 4 working days |
| Buyer Paid | Payment to Seller deadline minus 3 working days, or Awarding plus 3 working days |
| Payment to Seller, Seller Acknowledgement, Dispatch, Release | Next step plus 2 to 3 working days, so each lot appears only on the lists Access shows it on (the Unpaid, Payment Seller, For Dispatch, Unreleased and Commission Billing screenshots are complete lists) |
| Dispatch Date (Unreleased Units) | Dispatch deadline minus 3 working days |
| Result Price | From Pending Awarding, Commission Billing or Sold-Accounting; otherwise the total minus the seller's transfer fee; blank when no amount is shown; Payment Seller lots: To JBAP ÷ 0.97 × 22.4 (VAT-inside sellers), rounded to the nearest 50, which reproduces To JBAP to the centavo |
| Transfer fee | EWB 1,000, SBC 400 up to 499,999.99 then 500, TFS 500, JACCS 0 (seller settings); other sellers keep their sample default |
| Auction No. (Seller Acknowledgement lots) | Latest auction ending before the inferred Awarding Date |
| Lot No. when not shown | Next free number from 121 |
| Buyer ID when not shown | Placeholder **B9001 to B9041** |
| Customer name (Liability lots), Make/Model when not shown | Left blank |
| Billing Date (Unpaid Billing rows) | Auction end of the particulars plus 7 days, never earlier than a lower Billing # |
| Date of Entry (data-extra.js) | Start of the lot's auction minus 7 to 21 days |

Edit `data.js` (or `data-extra.js` for the proposal sample data) and refresh the browser to change sample data.

## Rules used (to confirm with JBAP)

Qn = question n in JBAP's Open Questions document (Q69 to Q82: the *Questions* sheet of `JBAP CDMS Feedback 2 - Responses and Questions (2026-10-16).xlsx`, prepared for JBAP with the 16 Oct 2026 update).

| Rule | Prototype value | Source |
|------|-----------------|--------|
| Buyer deadline, payment-to-seller deadline, dispatch deadline | 3 working days (Mon to Fri, no holiday list yet) | Access guideline; matches the Access screenshots of 10/08/2026 |
| Billing due date | Billing date + 10 days | Access DB notes (the Due Date column is empty in the Access screenshots) |
| Seller settings | Release condition, VAT inside 5% (EWB, SBC) or on top (others), NET (all except TFS) / GROSS (TFS and its sample code TFSPH), notarial fee (EWB 1,000; SBC 400 up to 499,999.99 then 500; TFS 500; JACCS 0) | Dispatch Condition per seller.xlsx, Access samples; Q25 to Q29 to confirm |
| Commission, VAT, W/TAX | Commission 5% (÷1.12 when VAT is inside); VAT 12%; W/TAX 15% of commission for NET sellers | Q1, Access Payment Seller sample; Q25, Q26 to confirm |
| To JBAP / Payable to Seller | Commission + VAT − W/TAX (0 for GROSS) / price + transfer fee + security bond − To JBAP | Matches all 18 Access Payment Seller rows to the centavo |
| For Dispatch | Seller condition met: Buyer Payment and DOAS sellers after Buyer Paid, others after Seller Acknowledgement | Dispatch Condition per seller; DOAS date for release: Q28 |
| Storage penalty | PHP 500 per calendar day after the dispatch deadline, only at Pasay City / JBAP | Confirmed by Access data, Q15; locations Q31 |
| Cancellation penalty | PHP 10,000 per lot; 5,000 seller / 5,000 JBAP; EWB all JBAP; waived 0 | Q4 |
| Vehicle release (VWD) | Blocked for DOAS sellers until *JBAP Receipt of Signed DOAS* or *Seller Receipt of Signed DOAS* is entered (EWB: *Date DOAS Signed (EWB)*), and while a storage penalty is unpaid. VRF No. and ATF No. are running numbers (seed values in `data.js` > `meta.company.next`). Returns to the seller are never blocked. | **Assumption** (dispatch after payment, release needs the signed DOAS); JBAP Q9, Q28 |
| Liability to Seller amount | Result price + transfer fees + security bond | Matches Access *SumOfTOTAL*; the sample bond is not applied to Access lots |
| Liability lots on Payment Seller | The 15 Access Liability lots (Nov 2025 to Aug 2026) also show on Payment Seller | Access does not list them on Payment Seller: **to confirm** which filter Access uses |
| Billing # unique | Not enforced for existing rows | Access lists Billing #428 three times: **data issue to check** |
| "Sold - Accounting" menu | Not in the prototype | Exists in Access FAD but not in the CR form: **to confirm** if needed |
| One commission billing per seller | Enforced when printing; with the switch on, several sellers print together, one billing each (P4) | **Assumption** |
| Waived cancellations are not billed | Excluded from Cancellation Billing | **Assumption** |
| Overdue deadlines shown in red | Unpaid, Payment Seller, Unreleased, Unpaid Billing | Prototype suggestion |
| Log Activity records data changes only (not views, or prints that change nothing), one row per changed field | Update, Create, Cancel | Prototype suggestion, **to confirm** |
| Return to Seller (wish 4; JBAP, 16 Oct 2026, #19) | Status Not Sold or Cancelled, no clearance and no release yet, and **not listed in an ongoing or future auction**: the lot's own auction has not ended (end on or after the demo date), or its *next auction* names an auction that has not ended. [MOCK] auction 222 (12 to 14 Oct 2026) has three relisted units. One form per seller, signatures on paper | Wish 4, Q18, Q19, JBAP feedback #19; **assumptions**: when a unit counts as listed (Q77), approval by the SMD and FAD Managers in CDMS or on paper (Q76, Q32) |
| Inventory Days in Yard (wish 5) | Date of Entry to the release or return date, or to today while in the yard | Wish 5; columns now from JBAP's parking inventory file (Q70) |
| Inventory Monitoring and status (JBAP, 16 Oct 2026, #2, #20, #23) | One row per vehicle in the columns of JBAP's parking inventory file; view only for SMD and VWD. Inventory Status in this order: Listed, Awarded (status Sold), **For Release** (dispatched, not released), **For Return** (cleared by SMD for return), Released, Returned (release type Return to Seller). A released or returned unit follows its release record | JBAP feedback; file and columns Q70; For Release rule Q71; exceptions such as *Out for repair* Q72 (**assumptions**) |
| Report menu (JBAP, 16 Oct 2026, #1) | Result Summary and Auction Monitoring moved from FAD and SMD to Report; Cancellation Monitoring did not move (#14) | JBAP feedback; Cancellation Monitoring for SMD: Q69 |
| Record counts in the sidebar (JBAP, 16 Oct 2026, #3) | Number of rows of each menu item; Billing and Rebate show a count on each tab instead of one number | JBAP feedback |
| Typed dates (JBAP, 16 Oct 2026, #4) | `mm/dd/yyyy`, `mm/dd/yy` (20yy), `mm/dd` or `mmdd` (year of the demo date), `mmddyyyy`, `yyyy-mm-dd`, `t` or `today`; separators / - . or space; anything else is invalid and reported on Save | JBAP feedback; the shortcuts are a **prototype suggestion** |
| Transfer fees (JBAP, 16 Oct 2026, #5) | Read-only in Pending Awarding: always the seller parameter | JBAP feedback; exceptions Q78 |
| Seller codes and Auction No. (JBAP, 16 Oct 2026, #5 to #10, #12, #15 to #18, #21, #22) | The seller code and the Auction No. replace the seller's full name and the Auction Date where JBAP asked | JBAP feedback; TFS and TFSPH Q79; Commission Billing shows Auction Date as asked, Q80 |
| Penalty payment (JBAP, 16 Oct 2026, #9) | Record payment: full penalty due, paid today, optional OR / reference no.; the dispatch deadline becomes today (`deadline_reset`) and the penalty starts again the next day if the unit is still not released | JBAP feedback; partial payment, OR rules, who collects: Q75; extension of the deadline: Q74 (not built) |
| Cancellation Billing & Payment and Cancellation Entry list (JBAP, 16 Oct 2026, #13, #14) | One screen for billing and payment (lots with the fee not waived and no Date Paid; same Date Paid and Amount checks as before); Cancellation Entry lists every cancellation with filters. Cancellation Monitoring is removed | JBAP feedback; SMD view of cancellations: Q69 |
| Customer page tabs (JBAP, 16 Oct 2026) | *Pending DOAS signature*: Receipt of DOAS filled and JBAP Receipt of Signed DOAS blank; *Documents for release*: JBAP Receipt of Documents filled and Buyer Receipt of Documents blank | JBAP wrote only "is not null"; the "still blank" half is our reading (Q82); EWB lots: Q82; sales action notes: Q81 |
| Document status | Furthest step reached: Pending Payment, Pending DOAS, DOAS for Signing, Pending Documents, For Releasing, Complete, Cancelled | JBAP's Documents Monitoring sheet: same as the typed status on 1,644 of 1,674 non-cancelled lots; differences listed for JBAP (Q49) |
| DOAS signing per seller | EWB at its HO or store; TFS and TFSPH none; others at JBAP | JBAP's sheet; **to confirm** (Q50) |
| Aging | Working days (Mon to Fri, both days counted) while a step waits; blank once done or when the start date is blank | JBAP's sheet formula; a blank start date shows blank (JBAP's sheet shows about 33,000 days), and EWB aging stops when the DOAS is signed at EWB |
| Security Bond | Seller setting (sample amounts), billed with the vehicle, passed to the seller in Payable to Seller; refunded after the ORCR transfer or forfeited | JBAP feedback; amounts Q44, seller codes Q45, flow Q46, forfeiture Q47 |

## Not simulated

- Persistence: all changes are lost on refresh (by design), including new Log Activity entries
- Real login: the header shows the CDMS user only, so every change made in the demo is logged as `system`. Log times use the demo date with the real clock time
- Real emails, NOAH and CDMS: email and print are previews; nothing is sent or posted. CDMS cancellations (P2) are sample data in `data-extra.js`
- NOAH: JBAP's existing integration is not connected; NOAH numbers are typed (P3, Q43)
- Deadline extensions, partial penalty payments, approval of a Return to Seller in CDMS and Cancellation Monitoring for SMD: not built, they are questions for JBAP (Q69, Q74, Q75, Q76). A penalty payment is recorded for the full amount due, as of the demo date
- Pixel-perfect design: this is a prototype, not the final UI

## Feedback

Write feedback in the hearing questionnaire or a shared sheet rather than editing the prototype. For bigger changes, re-run /logique-b1-prototyping with the feedback.

Config: client branding (CDMS look), English UI, no role switcher (menu-based access), mock data from designs and legacy screenshots.
