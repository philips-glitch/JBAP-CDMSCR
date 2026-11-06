# CDMS Post-Auction: Konsep V2 "One Flow" (draft untuk review internal)

> **Status**: draft konsep, belum direview Yoshi-san / Alvin, belum dikirim ke JBAP.
> **Branch**: `concept/v2-one-flow` (dibuat dari `jbap-feedback-docmon-bond` @ 356bf9a). Prototype V1 milik Philips **tidak diubah sama sekali**; semua file V2 ada di folder `v2-concept/`.
> **Cara buka scratch UI**: double-click `v2-concept/index.html` (tanpa server). Data dummy anonim (Sample Buyer A–F, plat XAA/XEW).
> **Disusun**: 6 Nov 2026, Firman.

---

## 1. Kenapa ada V2

Kaneshima-san (pimpinan JBAP) menyampaikan lewat Yoshi-san bahwa beliau **tidak bisa approve requirement yang hanya memindahkan cara kerja Access ke CDMS** tanpa menelaah alur optimal atau cara kerja yang lebih baik. Yoshi-san meminta kita melakukan konsultasi yang sebenarnya dengan JBAP (khususnya Jonathan dan Kim) lalu **mengulang estimasi**.

Catatan internal yang sama menekankan tiga hal:
1. Fitur terlalu banyak dan **sama persis dengan Access**: alurnya masih alur Access, UI dan flow tidak membaik.
2. Banyak input masih **manual** padahal bisa dihitung, diisi otomatis, atau tercatat sendiri (misalnya tanggal approved tanpa harus centang).
3. Fitur harus menjadi **satu kesatuan flow**, bukan fitur terpisah satu per satu, supaya cerita kerja user lebih mudah.

Dokumen ini adalah usulan arah. **Belum ada yang diputuskan**; banyak poin bergantung pada pengecekan dan workshop (bagian 9–10).

---

## 2. Diagnosis prototype V1 (Philips, @356bf9a)

Ini bukan kritik ke Philips: V1 dibangun persis sesuai input yang kita terima (CR form + 5 ronde feedback JBAP). Masalahnya ada di **cara kita menerima input**, bukan di eksekusinya.

### 2.1 Fakta dari repo

| Temuan | Bukti di V1 |
|---|---|
| Menu = form Access | 39 layar, dikelompokkan per departemen (FAD 14, SMD 8, VWD 4) mengikuti frmFAD / frmSMD / frmVWD |
| Lot pindah list karena user mengetik tanggal | **21 field tanggal** diketik manual di grid (16 di list + 5 tanggal di Document Monitoring), belum termasuk tanggal di dialog (Payment date, Date Cancelled, New deadline, Change date) |
| Kolom Yes/No khas Access | **9 kolom centang**: For BAAF, For SAAF, For Dispatch Email?, For DOAS Email?, Print Payment to Seller, Print?, For Email?, Print Transmittal?, For Return |
| Approval berupa tanggal/teks yang diketik | SMD Manager Approved dan FAD Manager Approved diketik sebagai tanggal; Extend meminta teks "Approved by (FAD Manager)" |
| List duplikat | SMD Unreleased Unit = "the same live list as FAD, view only"; SMD Pending Awarding/Unpaid/Seller Ack/For Dispatch = snapshot legacy |
| Tidak ada tampilan per unit | Untuk tahu posisi satu lot, user harus mencari di beberapa list. Halaman customer ada, halaman unit tidak ada |
| Usulan LOGIQUE kecil dan mundur saat ditolak | P1 ditarik ("JBAP keeps the Access format"), P2 ditarik; sisanya pre-tick (P4), pre-tick SAAF (P5), badge hitungan (P6) |

### 2.2 Akar masalah

1. **Unit desainnya salah.** V1 mendesain *layar per departemen*. Yang sebenarnya dikelola JBAP adalah *perjalanan satu unit* dari terjual sampai dilepas.
2. **Tanggal diperlakukan sebagai input, bukan sebagai jejak event.** Di Access, satu-satunya cara mencatat "sudah terjadi" adalah mengetik tanggal. Di sistem, tanggal bisa tercatat otomatis saat aksi terjadi.
3. **Feedback diterima per butir.** Setiap ronde menghasilkan "JBAP asked X → built X", sehingga paritas dengan Access makin kuat. Requirement .md dan estimasi ±41 MD yang saya buat sebelumnya mengikuti pola yang sama, jadi **keduanya tidak valid lagi untuk V2**.

