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
- **32 screens**: FAD 18, SMD 9, VWD 4, Log Activity 1 (last item in the sidebar, below Staff), plus a Home page with counts per list.
- Every list has working **filters, column sorting, page size and paging**, an empty state, and totals where the design has them.

## Flow walkthrough (FAD, data flows between lists and into VWD)

1. **Pending Awarding**: tick *For BAAF* on 1 or more lots (optionally change Awarding Date or Transfer Fees) > **Email BAAF** > preview one email per buyer > **Send**. Lots move to **Unpaid**.
2. **Unpaid**: enter *Buyer Paid* > **Save changes**. Lot moves to **Payment Seller**. Try a future date to see validation.
3. **Payment Seller**: tick *Print Payment to Seller* > **Print payment to seller** (report per seller). Enter *Payment to Seller Date* > **Save**. Lot moves to **Seller Acknowledgement** and **Commission Billing**.
4. **Seller Acknowledgement** > **For Dispatch** > enter dates and save. Dispatched lots appear in **Unreleased Unit** (FAD) and in VWD **Unreleased Unit / Unreleased Unit (Overdue)**.
5. **Commission Billing**: tick *Print?* for lots of **one seller** > **Print commission billing** > enter NOAH Billing No. and date > **Record billing & print**. A new billing appears in **Billing Monitoring** and **Unpaid Billing**.
6. **Unpaid Billing**: enter Payment Date + Collection Receipt > **Save**.
7. **Cancellation Entry**: enter an Auction No. and Lot (tip: copy one from Unpaid) > **Find** > set Status to *Cancelled*, date, waiver and reason > **Cancel transaction**. It appears in **Cancellation Monitoring** and (if not waived) **Cancellation Billing** > print to bill > **Cancellation Payment** > enter date paid and amount.
8. **Rebate Payable**: enter *Rebate Paid* > **Save**. **Liability to Seller**: pick a date > **Generate**.
9. **Log Activity**: every change from steps 1 to 8 appears here as user `system`, one row per changed field with the old and new value (newest first). Filter by date, user, module, action or record/plate. Print previews and *Generate* are not logged, because they do not change data.

## Access per menu

| Menu | Access in this prototype |
|------|--------------------------|
| FAD | View, filter, sort; update on the screens marked *Update* (CR form) |
| SMD | View, filter, sort only. Shows the **legacy SMD sample data** (snapshot), so FAD actions do not change SMD lists |
| VWD | View, filter, sort only. Uses the same live data as FAD |
| Log Activity | View, filter, sort only. Entries cannot be edited or deleted. Only FAD has entries, because SMD and VWD are view-only |

## Seeded test data (`data.js` > `window.MOCK_DATA`)

- **vehicles**: 85 lots from auctions 216 to 221 at every stage (pending awarding to released)
- **cancellations**: 32 records (legacy Cancellation Monitoring, Billing and Payment rows plus generated ones)
- **billing**: 24 legacy billing records (Aug to Sep 2025)
- **smd**: legacy SMD screenshots (Result Summary, Auction Monitoring, Pending Awarding, Unpaid, Pending Seller Ack., For Dispatch, Unreleased Units, Rebates, Cancellations)
- **activityLog**: 38 sample Log Activity entries (09/03 to 10/08/2026) by 3 sample users (`fad.ana`, `fad.rico`, `fad.lea`), built from the vehicle and cancellation dates above so every new value matches the lists. Includes one correction (old value to new value) and one cancellation
- **Demo date** is fixed at **10/09/2026** (`meta.demoToday`) so deadlines and penalties look the same whenever it is opened. Buyer emails are placeholders (example.com).

Edit `data.js` and refresh the browser to change sample data.

## Rules used (to confirm with JBAP)

| Rule | Prototype value | Source |
|------|-----------------|--------|
| Buyer deadline, payment-to-seller deadline, dispatch deadline | 3 working days (Mon to Fri, no holiday list yet) | Access guideline |
| Billing due date | Billing date + 10 days | Access DB notes |
| Commission | 5% of winning bid, VAT 12% inside | Legacy commission billing |
| Penalty after dispatch deadline | PHP 500 per calendar day | Inferred from legacy SMD data, **placeholder** |
| "To JBAP" on Payment Seller | 5% of result price | **Placeholder**, meaning not defined |
| One commission billing per seller | Enforced when printing | **Assumption** |
| Waived cancellations are not billed | Excluded from Cancellation Billing | **Assumption** |
| Overdue deadlines shown in red | Unpaid, Payment Seller, Unreleased, Unpaid Billing | Prototype suggestion |
| Log Activity records data changes only (not views or prints), one row per changed field | Update, Create, Cancel | Prototype suggestion, **to confirm** |

## Not simulated

- Persistence: all changes are lost on refresh (by design), including new Log Activity entries
- Real login: the header shows the CDMS user only, so every change made in the demo is logged as `system`. Log times use the demo date with the real clock time
- Real emails and NOAH: email and print are previews; nothing is sent or posted
- Vehicle release by VWD: the CR gives VWD view-only access, so released dates cannot be entered here
- Pixel-perfect design: this is a prototype, not the final UI

## Feedback

Write feedback in the hearing questionnaire or a shared sheet rather than editing the prototype. For bigger changes, re-run /logique-b1-prototyping with the feedback.

Config: client branding (CDMS look), English UI, no role switcher (menu-based access), mock data from designs and legacy screenshots.
