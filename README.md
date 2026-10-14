# Prototype: CDMS Post-Auction Menus (FAD, SMD, VWD), JBA Philippines

> **Generated**: 2026-10-09 via /logique-b1-prototyping
> **Scope**: Clickable to-be prototype of the new FAD, SMD and VWD menus in CDMS that replace the MS Access post-auction forms (frmFAD, frmSMD, frmVWD). Built from the approved screen designs and the CR form.
> **Status**: Prototype, not production code

## How to open

**Double-click `index.html`.** That's it: no server and no setup needed.

The prototype is plain HTML, CSS and JavaScript. Data sits in `data.js` and is loaded with a `<script>` tag, so it works straight from the folder (no `fetch()`).

**Works in** Chrome, Edge, Firefox and Safari on Windows, macOS or Linux. If double-click does not open a browser: right-click `index.html` > Open With > choose a browser.

## What is clickable

- **Only FAD, SMD, VWD and Log Activity are active.** All other CDMS menus (Dashboard, Customer, Cars, Report, Payment, etc.) are disabled and show a short message when clicked.
- **33 screens**: FAD 19, SMD 9, VWD 4, Log Activity 1 (last item in the sidebar, below Staff), plus a Home page with counts per list.
- Every list has working **filters, column sorting, page size and paging**, an empty state, and totals where the design has them.

## Flow walkthrough (FAD, data flows between lists and into VWD)