### 2.3 Modul CDMS yang sudah ada tapi tidak dipakai di V1

Di `jbap-cdms` sudah ada controller untuk: `PaymentCustomer`, `PaymentCustomerDigital`, `BankTransfer` (termasuk **import CSV mutasi bank**), `PaymentSeller`, `Billing`, `PartialPayment`, `CashierClosing`, `DocumentManagement` (status per dokumen + history), `Inventory` (history status), `Reminder`.

**Belum diketahui** apakah modul-modul ini aktif dipakai JBAP PH (git history repo hanya "Firt master Main", Jan 2026). Kalau aktif, banyak tanggal V1 bisa diisi dari data yang sudah ada, dan build berkurang. Ini cek pertama yang harus dilakukan (bagian 9).

---

## 3. Prinsip desain V2

1. **Satu unit, satu record, satu halaman.** Semua departemen melihat lot yang sama; tidak ada list duplikat.
2. **Tanggal adalah event, bukan input.** Tanggal tercatat saat aksi terjadi, oleh sistem, oleh pihak luar lewat link, atau oleh satu klik/scan. Mengetik tanggal hanya untuk koreksi (dengan alasan, seperti *Change date* di V1).
3. **Centang diganti trigger otomatis atau satu tombol aksi massal.**
4. **Approval = tombol** dengan identitas user dan waktu otomatis, dalam satu inbox.
5. **Tampilkan pengecualian dulu.** User melihat yang butuh keputusan (overdue, tidak cocok, terblokir), bukan semua data. Yang sedang menunggu pihak lain disembunyikan dan diingatkan otomatis.
6. **Buyer dan seller ikut bekerja lewat link/portal** (approve SAAF, acknowledge, KYC), bukan staf JBAP yang mengetik balasan email mereka.

Setiap tanggal di V2 diberi label sumber: **Auto** (sistem), **Via link** (seller/buyer), **1-click** (staf menekan tombol), **Scan** (dokumen fisik), **Typed** (manual, harus mendekati nol).

---

## 4. Model inti: siklus hidup satu lot

### 4.1 V1: lot berpindah antar list departemen

```mermaid
flowchart LR
  RP[Auction › Result Price<br/>switch KYC, type rebate] --> SAAF[SMD › SAAF<br/>tick + email, type Seller Approved]
  SAAF --> PA[FAD › Pending Awarding<br/>tick For BAAF + email]
  PA --> UP[FAD › Unpaid<br/>type Buyer Paid]
  UP --> PS[FAD › Payment Seller<br/>tick + type date + print]
  PS --> SA[FAD › Seller Ack<br/>type date]
  PS --> CB[FAD › Billing<br/>tick + type NOAH no.]
  SA --> FD[FAD › Vehicle Dispatch<br/>tick email + type date]
  UP --> DM[FAD › Document Monitoring<br/>tick + type up to 5 dates]
  FD --> UR[FAD/SMD/VWD › Unreleased<br/>record penalty]
  UR --> VR[VWD › Release vehicle]
```

### 4.2 V2: satu state machine, tiga track paralel setelah bayar

```mermaid
flowchart LR
  S([Sold]) --> K{KYC ok?}
  K -- auto from portal --> SF[SAAF auto-sent]
  SF -- seller clicks link --> R{Rebate?}
  R -- none / decided --> B[BAAF auto-sent<br/>deadline set]
  R -- pending --> P[President approves] --> B
  B -- bank match --> PD([Buyer paid])
  B -- overdue --> X[Task: Cancel / Extend]
  PD --> T1[Settlement: run approved → commission auto-billed → seller acks via link]
  PD --> T2[Documents: DOAS auto-emailed → scan signed DOAS → scan seller docs → hand to buyer]
  PD --> T3[Release: dispatch notice auto when condition met → VWD releases, penalty collected]
  T1 & T2 & T3 --> C([Closed])
```

Pengecualian (Cancel, Return to Seller, Extension, Fee waiver) adalah cabang dari state yang sama, dengan approval di inbox yang sama.

---

## 5. Otomasi: setiap input manual V1 → mekanisme V2

Kolom **Kelayakan**: *Tinggi* = bisa dibangun di CDMS tanpa pihak luar; *Cek* = tergantung modul/integrasi yang belum diverifikasi; *Sepakati* = perlu keputusan bisnis JBAP atau kesediaan seller/buyer.

| # | V1 (manual) | V2 | Sumber tanggal | Kelayakan |
|---|---|---|---|---|
| 1 | KYC Status di-switch di Result Price | Diambil dari status KYC buyer (registrasi di jbap-revamp / API) | Auto | Cek: sumber dan definisi KYC |
| 2 | SAAF: centang For SAAF → Email | SAAF terkirim otomatis begitu KYC approved | Auto | Tinggi |
| 3 | Seller Approved diketik | Seller klik **Approve** di email (link bertanda tangan, tanpa login) | Via link | Sepakati: seller bersedia; fallback 1-click oleh SMD |
| 4 | Pending Awarding: centang For BAAF, cek Awarding Date | BAAF otomatis saat KYC + SAAF + rebate beres; Awarding Date = waktu kirim | Auto | Tinggi |
| 5 | Buyer Paid diketik | Dicocokkan dari import mutasi bank / modul payment; hanya yang tidak cocok masuk ke FAD | Auto | Cek: modul BankTransfer/PaymentCustomer dipakai? format referensi pembayaran buyer |
| 6 | Unpaid lewat deadline diketahui manual | Reminder H-1 otomatis; lewat deadline muncul tugas **Cancel / Extend** | Auto + 1-click | Tinggi |
| 7 | Payment Seller: centang + ketik tanggal + print | **Settlement run** per seller, satu approval | 1-click | Cek: modul PaymentSeller; cara transfer ke seller |
| 8 | Seller Acknowledgement diketik | Seller klik **Acknowledge** di email | Via link | Sepakati |
| 9 | Commission Billing: centang + ketik NOAH no. + print | Dibuat otomatis bersama settlement run | Auto | Cek: integrasi NOAH (P3 V1) |
| 10 | Unpaid Billing: ketik Payment Date + CR | Dicocokkan dari mutasi bank seperti #5 | Auto | Cek |
| 11 | For Dispatch: centang email + ketik Dispatch Date | Notice otomatis saat syarat release seller terpenuhi | Auto | Tinggi |
| 12 | DOAS for signature: centang + email | Otomatis saat lot dibayar (seller yang DOAS-nya di JBAP) | Auto | Tinggi |
| 13 | 5 tanggal dokumen (Receipt of DOAS, signed DOAS JBAP/seller, docs JBAP, docs buyer) | Receipt of DOAS = waktu email; signed DOAS & docs = **scan QR transmittal**; docs ke buyer = saat release / tombol | Auto / Scan / 1-click | Sedang: perlu label QR di transmittal |
| 14 | Penalty: Record payment di FAD, lalu release di VWD | Penalty tampil dan ditagih di langkah release yang sama (cashier) | 1-click | Tinggi (Cek: CashierClosing) |
| 15 | Extend: ketik deadline + nama approver | Request di task → approve di inbox | 1-click | Tinggi |
| 16 | RTS: ketik tanggal SMD Manager / FAD Manager Approved | Approve button di inbox | 1-click | Tinggi |
| 17 | Rebate Paid diketik | Dipotong dari tagihan buyer, atau masuk settlement/refund run | Auto | Sepakati: aturan rebate |
| 18 | Security Bond: 6 tanggal | ORCR via scan; refund via run seperti #7 | Scan / 1-click | Sedang |
| 19 | Holiday diketik satu per satu | Import daftar resmi tahunan, admin konfirmasi | 1-click | Tinggi |
| 20 | Cancellation fee: centang email + ketik Date Paid | Ditagih otomatis saat cancel; dicocokkan dari mutasi bank | Auto | Cek: seperti #5 |

**Perbaikan aturan yang diusulkan (perlu konfirmasi JBAP):**
- **Pull-out deadline untuk seller DOAS** baru dimulai setelah signed DOAS diterima. Di V1, lot bisa masuk For Dispatch setelah Buyer Paid tetapi release diblok sampai DOAS kembali, sehingga buyer berpotensi kena penalty ₱500/hari untuk keterlambatan yang bukan salahnya. *Ini bacaan saya atas V1; perlu diverifikasi dengan JBAP.*
- **Unpaid after deadline** menjadi keputusan eksplisit (Cancel / Extend dengan approval), bukan lot yang diam di list.

---

## 6. Struktur layar V2 (scratch UI)