1. **Pending Awarding**: tick *For BAAF* on 1 or more lots (optionally change Awarding Date or Transfer Fees) > **Email BAAF** > preview one email per buyer > **Send**. Lots move to **Unpaid**.
2. **Unpaid**: enter *Buyer Paid* > **Save changes**. Lot moves to **Payment Seller**. Try a future date to see validation.
3. **Payment Seller**: tick *Print Payment to Seller* > **Print payment to seller** (report per seller). Enter *Payment to Seller Date* > **Save**. Lot moves to **Seller Acknowledgement** and **Commission Billing**.
4. **Seller Acknowledgement**: enter the date and save. **For Dispatch** lists lots whose seller condition is met (Buyer Payment / DOAS sellers after Buyer Paid, others after Seller Acknowledgement): enter the date and save. **Document Monitoring**: enter the DOAS and document dates in order. Dispatched lots appear in **Unreleased Unit** (FAD) and in VWD **Unreleased Unit / Unreleased Unit (Overdue)**. VWD can then click **Release vehicle** on a row (see *Reports and emails*).
5. **Commission Billing**: tick *Print?* for lots of **one seller** > **Print commission billing** > enter NOAH Billing No. and date > **Record billing & print**. A new billing appears in **Billing Monitoring** and **Unpaid Billing**.
6. **Unpaid Billing**: enter Payment Date + Collection Receipt > **Save**.
7. **Cancellation Entry**: enter an Auction No. and Lot (tip: copy one from Unpaid) > **Find** > set Status to *Cancelled*, date, waiver and reason > **Cancel transaction**. It appears in **Cancellation Monitoring** and (if not waived) **Cancellation Billing** > print to bill > **Cancellation Payment** > enter date paid and amount.
8. **Rebate Payable**: enter *Rebate Paid* > **Save**. **Liability to Seller**: pick a date > **Generate**.
9. **Log Activity**: every change from steps 1 to 8 and every VWD release appears here as user `system`, one row per changed field with the old and new value (newest first). Filter by date, user, module, action or record/plate. Prints and emails that record a value (Awarding Date, Billing #, Transmittal Date, Dispatch Date, cancellation billing date and amount, vehicle release with type and checklist, documents received with Others/Remarks and ATF No.) are logged; previews that change nothing and *Generate* are not.

## Reports and emails (layouts of the MS Access samples, 12 Oct 2026)

| Access report | Where | What it records |
|---|---|---|
| JBAP_AWARDING + qryRebatePrint | Pending Awarding › Email BAAF (attachments in the email preview) | Awarding Date |
| qryPAYMENTSELLERPrint | Payment Seller › Print payment to seller | – |
| qryBillingSeller | Commission Billing › Print commission billing | Billing # and date |
| BILLING TRANSMITTAL | Billing Monitoring › Print Transmittal? › Print billing transmittal | Transmittal Date |
| VEHICLE_DISPATCH (email + form) | For Dispatch › For Dispatch Email? › Email dispatch form | Dispatch Date |
| rptVehiclerelease (release form + gate pass) | VWD Unreleased Unit / Overdue › Release vehicle | Release date, VRF No. |
| rptCancellationPenalty | Cancellation Billing › Print cancellation billing (one letter per buyer) | Billing date, amount due |
| DocumentTransmittalPrint | Document Monitoring › Print Transmittal? › Print document transmittal | Documents received, ATF control no. |

Reports print role titles and a placeholder bank account, not JBAP's staff names or account number. Print or save as PDF with the browser's print dialog.

## Access per menu

| Menu | Access in this prototype |
|------|--------------------------|
| FAD | View, filter, sort; update on the screens marked *Update* (CR form) |
| SMD | View, filter, sort only. Shows the **legacy SMD sample data** (snapshot), so FAD actions do not change SMD lists |
| VWD | View, filter, sort; **Release vehicle** on Unreleased Unit and Unreleased Unit (Overdue) (JBAP Q9). Blocked when a DOAS seller's lot has no Buyer signed DOAS or a storage penalty is unpaid. Uses the same live data as FAD |
| Log Activity | View, filter, sort only. Entries cannot be edited or deleted. FAD changes and VWD vehicle releases are logged; SMD is view-only, so it has no entries |

## Seeded test data (`data.js` > `window.MOCK_DATA`)

- **vehicles**: 209 lots. **134 come from the MS Access FAD Maintenance screenshots of 10/08/2026** (Pending Awarding, Unpaid, Payment Seller, Seller Acknowledgement, For Dispatch, Unreleased Units, Liability to Seller, Rebate Monitoring, Commission Billing). The other 75 are the earlier generated sample lots, kept so every walkthrough step has data. Lots were merged by plate number: a generated lot whose plate appears in Access now holds the Access data (10 of them are now the cancelled sale from Access Cancellation Monitoring).
- **sellers**: release condition, VAT handling, NET/GROSS and notarial fees per seller (ORICO, ASIALINK and the sample code TFSPH are not in JBAP's list: marked unconfirmed). TFSPH (Toyota Financial Services Philippines) uses the TFS settings: Buyer Payment release, GROSS
- **location**: every lot is "Pasay City" until JBAP lists its storage locations (Q31)
- **year, color, fuel, CS no.**: sample values on generated lots; blank on Access lots (not in the screenshots)
- **auctions**: weekly Monday to Wednesday calendar, auction 220 = 09/21 to 09/23/2026 (from Access), 197 to 221, plus 175, 180 and 181 (Nov and Dec 2025) for the Liability to Seller rows
- **fadResult**: FAD Result Summary copied from Access (auctions 197 to 220). It does not recalculate when lots change, because the sample holds only some lots per auction
- **meta.company**: company name, finance/sales/VWD email placeholders, role titles for signatures and a placeholder bank account used by the reports
- **cancellations**: 46 records: Access Cancellation Monitoring (23 rows), legacy SMD records and generated ones
- **billing**: 48 records: Access Billing Monitoring (#486 to #510) and Unpaid Billing (24 rows, including #428 three times as in Access)
- **smd**: legacy SMD screenshots (Result Summary, Auction Monitoring, Pending Awarding, Unpaid, Pending Seller Ack., For Dispatch, Unreleased Units, Rebates, Cancellations)
- **activityLog**: 38 sample Log Activity entries (09/01 to 10/06/2026) by 3 sample users (`fad.ana`, `fad.rico`, `fad.lea`), built from the lot and cancellation dates above so every new value matches the lists. Includes one correction (old value to new value) and one cancellation
- **Demo date** is fixed at **10/08/2026** (`meta.demoToday`), the day the Access screenshots were taken, so deadlines and penalties match Access. Buyer emails are placeholders (example.com).

### Values not visible in the Access screenshots (inferred)

Names cut off in Access end in "…". Everything shown in a screenshot is copied as is; these values were filled in so the lots follow the prototype rules, and are **not** Access data:

| Value | How it was filled |
|-------|-------------------|
| Awarding Date | Buyer deadline minus 3 working days (Unpaid), Sold-Accounting date, or auction end plus 4 working days |
| Buyer Paid | Payment to Seller deadline minus 3 working days, or Awarding plus 3 working days |
| Payment to Seller, Seller Acknowledgement, Dispatch, Release | Next step plus 2 to 3 working days, so each lot appears only on the lists Access shows it on (the Unpaid, Payment Seller, For Dispatch, Unreleased and Commission Billing screenshots are complete lists) |
| Dispatch Date (Unreleased Units) | Dispatch deadline minus 3 working days |
| Result Price | From Pending Awarding, Commission Billing or Sold-Accounting; otherwise the total minus the seller's transfer fee; blank when no amount is shown; Payment Seller lots: To JBAP ÷ 0.97 × 22.4 (exact to the centavo) |
| Transfer fee | EWB 1,000, SBC 400 up to 499,999.99 then 500, TFS 500, JACCS 0 (seller settings); other sellers keep their sample default |
| Auction No. (Seller Acknowledgement lots) | Latest auction ending before the inferred Awarding Date |
| Lot No. when not shown | Next free number from 121 |
| Buyer ID when not shown | Placeholder **B9001 to B9041** |
| Customer name (Liability lots), Make/Model when not shown | Left blank |
| Billing Date (Unpaid Billing rows) | Auction end of the particulars plus 7 days, never earlier than a lower Billing # |

Edit `data.js` and refresh the browser to change sample data.

## Rules used (to confirm with JBAP)

Qn = question n in JBAP's Open Questions document.

| Rule | Prototype value | Source |
|------|-----------------|--------|
| Buyer deadline, payment-to-seller deadline, dispatch deadline | 3 working days (Mon to Fri, no holiday list yet) | Access guideline; matches the Access screenshots of 10/08/2026 |
| Billing due date | Billing date + 10 days | Access DB notes (the Due Date column is empty in the Access screenshots) |
| Seller settings | Release condition, VAT inside 5% (EWB, SBC) or on top (others), NET (all except TFS) / GROSS (TFS and its sample code TFSPH), notarial fee (EWB 1,000; SBC 400 up to 499,999.99 then 500; TFS 500; JACCS 0) | Dispatch Condition per seller.xlsx, Access samples; Q25 to Q29 to confirm |
| Commission, VAT, W/TAX | Commission 5% (÷1.12 when VAT is inside); VAT 12%; W/TAX 15% of commission for NET sellers | Q1, Access Payment Seller sample; Q25, Q26 to confirm |
| To JBAP / Payable to Seller | Commission + VAT − W/TAX (0 for GROSS) / price + fee − To JBAP | Matches all 18 Access Payment Seller rows to the centavo |
| For Dispatch | Seller condition met: Buyer Payment and DOAS sellers after Buyer Paid, others after Seller Acknowledgement | Dispatch Condition per seller; DOAS date for release: Q28 |
| Storage penalty | PHP 500 per calendar day after the dispatch deadline, only at Pasay City / JBAP | Confirmed by Access data, Q15; locations Q31 |
| Cancellation penalty | PHP 10,000 per lot; 5,000 seller / 5,000 JBAP; EWB all JBAP; waived 0 | Q4 |
| Vehicle release (VWD) | Blocked for DOAS sellers until *Buyer Signed DOAS* is entered, and while a storage penalty is unpaid. VRF No. and ATF No. are running numbers (seed values in `data.js` > `meta.company.next`) | **Assumption** (dispatch after payment, release needs the signed DOAS); JBAP Q9, Q28 |
| Liability to Seller amount | Result price + transfer fees | Matches Access *SumOfTOTAL* |
| Liability lots on Payment Seller | The 15 Access Liability lots (Nov 2025 to Aug 2026) also show on Payment Seller | Access does not list them on Payment Seller: **to confirm** which filter Access uses |
| Billing # unique | Not enforced for existing rows | Access lists Billing #428 three times: **data issue to check** |
| "Sold - Accounting" menu | Not in the prototype | Exists in Access FAD but not in the CR form: **to confirm** if needed |
| One commission billing per seller | Enforced when printing | **Assumption** |
| Waived cancellations are not billed | Excluded from Cancellation Billing | **Assumption** |
| Overdue deadlines shown in red | Unpaid, Payment Seller, Unreleased, Unpaid Billing | Prototype suggestion |
| Log Activity records data changes only (not views, or prints that change nothing), one row per changed field | Update, Create, Cancel | Prototype suggestion, **to confirm** |

## Not simulated

- Persistence: all changes are lost on refresh (by design), including new Log Activity entries
- Real login: the header shows the CDMS user only, so every change made in the demo is logged as `system`. Log times use the demo date with the real clock time
- Real emails and NOAH: email and print are previews; nothing is sent or posted
- Storage penalty payment and deadline extensions (step 2): overdue lots cannot be released yet in the prototype
- Pixel-perfect design: this is a prototype, not the final UI

## Feedback

Write feedback in the hearing questionnaire or a shared sheet rather than editing the prototype. For bigger changes, re-run /logique-b1-prototyping with the feedback.

Config: client branding (CDMS look), English UI, no role switcher (menu-based access), mock data from designs and legacy screenshots.