| Area | Isi | Menggantikan (V1) |
|---|---|---|
| **My Tasks** | Antrian kerja per role (SMD, FAD, VWD, Approver), urut paling mendesak; item yang menunggu pihak lain dilipat | Hampir semua list kerja FAD/SMD/VWD |
| **Approvals** | Rebate, fee waiver, extension, return to seller. Tombol Approve/Reject | Approval › Rebate Approval, SMD Manager Approval, RTS Approval, kolom approver di Extend |
| **All units → Unit page** | Satu halaman per lot: timeline sale→payment, 3 track paralel, uang, history dengan sumber tanggal | Mencari lot di banyak list; Log Activity per lot |
| **Settlement run** | Lot yang sudah dibayar buyer, per seller, nilai sudah dihitung; satu approval | Payment Seller, Commission Billing, (Billing Monitoring) |
| **Pipeline** | Jumlah unit per stage, KPI (overdue, penalty, piutang, hari sale→release) | Sebagian besar Report untuk kebutuhan harian |
| **V1 vs V2** | Tabel perbandingan per langkah | (halaman penjelasan untuk review) |

Belum dibuat di scratch UI (masuk konsep, dibuat setelah arah disetujui): Customer 360 + buyer portal (V3 Transaction History mengambil state yang sama), Return to Seller flow, Security Bond, Inventory, Master (seller parameter, holiday), report formal (Rebate Monitoring, Liability to Seller, Cancellation Monitoring).

### 6.1 Pemetaan 39 layar V1 → V2

| V1 | V2 |
|---|---|
| Auction › Result Price | Tetap (layar CDMS existing); KYC tidak lagi di-switch di sini; tombol Request rebate / Cancel sale juga ada di Unit page |
| Approval › Rebate Approval | Approvals |
| FAD › Pending Awarding, Unpaid | Otomatis (BAAF, bank match); yang tersisa muncul di My Tasks (overdue, mismatch) |
| FAD › Payment Seller, Billing (Commission Billing, Billing Monitoring, Unpaid Billing) | Settlement run + matching otomatis; Billing Monitoring jadi filter/report |
| FAD › Seller Acknowledgement | Seller link; overdue → My Tasks |
| FAD › Vehicle Dispatch (For Dispatch, RTS Approval) | Otomatis; RTS approval → Approvals |
| FAD › Unreleased Unit | My Tasks (VWD) + Unit page |
| FAD › Document Monitoring | Track Documents di Unit page + task Scan; list monitoring tetap ada sebagai filter Pipeline |
| FAD › Cancellation Billing & Payment | Otomatis saat cancel + bank match |
| FAD › Rebate Payable | Settlement/refund run (tergantung aturan rebate) |
| FAD › Security Bond | Track tambahan di Unit page (belum di scratch) |
| SMD › SAAF | Otomatis + seller link; overdue → My Tasks |
| SMD › Pending Awarding, Unpaid, Seller Ack, For Dispatch, Unreleased (snapshot/duplikat) | Dihapus: semua lihat All units / Unit page |
| SMD › Return to Seller, SMD Manager Approval | RTS flow + Approvals |
| VWD › Unreleased Unit, Unreleased (Overdue), For Dispatch, For Return to Seller | My Tasks (VWD) |
| Report (7 layar) | Pipeline untuk harian; report formal yang memang dikirim ke pihak lain tetap (Rebate Monitoring, Liability to Seller, Inventory Summary, Cancellation Monitoring) |
| Customer › Customer Inquiry, Sales Actions, customer page | Customer 360 (tetap, diperkaya dari state yang sama) |
| Master › Holiday List | Tetap + import tahunan |
| Log Activity | Tetap untuk audit; per lot tampil di Unit page |

---

## 7. Perbandingan flow Philips (V1) vs V2

### 7.1 Ringkas

| Aspek | V1 (Philips) | V2 (konsep) |
|---|---|---|
| Unit desain | Layar per departemen (FAD/SMD/VWD) | Perjalanan satu unit + antrian kerja per role |
| Cara lot maju | Staf mengetik tanggal / centang lalu Save | Event: sistem, link seller/buyer, scan, satu klik |
| Jumlah layar | 39 | ±6 area kerja (perkiraan saya, belum divalidasi) |
| Field tanggal diketik | 21 (+ dialog) | 0 dalam alur normal; koreksi via Change date |
| Kolom centang "For …?" | 9 | 0 (trigger otomatis / aksi massal) |
| Approval | Campuran: tombol (Rebate) dan tanggal/nama diketik (RTS, Extend) | Satu inbox, semua tombol |
| Melihat status satu unit | Cari di beberapa list | Satu Unit page |
| Pengecualian (overdue, mismatch) | Tercampur di list; kolom merah | Muncul sebagai task dengan keputusan yang jelas |
| Peran seller & buyer | Pasif; staf mengetik balasan mereka | Aktif lewat link/portal |
| Paralelisme setelah bayar | Tersembunyi di list berbeda | Terlihat sebagai 3 track |

### 7.2 Skenario: satu lot normal (seller SBC) dari terjual sampai selesai

| Langkah | V1: sentuhan manual | V2: sentuhan manual |
|---|---|---|
| KYC | 1 (switch) | 0 |
| SAAF kirim + approval | 3 (centang, kirim, ketik tanggal) | 0 (seller klik) |
| BAAF | 2 (centang, kirim) | 0 |
| Buyer Paid | 1 (ketik) + Save | 0 (bank match) |
| Payment to Seller | 3 (centang, tanggal, print) | ⅟n (satu approval per run) |
| Seller Ack | 1 | 0 (seller klik) |
| Commission billing | 3 (centang, NOAH no., print) | 0 |
| Dispatch | 2 (centang email, tanggal) | 0 |
| DOAS & dokumen | 1 centang + hingga 5 tanggal | 2 scan |
| Release | 1–2 (penalty di FAD, release di VWD) | 1 |
| **Total** | **±15–20 sentuhan, ±9 layar, 3 departemen** | **±3–4 sentuhan + bagian dari 1 run** |

Angka V2 adalah **target desain**, bukan hasil ukur, dan bergantung pada poin *Cek/Sepakati* di bagian 5.

### 7.3 Yang dipertahankan dari V1

V1 tetap sangat berharga sebagai **sumber aturan bisnis yang sudah tervalidasi JBAP**, dan bisa dipakai ulang hampir seluruhnya:
- Aturan dan kalkulasi: working days + holiday, deadline 3 hari kerja, penalty ₱500/hari Pasay, cancellation fee 10k dan pembagiannya, komisi/VAT/CWT per seller, Payable to Seller (cocok sampai centavo dengan Access), status Document Monitoring, status Inventory.
- Seller parameter (release condition, DOAS signing, transfer fee, security bond).
- Layout email dan report (BAAF, SAAF, dispatch, DOAS, Documents Release, transmittal, clearance).
- Validasi tanggal, Change date dengan alasan, dan Log Activity per field.
- Keputusan JBAP ronde 1–5 (Q1–Q84) tetap berlaku kecuali yang bertentangan langsung dengan prinsip V2. Yang bertentangan dicatat di bagian 10 sebagai keputusan ulang.

---

## 8. Dampak ke estimasi

Estimasi lama (preliminary 100–150 MD dari Alvin; ±41 MD bagian saya) **tidak dipakai untuk V2**. Komponen yang perlu diestimasi ulang setelah workshop:

| Komponen | Catatan |
|---|---|
| Core lot state machine + event log | Inti V2; menggantikan banyak list |
| My Tasks, Approvals inbox, Unit page, Pipeline | Lebih sedikit layar daripada V1, tapi tiap layar lebih "pintar" |
| Automation jobs (SAAF, BAAF, reminder, dispatch, DOAS email, billing) | Scheduler + template email (layout reuse V1) |
| Bank matching | Besar/kecilnya tergantung modul BankTransfer yang sudah ada dan format referensi |
| Link seller (SAAF, Ack, EWB DOAS) | Signed link + halaman konfirmasi sederhana |
| KYC source | Tergantung jbap-revamp/API |
| NOAH | Tergantung API NOAH (P3 V1) |
| QR transmittal + scan | Kecil kalau pakai scanner/kamera biasa |
| Migrasi data Access | Tetap ada seperti di V1 |

**Saya belum bisa memberi angka MD**: integrasi bisa menaikkan, pengurangan layar bisa menurunkan. Angka keluar setelah cek prod (9) dan keputusan workshop (10).

---

## 9. Pengecekan sebelum workshop (satu batch ke prod)

1. Modul CDMS yang aktif di JBAP PH: jumlah transaksi 3 bulan terakhir untuk PaymentCustomer/Digital, BankTransfer (import), PaymentSeller, Billing, DocumentManagement, Inventory, Reminder, CashierClosing.
2. Volume: lot terjual per minggu, % lot yang telat bayar, % yang cancel, total penalty per bulan.
3. Bagaimana buyer membayar sekarang (transfer bank / cash / digital) dan apakah ada referensi yang bisa dicocokkan (Buyer ID, lot, VA).
4. Sumber dan definisi KYC buyer di jbap-revamp/API.

Query-nya disiapkan terpisah setelah dokumen ini disetujui.

---

## 10. Agenda workshop dengan JBAP (Jonathan, Kim)

**Sesi 1, as-is (±2 jam):** telusuri satu lot nyata dari terjual sampai release. Catat siapa yang menyentuh, berapa lama tiap langkah, di mana sering salah atau terlambat, dan KPI yang JBAP pedulikan.

**Sesi 2, to-be (±2 jam):** tunjukkan scratch UI ini dan putuskan:
1. Boleh BAAF/SAAF/dispatch/DOAS email terkirim otomatis tanpa centang manusia? (Kalau perlu kontrol: "auto kecuali ditahan".)
2. Apakah seller bersedia approve SAAF dan acknowledge lewat link? Seller mana yang tidak?
3. Pembayaran buyer bisa dicocokkan otomatis? Referensi apa yang dipakai?
4. Rebate: dipotong dari tagihan buyer atau dibayar terpisah?
5. Pull-out deadline seller DOAS mulai dari signed DOAS diterima (lihat bagian 5)?
6. QR di transmittal untuk penerimaan dokumen: bisa dijalankan di kantor/yard?
7. NOAH: ada API, atau tetap ketik nomor?
8. Report mana yang benar-benar dikirim ke pihak lain (harus tetap ada format formalnya) dan mana yang cukup jadi tampilan Pipeline?

**Keputusan ulang yang perlu diangkat terbuka:** beberapa permintaan ronde 1–5 secara eksplisit meminta format Access (misalnya P1 ditarik karena "JBAP keeps the Access format"). Arah dari Kaneshima-san berlawanan dengan itu. Workshop harus membuat keputusan ini eksplisit supaya tim operasional dan manajemen JBAP sepakat.

---

## 11. Risiko

| Risiko | Mitigasi |
|---|---|
| User operasional JBAP terbiasa Access dan menolak perubahan | Workshop melibatkan mereka; tunjukkan pengurangan kerja per lot; transisi bertahap |
| Otomasi salah kirim (BAAF/SAAF) | "Auto kecuali ditahan", preview harian, log lengkap, email tetap bisa diedit seperti V1 |
| Integrasi (bank, NOAH, KYC) tidak siap | Fallback 1-click per titik; desain tetap jalan tanpa integrasi, otomasi menyusul |
| Seller tidak mau klik link | Fallback 1-click oleh SMD dengan bukti email terlampir |
| Estimasi membengkak | Fase: (1) core state + tasks + auto email, (2) bank matching + seller link, (3) NOAH/QR |
| DOAS/dokumen tetap fisik dan notaris | V2 tidak mengubah proses fisik; hanya cara mencatatnya. E-signature untuk DOAS **tidak** diasumsikan (belum diketahui legalitasnya di Filipina) |

---

## 12. Isi folder dan cara review scratch UI

- `README.md`: dokumen ini.
- `index.html`: scratch UI satu file (HTML+CSS+JS), data dummy. Bukan desain final.

**Alur demo yang disarankan:**
1. Buka **My Tasks** (All roles): 8 task, sisanya "Waiting on …" dilipat.
2. Klik lot **A230-112** → lihat Unit page: timeline, 3 track paralel, penalty, uang, history dengan label sumber.
3. Di panel kanan tekan **Import bank statement**: 2 pembayaran cocok otomatis, 1 kurang bayar masuk task FAD, fee cancel lunas otomatis.
4. **Seller clicks the link** dan **Buyer completes KYC**: lihat SAAF/BAAF terkirim sendiri di feed.
5. **Next working day**: reminder, deadline, dan penalty bergerak.
6. Approve rebate di **Approvals** → BAAF untuk lot itu langsung terkirim.
7. **Settlement run** → Approve: seller dibayar, commission billing terbentuk sendiri.
8. Ganti role ke **VWD** → Release unit (penalty ditagih di langkah yang sama).
9. Buka **V1 vs V2** untuk tabel perbandingan.
